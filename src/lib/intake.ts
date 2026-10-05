import "server-only";
import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { fail } from "./api";
import { claimEvidence, claims, db } from "./db";
import { deleteReceipt, getReceipt, MAX_RECEIPT_BYTES, RECEIPT_TYPES, receiptKey, receiptPrefix, receiptUploadUrl, s3Configured } from "./s3";

export const UploadRequest = z.object({
  mime: z.enum(Object.keys(RECEIPT_TYPES) as [string, ...string[]], { error: "Use JPEG, PNG, WebP or PDF" }),
  size: z.number().int().positive().max(MAX_RECEIPT_BYTES, "Max 10MB"),
});

/** Step 1 of an upload: a presigned PUT for this workspace and claim. */
export async function presignUpload(workspaceId: string, claimId: string, input: unknown) {
  if (!s3Configured()) fail(503, "s3_not_configured", "S3 not configured");
  const { mime, size } = UploadRequest.parse(input);
  const key = receiptKey(workspaceId, claimId, mime);
  return { key, claimId, url: await receiptUploadUrl(key, mime, size), headers: { "Content-Type": mime } };
}

export const UploadedFile = z.object({ key: z.string().max(300), name: z.string().trim().min(1).max(200) });

// File signatures: the declared type must match the bytes.
const MAGIC: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
  "image/png": (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8,
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};

/** Step 2: the browser says where it put the file. Only keys under this workspace + claim are accepted. */
export async function readUploaded(workspaceId: string, claimId: string, input: unknown) {
  const { key, name } = UploadedFile.parse(input);
  if (!key.startsWith(receiptPrefix(workspaceId, claimId)) || key.includes("..")) fail(403, "forbidden", "That upload does not belong to this claim");
  const { buf, mime, size } = await getReceipt(key);
  if (!RECEIPT_TYPES[mime] || !MAGIC[mime](buf)) {
    await deleteReceipt(key);
    fail(400, "invalid_type", "Use JPEG, PNG, WebP or PDF");
  }
  if (size > MAX_RECEIPT_BYTES) {
    await deleteReceipt(key);
    fail(400, "too_large", "Max 10MB");
  }
  return { key, file: { name, type: mime, size }, buf, hash: createHash("sha256").update(buf).digest("hex") };
}

/** Refuses a file that was already submitted in this workspace, says where it went, and drops the new copy. */
export async function rejectSameFile(workspaceId: string, hash: string, key: string) {
  const [dup] = await db
    .select({ number: claims.number })
    .from(claimEvidence)
    .innerJoin(claims, eq(claims.id, claimEvidence.claimId))
    .where(and(eq(claimEvidence.workspaceId, workspaceId), eq(claimEvidence.fileHash, hash), ne(claims.status, "rejected")));
  if (dup) {
    await deleteReceipt(key);
    fail(409, "duplicate_file", `This exact file was already submitted as claim #${dup.number}`);
  }
}
