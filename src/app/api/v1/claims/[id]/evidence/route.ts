import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { aiProvider, parseClaimText } from "@/lib/ai";
import { fail, route } from "@/lib/api";
import { addEvidence, handleOf, workspaceMembers } from "@/lib/claims";
import { claimEvidence, claims, db, EVIDENCE_KINDS } from "@/lib/db";
import { readFileField, rejectSameFile, storeAndExtract } from "@/lib/intake";

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

// Multipart `file` (+ optional `kind`) for receipts/invoices, or JSON { text, kind } for messages.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const claim = await load(ctx.workspace.id, id);
  if (!ctx.isAdmin && claim.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only add evidence to your own claims");
  if (["paid", "rejected"].includes(claim.status)) fail(409, "locked", `Claim is ${claim.status}`);

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    const kind = z.enum(["receipt", "invoice", "statement"]).catch("receipt").parse(form.get("kind"));
    const { file, buf, hash } = await readFileField(form);
    await rejectSameFile(ctx.workspace.id, hash);
    const { key, extract, rawText } = await storeAndExtract(ctx.workspace.id, claim.id, file, buf);
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

  const { text, kind } = TextEvidence.parse(await req.json().catch(() => ({})));
  const members = await workspaceMembers(ctx.workspace.id);
  const parsed = await parseClaimText(text, members.map((m) => ({ id: m.id, name: m.name, handle: handleOf(m.name) })), new Date().toISOString().slice(0, 10));
  return addEvidence(ctx.workspace.id, ctx.user.id, claim, { kind, source: "manual", rawText: text, extract: { ...parsed, provider: aiProvider() } });
});
