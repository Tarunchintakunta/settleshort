import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fail } from "./api";

// Receipt storage on AWS S3. The bucket stays private.
// Upload: the server signs a short-lived PUT URL bound to the key, type and exact size; the browser PUTs
// straight to S3, then tells the server the key. Viewing: 5 minute presigned GET after a team check.
// Credentials are never read here: the SDK default chain finds them (`aws configure` locally,
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY on Vercel).

export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const GET_URL_TTL_SECONDS = 300;
const PUT_URL_TTL_SECONDS = 300;

export const s3Configured = () => Boolean(process.env.AWS_REGION && process.env.S3_BUCKET_NAME);

let client: S3Client | null = null;
function s3() {
  if (!s3Configured()) fail(503, "s3_not_configured", "S3 not configured");
  client ??= new S3Client({ region: process.env.AWS_REGION });
  return { client, bucket: process.env.S3_BUCKET_NAME! };
}

/** Every receipt key is scoped to its workspace and claim; the server checks this prefix before trusting a key. */
export const receiptPrefix = (workspaceId: string, claimId: string) => `receipts/${workspaceId}/${claimId}/`;

export function receiptKey(workspaceId: string, claimId: string, mime: string) {
  return `${receiptPrefix(workspaceId, claimId)}${randomUUID()}.${RECEIPT_TYPES[mime]}`;
}

/** Presigned PUT. Type and length are signed, so S3 rejects any other file. */
export async function receiptUploadUrl(key: string, mime: string, size: number) {
  const { client, bucket } = s3();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mime, ContentLength: size }), { expiresIn: PUT_URL_TTL_SECONDS });
}

/** Reads an uploaded receipt back for hashing and extraction. */
export async function getReceipt(key: string) {
  const { client, bucket } = s3();
  const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })).catch(() => null);
  if (!r?.Body) fail(400, "upload_missing", "Upload not found. Try again.");
  return { buf: Buffer.from(await r!.Body!.transformToByteArray()), mime: r!.ContentType ?? "", size: r!.ContentLength ?? 0 };
}

export async function deleteReceipt(key: string) {
  const { client, bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
}

/** Short-lived URL for viewing a receipt in the app. The object itself stays private. */
export async function receiptUrl(key: string) {
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: GET_URL_TTL_SECONDS });
}
