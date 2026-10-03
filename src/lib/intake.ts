import "server-only";
import { extractReceipt } from "./ai";
import { fail } from "./api";
import { MAX_RECEIPT_BYTES, putReceipt, RECEIPT_TYPES, receiptKey, s3Configured } from "./s3";

/** Validates the multipart `file` field shared by receipt upload and evidence attach. */
export async function readFileField(form: FormData) {
  if (!s3Configured()) fail(503, "s3_not_configured", "S3 not configured");
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "invalid_input", "Attach a file");
  const f = file as File;
  if (!RECEIPT_TYPES[f.type]) fail(400, "invalid_type", "Use JPEG, PNG, WebP or PDF");
  if (f.size > MAX_RECEIPT_BYTES) fail(400, "too_large", "Max 10MB");
  return { file: f, buf: Buffer.from(await f.arrayBuffer()) };
}

/** Stores the original privately in S3, then extracts it. */
export async function storeAndExtract(workspaceId: string, claimId: string, f: File, buf: Buffer) {
  const key = receiptKey(workspaceId, claimId, f.type);
  await putReceipt(key, buf, f.type);
  const { extract, rawText } = await extractReceipt(buf, f.type);
  return { key, extract, rawText };
}
