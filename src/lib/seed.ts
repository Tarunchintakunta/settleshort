// Demo seed: a fresh, isolated "Northbeam Labs" workspace per /demo visit so judges never collide.
// No "server-only" import so scripts/seed.ts can reuse it.
import { randomBytes } from "node:crypto";
import { auditEvents, batches, batchItems, claimEvidence, claims, claimSplits, db, memberships, users, workspaces } from "./db";

const PEOPLE = [
  { key: "maya", name: "Maya Chen", role: "owner" as const },
  { key: "sam", name: "Sam Patel", role: "member" as const },
  { key: "rita", name: "Rita Gomez", role: "member" as const },
  { key: "dev", name: "Dev Kumar", role: "member" as const },
  { key: "jules", name: "Jules Moreau", role: "member" as const },
];

/** Sandbox receivers: set DEMO_PAYPAL_RECEIVERS="sam@..,rita@..,dev@..,jules@.." to your sandbox personal accounts. */
function receivers() {
  const list = (process.env.DEMO_PAYPAL_RECEIVERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Object.fromEntries(
    PEOPLE.map((p, i) => [p.key, i === 0 ? process.env.DEMO_PAYPAL_SENDER ?? "maya@northbeam.test" : list[i - 1] ?? `${p.key}@northbeam.test`]),
  );
}

export async function createDemoWorkspace() {
  const tag = randomBytes(4).toString("hex");
  const pp = receivers();
  const [ws] = await db
    .insert(workspaces)
    .values({
      name: "Northbeam Labs",
      slug: `northbeam-demo-${tag}`,
      maxSingleCents: Number(process.env.MAX_SINGLE_PAYOUT_CENTS ?? 50000),
      maxBatchCents: Number(process.env.MAX_BATCH_TOTAL_CENTS ?? 200000),
      isDemo: 1,
    })
    .returning();

  const u: Record<string, string> = {};
  for (const p of PEOPLE) {
    const [row] = await db.insert(users).values({ email: `${p.key}+${tag}@demo.settleshort.app`, name: p.name }).returning();
    u[p.key] = row.id;
    await db.insert(memberships).values({ workspaceId: ws.id, userId: row.id, role: p.role, paypalReceiverEmail: pp[p.key] });
  }

  type C = Partial<typeof claims.$inferInsert> & { key: string };
  const defs: C[] = [
    { key: "c1", vendor: "Lyft", amountCents: 3210, txnDate: "2026-08-28", source: "slack", payerUserId: u.sam, status: "paid", aiConfidence: 0.86, rawText: "Lyft to the offsite $32.10", note: "Airport → venue" },
    { key: "c2", vendor: "WeWork day pass", amountCents: 4500, txnDate: "2026-08-29", source: "upload", payerUserId: u.rita, status: "paid", aiConfidence: 0.93 },
    { key: "c3", vendor: "Nopa", amountCents: 18650, txnDate: "2026-09-26", source: "upload", payerUserId: u.dev, status: "in_batch", aiConfidence: 0.88, tipCents: 3000, taxCents: 1450, note: "Team dinner, party of 5" },
    { key: "c4", vendor: "Uber", amountCents: 4230, txnDate: "2026-09-25", source: "slack", payerUserId: u.rita, status: "in_batch", aiConfidence: 0.82, rawText: "I paid $42.30 for Uber for @rita yesterday" },
    { key: "c5", vendor: "Costco", amountCents: 5875, txnDate: "2026-09-24", source: "manual", payerUserId: u.jules, status: "in_batch", note: "Offsite snacks" },
    { key: "c6", vendor: "Chipotle", amountCents: 6400, txnDate: "2026-09-29", source: "slack", payerUserId: u.sam, status: "matched", aiConfidence: 0.84, rawText: "Chipotle $64 split me @sam @dev" },
    { key: "c7", vendor: "Ace Hardware", amountCents: 2399, txnDate: null, source: "upload", payerUserId: u.dev, status: "pending_review", aiConfidence: 0.42, note: "Blurry photo, confirm amount" },
    { key: "c8", vendor: "Chipotle Mexican Grill", amountCents: 6400, txnDate: "2026-09-29", source: "slack", payerUserId: u.dev, status: "pending_review", aiConfidence: 0.8, rawText: "paid 64 bucks at chipotle for me @sam" },
    { key: "c9", vendor: "Netflix", amountCents: 1549, txnDate: "2026-09-15", source: "manual", payerUserId: u.jules, status: "rejected", note: "Personal subscription" },
  ];

  const ids: Record<string, string> = {};
  for (const [i, d] of defs.entries()) {
    const { key, ...v } = d;
    const [row] = await db
      .insert(claims)
      .values({
        ...(v as typeof claims.$inferInsert),
        number: i + 1,
        workspaceId: ws.id,
        submitterId: v.payerUserId!,
        currency: "USD",
        aiJson: v.aiConfidence ? { vendor: v.vendor, amount_cents: v.amountCents, currency: "USD", txn_date: v.txnDate, confidence: v.aiConfidence, provider: "simulator", seeded: true } : null,
      })
      .returning();
    ids[key] = row.id;
    if (v.rawText)
      await db.insert(claimEvidence).values({ workspaceId: ws.id, claimId: row.id, kind: "message", source: v.source!, rawText: v.rawText, extractJson: row.aiJson, addedBy: row.submitterId, createdAt: row.createdAt });
  }
  await db.insert(claimSplits).values([
    { claimId: ids.c6, userId: u.sam, amountCents: 2134, shareBps: 3334 },
    { claimId: ids.c6, userId: u.dev, amountCents: 2133, shareBps: 3333 },
    { claimId: ids.c6, userId: u.maya, amountCents: 2133, shareBps: 3333 },
  ]);
  const { eq } = await import("drizzle-orm");
  await db
    .update(claims)
    .set({
      duplicateOfId: ids.c6,
      matchJson: {
        candidates: [{ id: ids.c6, number: 6, score: 0.95, reasons: ["same amount", "same date", "similar merchant"] }],
        rationale: "Likely duplicate of #6: same $64.00 Chipotle charge on Sep 29, submitted separately by Dev and Sam.",
      },
    })
    .where(eq(claims.id, ids.c8));

  const [paid] = await db
    .insert(batches)
    .values({
      workspaceId: ws.id, name: "August offsite", createdBy: u.maya, status: "completed", totalCents: 7710, currency: "USD",
      paypalPayoutBatchId: `SIM-AUG${tag.toUpperCase()}`, paypalMode: "simulated", approvedAt: new Date("2026-09-02T17:04:00Z"), approvedBy: u.maya,
      createdAt: new Date("2026-09-02T16:50:00Z"),
    })
    .returning();
  await db.insert(batchItems).values([
    { batchId: paid.id, claimId: ids.c1, receiverEmail: pp.sam, receiverName: "Sam Patel", amountCents: 3210, currency: "USD", status: "SUCCESS", paypalItemId: "SIMITEM-AUG1", transactionId: "SIMTX8AUG1" },
    { batchId: paid.id, claimId: ids.c2, receiverEmail: pp.rita, receiverName: "Rita Gomez", amountCents: 4500, currency: "USD", status: "SUCCESS", paypalItemId: "SIMITEM-AUG2", transactionId: "SIMTX8AUG2" },
  ]);
  const [sept] = await db
    .insert(batches)
    .values({ workspaceId: ws.id, name: "September offsites", createdBy: u.maya, status: "awaiting_approval", totalCents: 18650 + 4230 + 5875, currency: "USD" })
    .returning();
  await db.insert(batchItems).values([
    { batchId: sept.id, claimId: ids.c3, receiverEmail: pp.dev, receiverName: "Dev Kumar", amountCents: 18650, currency: "USD" },
    { batchId: sept.id, claimId: ids.c4, receiverEmail: pp.rita, receiverName: "Rita Gomez", amountCents: 4230, currency: "USD" },
    { batchId: sept.id, claimId: ids.c5, receiverEmail: pp.jules, receiverName: "Jules Moreau", amountCents: 5875, currency: "USD" },
  ]);

  await db.insert(auditEvents).values([
    { workspaceId: ws.id, actorId: u.maya, action: "workspace.created", entityType: "workspace", entityId: ws.id, metaJson: { demo: true }, createdAt: new Date("2026-08-27T09:00:00Z") },
    { workspaceId: ws.id, actorId: u.maya, action: "batch.approved", entityType: "batch", entityId: paid.id, metaJson: { total: "$77.10", items: 2 }, createdAt: new Date("2026-09-02T17:04:00Z") },
    { workspaceId: ws.id, actorId: null, action: "batch.completed", entityType: "batch", entityId: paid.id, metaJson: {}, createdAt: new Date("2026-09-02T17:05:00Z") },
    { workspaceId: ws.id, actorId: null, action: "claim.duplicate_suspected", entityType: "claim", entityId: ids.c8, metaJson: { of: "#6", score: 0.95 }, createdAt: new Date("2026-09-29T19:12:00Z") },
    { workspaceId: ws.id, actorId: u.maya, action: "batch.created", entityType: "batch", entityId: sept.id, metaJson: { claims: 3, total: "$287.55" }, createdAt: new Date("2026-09-30T10:00:00Z") },
  ]);

  return { workspaceId: ws.id, userId: u.maya };
}
