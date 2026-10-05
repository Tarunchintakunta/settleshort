// End-to-end happy path against a real Postgres, with PayPal mocked at the HTTP boundary:
// seeded team -> admin approves a batch (twice, concurrently) -> one PayPal payout -> items SUCCESS
// -> claims paid -> audit trail + notifications. Plus: unverified webhooks are rejected.
// Needs TEST_DATABASE_URL (CI provides one); skipped otherwise. The database is migrated, not wiped.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("approve and pay (PayPal mocked)", () => {
  const posted: { sender_batch_header: { sender_batch_id: string }; items: { sender_item_id: string; receiver: string }[] }[] = [];
  let verifyAnswer = "FAILURE";

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYPAL_CLIENT_ID = "test-client";
    process.env.PAYPAL_CLIENT_SECRET = "test-secret";
    process.env.PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";
    process.env.PAYPAL_WEBHOOK_ID = "WH-TEST";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const u = new URL(input);
        const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
        if (u.pathname === "/v1/oauth2/token") return json({ access_token: "tok", expires_in: 3600 });
        if (u.pathname === "/v1/payments/payouts" && init?.method === "POST") {
          posted.push(JSON.parse(String(init.body)));
          return json({ batch_header: { payout_batch_id: `PB-${posted.length}`, batch_status: "PENDING" } });
        }
        if (u.pathname.startsWith("/v1/payments/payouts/")) {
          const items = posted.at(-1)!.items;
          return json({
            batch_header: { batch_status: "SUCCESS" },
            items: items.map((i, n) => ({ payout_item_id: `ITEM-${n}`, transaction_status: "SUCCESS", transaction_id: `TX-${n}`, payout_item: { sender_item_id: i.sender_item_id } })),
          });
        }
        if (u.pathname === "/v1/notifications/verify-webhook-signature") return json({ verification_status: verifyAnswer });
        throw new Error(`unexpected fetch ${u.pathname}`);
      }),
    );
    const { db } = await import("../src/lib/db");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(() => vi.unstubAllGlobals());

  it("pays each person exactly once, then records it", async () => {
    const { and, eq } = await import("drizzle-orm");
    const { db, batches, claims, batchItems, auditEvents, notifications } = await import("../src/lib/db");
    const { createDemoWorkspace } = await import("../src/lib/seed");
    const { approveBatch } = await import("../src/lib/batches");

    const { workspaceId, userId } = await createDemoWorkspace();
    const [batch] = await db.select().from(batches).where(and(eq(batches.workspaceId, workspaceId), eq(batches.status, "awaiting_approval")));

    // Double click: two approvals race. Exactly one may reach PayPal.
    const results = await Promise.allSettled([approveBatch(workspaceId, userId, batch.id), approveBatch(workspaceId, userId, batch.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { code: "already_processed" } });
    expect(posted).toHaveLength(1);
    expect(posted[0].sender_batch_header.sender_batch_id).toBe(batch.id);

    const [done] = await db.select().from(batches).where(eq(batches.id, batch.id));
    expect(done.status).toBe("completed");
    expect(done.approvedBy).toBe(userId);
    const items = await db.select().from(batchItems).where(eq(batchItems.batchId, batch.id));
    expect(items.every((i) => i.status === "SUCCESS" && i.transactionId)).toBe(true);
    for (const i of items) expect((await db.select().from(claims).where(eq(claims.id, i.claimId)))[0].status).toBe("paid");

    const actions = (await db.select().from(auditEvents).where(eq(auditEvents.workspaceId, workspaceId))).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["batch.approved", "payout.created", "payout.item.success", "batch.completed"]));
    expect(await db.select().from(notifications).where(eq(notifications.workspaceId, workspaceId))).toHaveLength(items.length);

    // Approving a finished batch again is refused and never reaches PayPal.
    await expect(approveBatch(workspaceId, userId, batch.id)).rejects.toMatchObject({ code: "already_processed" });
    expect(posted).toHaveLength(1);
  });

  it("rejects webhooks PayPal does not verify", async () => {
    const { POST } = await import("../src/app/api/webhooks/paypal/route");
    const event = { id: "WH-EVT-1", event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED", resource: { payout_batch_id: "PB-1" } };
    verifyAnswer = "FAILURE";
    expect((await POST(new Request("http://x/api/webhooks/paypal", { method: "POST", body: JSON.stringify(event) }))).status).toBe(401);
    verifyAnswer = "SUCCESS";
    expect((await POST(new Request("http://x/api/webhooks/paypal", { method: "POST", body: JSON.stringify(event) }))).status).toBe(200);
  });
});
