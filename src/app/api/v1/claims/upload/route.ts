import { eq } from "drizzle-orm";
import { z } from "zod";
import { aiProvider, extractReceipt } from "@/lib/ai";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createClaim } from "@/lib/claims";
import { aiJobs, db } from "@/lib/db";
import { readUploaded, rejectSameFile } from "@/lib/intake";

// Step 2 of a new receipt: { key, name } after the browser PUT the file to S3 (see upload-url).
// The server re-reads the object, checks it, extracts with AI and creates the claim.
// Extraction runs inline (a few seconds) and is recorded as an ai_job so GET /claims/jobs/:id works.
export const POST = route(async (req, ctx) => {
  const input = await req.json().catch(() => ({}));
  // Key layout is receipts/{workspaceId}/{claimId}/{uuid}.{ext}; readUploaded re-checks the full prefix.
  const claimId = z.uuid().catch("").parse(String((input as { key?: unknown }).key ?? "").split("/")[2]);
  if (!claimId) fail(400, "invalid_input", "Upload key is not valid");
  const { key, file: f, buf, hash } = await readUploaded(ctx.workspace.id, claimId, input);
  await rejectSameFile(ctx.workspace.id, hash, key);

  const [job] = await db
    .insert(aiJobs)
    .values({ workspaceId: ctx.workspace.id, kind: "receipt", status: "running", provider: aiProvider(), inputJson: { filename: f.name, mime: f.type, size: f.size } })
    .returning();

  try {
    const { extract: x, rawText } = await extractReceipt(buf, f.type);
    const claim = await createClaim(ctx.workspace.id, ctx.user.id, {
      id: claimId,
      source: "upload",
      vendor: x.vendor,
      amountCents: x.amount_cents,
      currency: x.currency,
      txnDate: x.txn_date,
      tipCents: x.tip_cents,
      taxCents: x.tax_cents,
      note: x.notes,
      receiptKey: key,
      receiptMime: f.type,
      receiptName: f.name.slice(0, 200),
      fileHash: hash,
      aiJson: { ...x, provider: aiProvider(), ocr_text: rawText?.slice(0, 4000) },
      aiConfidence: x.confidence,
      payerUserId: ctx.user.id,
    });
    await db.update(aiJobs).set({ status: "done", outputJson: x, claimId: claim.id }).where(eq(aiJobs.id, job.id));
    await audit(ctx.workspace.id, ctx.user.id, "ai.extract_ok", "claim", claim.id, { provider: aiProvider(), confidence: x.confidence });
    return { jobId: job.id, claim };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(aiJobs).set({ status: "error", error: msg }).where(eq(aiJobs.id, job.id));
    await audit(ctx.workspace.id, ctx.user.id, "ai.extract_failed", "ai_job", job.id, { error: msg });
    fail(422, "extract_failed", `Could not read receipt: ${msg}`);
  }
});
