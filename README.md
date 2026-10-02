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

## Stack
Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM, Postgres (Neon), AG Grid Community, Motion, Phosphor icons, PayPal REST, Anthropic / OpenAI SDKs, tesseract.js, Vitest.

## Run locally

```bash
pnpm i
cp .env.example .env.local   # set DATABASE_URL and SESSION_SECRET at minimum
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
| POST | `/claims/upload` | multipart `file`, returns `{ jobId, claim }` |
| GET | `/claims/jobs/:id` | extraction job |
| POST | `/claims/from-text` | `{ text }` |
| GET | `/claims?status=&q=` | |
| GET / PATCH | `/claims/:id` | edit fields, `markReady` (admin) |
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
