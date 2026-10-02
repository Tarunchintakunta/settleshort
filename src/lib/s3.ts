import "server-only";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { fail } from "./api";

// Receipt storage on AWS S3.
// Upload strategy: server-side upload. The browser posts the file to /api/v1/claims/upload, the server
// runs AI extraction on the same bytes and PUTs them to S3. One round trip, no bucket CORS needed, and
// credentials never leave the server. Viewing uses presigned GET URLs that expire after a few minutes.
// ponytail: Vercel caps request bodies near 4.5MB; switch to presigned PUT (see README) for larger files.

export const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const GET_URL_TTL_SECONDS = 300;

// Vercel reserves the AWS_* names on some plans, so S3_* aliases are accepted too.
const env = () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION ?? process.env.S3_REGION,
  bucket: process.env.S3_BUCKET_NAME,
});

export const s3Configured = () => Object.values(env()).every(Boolean);

let client: S3Client | null = null;
function s3() {
  const e = env();
  if (!s3Configured()) fail(503, "s3_not_configured", "S3 not configured");
  client ??= new S3Client({ region: e.region, credentials: { accessKeyId: e.accessKeyId!, secretAccessKey: e.secretAccessKey! } });
  return { client, bucket: e.bucket! };
}

export function receiptKey(workspaceId: string, claimId: string, mime: string) {
  return `receipts/${workspaceId}/${claimId}/${randomUUID()}.${RECEIPT_TYPES[mime]}`;
}

export async function putReceipt(key: string, body: Buffer, mime: string) {
  const { client, bucket } = s3();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mime, ServerSideEncryption: "AES256" }));
}

/** Short-lived URL for viewing a receipt in the app. The object itself stays private. */
export async function receiptUrl(key: string) {
  const { client, bucket } = s3();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: GET_URL_TTL_SECONDS });
}
