# SettleShort

**Receipt in. Settled out. One approve.**

SettleShort turns receipt photos, PDFs and Slack messages like "I paid $84 for dinner for @sam @rita" into expense claims, catches duplicates, and reimburses your team through **PayPal Payouts**, but only after a human admin approves the batch.

Built for the [PayPal "Build What's Next with PayPal and AI" hackathon](https://paypalaihackathon.devpost.com/).

## Try it

1. Open the deployed app and click **Open the demo**. You get a fresh, private "Northbeam Labs" workspace signed in as Maya (owner).
2. **Claims > New claim**: pick a sample receipt or paste a message. Watch each field get read, with the exact receipt text it came from, and the duplicate check run.
3. **Batches > September offsites > Approve & Pay**, type `APPROVE`. Statuses update to Paid with PayPal item and transaction ids.
4. **Activity** shows the full audit trail. **Export CSV** on any batch.

## How it works

```
Intake (photo, PDF, Slack, paste)
  -> Extraction: Claude / OpenAI vision, or on-device Tesseract OCR + parser (no key)
  -> Claim (structured, with per-field evidence and a confidence score; < 55% forces review)
  -> Matching: amount +/- tolerance, date +/- 2 days, fuzzy merchant, payer; AI writes the rationale
  -> Settlement batch (one currency, every payee needs a PayPal email)
  -> HUMAN APPROVE (owner/admin role + typed confirmation + per-payout and per-batch caps)
  -> PayPal Payouts API (sandbox), sender_batch_id = batch id, PayPal-Request-Id header
  -> Webhooks (signature verified with PayPal) or polling update items: SUCCESS / UNCLAIMED / FAILED
  -> Audit log + CSV export
```

### PayPal
- `POST /v1/oauth2/token` (client credentials, token cached)
- `POST /v1/payments/payouts` only from `approveBatch` in `src/lib/batches.ts`, the single code path that moves money
- `GET /v1/payments/payouts/{id}` for status polling
- `POST /v1/notifications/verify-webhook-signature` before any webhook is trusted
- Idempotency: an atomic `awaiting_approval -> submitting` state flip, plus a unique `sender_batch_id` that PayPal itself refuses to reuse
- Sandbox only: the live API host is refused at module load

Without `PAYPAL_CLIENT_ID`/`SECRET` the app runs a payout simulator and says so on every screen.

### AI
- **Claude** (`ANTHROPIC_API_KEY`): images and PDFs with structured outputs (Zod schema), plus duplicate rationales.
- **OpenAI** (`OPENAI_API_KEY`): vision + JSON mode.
- **On-device** (no key): Tesseract OCR for images, text-layer extraction for PDFs, then a deterministic parser for vendor, total, tax, tip, date, card and line items.

Receipt text is treated as untrusted data: model output is validated with Zod and can only fill fields. Nothing the model says can trigger a payout.

## Receipt storage (AWS S3)

Receipts are stored privately in S3 at `s3://$S3_BUCKET_NAME/receipts/{workspaceId}/{claimId}/{uuid}.{ext}` using AWS SDK v3.

- **Upload strategy: server-side upload.** The browser posts the file to `POST /api/v1/claims/upload`. The server validates type (JPEG, PNG, WebP, PDF) and size (10MB), runs extraction on the same bytes, and `PutObject`s them with SSE-S3 encryption. One round trip, and AWS credentials never reach the browser. Note that Vercel caps request bodies near 4.5MB; for bigger files switch to presigned PUT URLs (CORS below).
- **What is stored:** only the object key, MIME type and original filename on the claim. No credentials in the database or client.
- **Viewing:** `GET /api/v1/claims/:id/receipt` checks workspace membership and redirects to a presigned GET URL that expires in 5 minutes.
- **Not configured:** the upload API returns `503 { error: { code: "s3_not_configured", message: "S3 not configured" } }`.

Minimal IAM policy for the app's access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::YOUR_BUCKET/receipts/*" }
  ]
}
```

Keep Block Public Access on. Bucket CORS is only needed if you move to browser presigned PUT uploads:

```json
[
  {
    "AllowedOrigins": ["https://settleshort.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Stack
Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM, Postgres (Neon), AWS S3 (SDK v3), AG Grid Community, Motion, Phosphor icons, PayPal REST, Anthropic / OpenAI SDKs, tesseract.js, Vitest.

## Run locally

```bash
pnpm i
cp .env.example .env.local   # set DATABASE_URL, SESSION_SECRET and the four S3 vars
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 and click **Open the demo**. `pnpm test` runs the matching, money and receipt parser tests. `pnpm db:seed` creates a demo workspace from the CLI.

### PayPal sandbox setup
1. developer.paypal.com > Apps & Credentials > Sandbox > create an app; copy Client ID and Secret.
2. Testing tools > Sandbox accounts: one Business (sender, fund it) and a few Personal accounts (receivers).
3. Put the personal emails in `DEMO_PAYPAL_RECEIVERS` (or on each member under Members).
4. Add a webhook to `https://<your-domain>/api/v1/webhooks/paypal` for `PAYMENT.PAYOUTSBATCH.*` and `PAYMENT.PAYOUTS-ITEM.*`; copy its id into `PAYPAL_WEBHOOK_ID`.

## Deploy
- **Database**: any Postgres (Neon or Railway). `pnpm db:migrate`.
- **Web**: Vercel, root `/`, framework Next.js, env vars from `.env.example`.

## API
All under `/api/v1`, JSON, session cookie auth, errors as `{ error: { code, message } }`.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/claims/upload` | multipart `file` (JPEG/PNG/WebP/PDF, 10MB), stored in S3, returns `{ jobId, claim }`; 503 if S3 not configured |
| GET | `/claims/jobs/:id` | extraction job |
| POST | `/claims/from-text` | `{ text }` |
| GET | `/claims?status=&q=` | |
| GET / PATCH | `/claims/:id` | edit fields, `markReady` (admin) |
| GET | `/claims/:id/receipt` | 302 to a 5 minute presigned S3 URL |
| POST | `/claims/:id/reject` | admin |
| POST | `/claims/merge` | `{ ids }`, keeps the first, admin |
| GET / POST | `/batches` | create from ready claims, admin |
| GET | `/batches/:id` | |
| POST | `/batches/:id/approve` | `{ confirm: "APPROVE" }`, admin, the only payout trigger |
| POST | `/batches/:id/refresh-status` | poll PayPal |
| GET | `/batches/:id/export` | CSV |
| GET | `/members`, POST `/members/invite`, PATCH `/members/:id` | |
| GET | `/workspaces/current`, PATCH `/workspaces/settings` | caps |
| POST | `/webhooks/paypal` | signature verified |
| POST | `/webhooks/zapier` | header `x-settleshort-secret`, body `{ workspace_slug, text, from_email }` |
| GET | `/health` | |

## License
MIT
