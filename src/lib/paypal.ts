import "server-only";
import { centsToDecimal } from "./money";

// PayPal Payouts (sandbox). When PAYPAL_CLIENT_ID/SECRET are missing we run a clearly-labelled
// simulator so the full flow still demos; the UI shows which mode produced each batch.

export const paypalMode = () => (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? "sandbox" : "simulated");
const BASE = () => process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

if (BASE().includes("api-m.paypal.com")) throw new Error("Live PayPal endpoint refused: SettleShort is sandbox-only.");

let cached: { token: string; exp: number } | null = null;

async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status})`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function pp(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...init.headers },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PayPal ${res.status}: ${j.message ?? j.name ?? "request failed"}${j.details ? ", " + JSON.stringify(j.details) : ""}`);
  return j;
}

export type PayoutItemInput = { senderItemId: string; email: string; amountCents: number; currency: string; note: string };
export type PayoutItemStatus = { senderItemId: string; payoutItemId: string; status: string; transactionId?: string; error?: string };
type PaypalItem = {
  payout_item_id: string;
  transaction_status: string;
  transaction_id?: string;
  payout_item?: { sender_item_id: string };
  errors?: { message?: string; name?: string };
};

export type PayoutStatus = { payoutBatchId: string; batchStatus: string; items: PayoutItemStatus[]; raw: unknown };

export async function createPayout(senderBatchId: string, items: PayoutItemInput[]): Promise<{ payoutBatchId: string; raw: unknown }> {
  if (paypalMode() === "simulated") {
    return { payoutBatchId: `SIM-${senderBatchId.slice(0, 8).toUpperCase()}`, raw: { simulated: true, items: items.length } };
  }
  const j = await pp("/v1/payments/payouts", {
    method: "POST",
    // PayPal also rejects a reused sender_batch_id, so a retry can never double-pay.
    headers: { "PayPal-Request-Id": senderBatchId },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "You were paid via SettleShort",
        email_message: "Settlement for shared expenses.",
      },
      items: items.map((i) => ({
        recipient_type: "EMAIL",
        amount: { value: centsToDecimal(i.amountCents), currency: i.currency },
        receiver: i.email,
        note: i.note,
        sender_item_id: i.senderItemId,
      })),
    }),
  });
  return { payoutBatchId: j.batch_header.payout_batch_id, raw: j };
}

export async function getPayout(payoutBatchId: string, items: { senderItemId: string; email: string }[]): Promise<PayoutStatus> {
  if (payoutBatchId.startsWith("SIM-")) {
    // Simulator: every receiver succeeds except addresses containing "unclaimed" or "fail".
    const out = items.map((i) => ({
      senderItemId: i.senderItemId,
      payoutItemId: `SIMITEM-${i.senderItemId.slice(0, 8).toUpperCase()}`,
      status: /fail/i.test(i.email) ? "FAILED" : /unclaimed/i.test(i.email) ? "UNCLAIMED" : "SUCCESS",
      transactionId: /fail|unclaimed/i.test(i.email) ? undefined : `SIMTX${i.senderItemId.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
      error: /fail/i.test(i.email) ? "RECEIVER_UNREGISTERED (simulated)" : undefined,
    }));
    return { payoutBatchId, batchStatus: "SUCCESS", items: out, raw: { simulated: true } };
  }
  const j = await pp(`/v1/payments/payouts/${payoutBatchId}?page_size=100`);
  return {
    payoutBatchId,
    batchStatus: j.batch_header.batch_status,
    raw: j,
    items: (j.items ?? []).map((it: PaypalItem) => ({
      senderItemId: it.payout_item?.sender_item_id,
      payoutItemId: it.payout_item_id,
      status: it.transaction_status,
      transactionId: it.transaction_id,
      error: it.errors?.message ?? it.errors?.name,
    })),
  };
}

/** Verifies a webhook via PayPal's verify-webhook-signature API. */
export async function verifyWebhook(headers: Headers, event: unknown) {
  if (paypalMode() === "simulated" || !process.env.PAYPAL_WEBHOOK_ID) return false;
  const j = await pp("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  return j.verification_status === "SUCCESS";
}
