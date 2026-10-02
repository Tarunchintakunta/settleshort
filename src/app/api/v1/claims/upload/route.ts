import { eq } from "drizzle-orm";
import { aiProvider, extractReceipt } from "@/lib/ai";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createClaim } from "@/lib/claims";
import { aiJobs, db, receipts } from "@/lib/db";

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 10 * 1024 * 1024; // ponytail: Vercel caps request bodies ~4.5MB; use direct-to-storage uploads for bigger files.

// Extraction runs inline (a few seconds) and is recorded as an ai_job so GET /claims/jobs/:id works.
export const POST = route(async (req, ctx) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "invalid_input", "Attach a file");
  const f = file as File;
  if (!TYPES.includes(f.type)) fail(400, "invalid_type", "Use JPEG, PNG, WebP or PDF");
  if (f.size > MAX) fail(400, "too_large", "Max 10MB");

  const buf = Buffer.from(await f.arrayBuffer());
  const [receipt] = await db
    .insert(receipts)
    .values({ workspaceId: ctx.workspace.id, filename: f.name, mime: f.type, dataB64: buf.toString("base64") })
    .returning({ id: receipts.id });
  const [job] = await db
    .insert(aiJobs)
    .values({ workspaceId: ctx.workspace.id, kind: "receipt", status: "running", provider: aiProvider(), inputJson: { filename: f.name, mime: f.type, size: f.size } })
    .returning();

  try {
    const { extract: x, rawText } = await extractReceipt(buf, f.type);
    const claim = await createClaim(ctx.workspace.id, ctx.user.id, {
      source: "upload",
      vendor: x.vendor,
      amountCents: x.amount_cents,
      currency: x.currency,
      txnDate: x.txn_date,
      tipCents: x.tip_cents,
      taxCents: x.tax_cents,
      note: x.notes,
      receiptId: receipt.id,
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
