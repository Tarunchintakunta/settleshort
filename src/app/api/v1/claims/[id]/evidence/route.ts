import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { aiProvider, extractReceipt, parseClaimText } from "@/lib/ai";
import { fail, route } from "@/lib/api";
import { addEvidence, handleOf, workspaceMembers } from "@/lib/claims";
import { claimEvidence, claims, db, EVIDENCE_KINDS } from "@/lib/db";
import { readUploaded, rejectSameFile } from "@/lib/intake";

async function load(workspaceId: string, id: string) {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, workspaceId)));
  if (!c) fail(404, "not_found", "Claim not found");
  return c!;
}

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  await load(ctx.workspace.id, id);
  return db.select().from(claimEvidence).where(eq(claimEvidence.claimId, id)).orderBy(claimEvidence.createdAt);
});

const TextEvidence = z.object({ text: z.string().trim().min(3).max(4000), kind: z.enum(EVIDENCE_KINDS).default("message") });

// { key, name, kind } for a file already PUT to S3 (see evidence/upload-url), or { text, kind } for messages.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const claim = await load(ctx.workspace.id, id);
  if (!ctx.isAdmin && claim.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only add evidence to your own claims");
  if (["paid", "rejected"].includes(claim.status)) fail(409, "locked", `Claim is ${claim.status}`);

  const input = await req.json().catch(() => ({}));
  if (input && typeof input === "object" && "key" in input) {
    const kind = z.enum(["receipt", "invoice", "statement"]).catch("receipt").parse((input as { kind?: unknown }).kind);
    const { key, file, buf, hash } = await readUploaded(ctx.workspace.id, claim.id, input);
    await rejectSameFile(ctx.workspace.id, hash, key);
    const { extract, rawText } = await extractReceipt(buf, file.type);
    return addEvidence(ctx.workspace.id, ctx.user.id, claim, {
      kind,
      source: "upload",
      fileKey: key,
      fileMime: file.type,
      fileName: file.name.slice(0, 200),
      fileHash: hash,
      // Statements are personal: the file stays private and its full OCR text is not kept.
      privateFile: kind === "statement",
      extract: { ...extract, provider: aiProvider(), ...(kind === "statement" ? {} : { ocr_text: rawText?.slice(0, 4000) }) },
    });
  }

  const { text, kind } = TextEvidence.parse(input);
  const members = await workspaceMembers(ctx.workspace.id);
  const parsed = await parseClaimText(text, members.map((m) => ({ id: m.id, name: m.name, handle: handleOf(m.name) })), new Date().toISOString().slice(0, 10));
  return addEvidence(ctx.workspace.id, ctx.user.id, claim, { kind, source: "manual", rawText: text, extract: { ...parsed, provider: aiProvider() } });
});
