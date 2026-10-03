import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { aiProvider, explainMatch, parseClaimText, PROMPT_VERSION } from "./ai";
import { revalidateApproval } from "./approvals";
import { audit } from "./audit";
import { claimEvidence, claims, claimSplits, db, memberships, users, type EvidenceKind } from "./db";
import { DUPLICATE_THRESHOLD, findMatches } from "./matching";
import { formatMoney, splitEven } from "./money";

export const LOW_CONFIDENCE = 0.55;

export type NewClaim = {
  id?: string;
  source: "upload" | "slack" | "email" | "manual";
  vendor: string;
  amountCents: number;
  currency: string;
  txnDate: string | null;
  tipCents?: number;
  taxCents?: number;
  note?: string;
  rawText?: string | null;
  receiptKey?: string | null;
  receiptMime?: string | null;
  receiptName?: string | null;
  aiJson?: unknown;
  aiConfidence?: number | null;
  payerUserId: string;
  splitUserIds?: string[];
};

export async function workspaceMembers(workspaceId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: memberships.role, paypalEmail: memberships.paypalReceiverEmail, membershipId: memberships.id, canRelease: memberships.canRelease })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, workspaceId))
    .orderBy(users.name);
}

export const handleOf = (name: string) => name.split(/\s+/)[0].toLowerCase();

export async function createClaim(workspaceId: string, actorId: string, c: NewClaim) {
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${claims.number}), 0) + 1` })
    .from(claims)
    .where(eq(claims.workspaceId, workspaceId));

  const [claim] = await db
    .insert(claims)
    .values({
      ...c,
      tipCents: c.tipCents ?? 0,
      taxCents: c.taxCents ?? 0,
      note: c.note ?? "",
      number: Number(next),
      workspaceId,
      submitterId: actorId,
      status: "pending_review", // every claim waits for a human approval; AI never approves
    })
    .returning();

  if (c.receiptKey || c.rawText) {
    await db.insert(claimEvidence).values({
      workspaceId,
      claimId: claim.id,
      kind: c.receiptKey ? "receipt" : "message",
      source: c.source,
      fileKey: c.receiptKey ?? null,
      fileMime: c.receiptMime ?? null,
      fileName: c.receiptName ?? null,
      rawText: c.rawText ?? null,
      extractJson: c.aiJson ?? null,
      addedBy: actorId,
    });
  }

  if (c.splitUserIds?.length) {
    const parts = splitEven(c.amountCents, c.splitUserIds.length);
    await db.insert(claimSplits).values(
      c.splitUserIds.map((userId, i) => ({ claimId: claim.id, userId, amountCents: parts[i], shareBps: Math.round(10000 / c.splitUserIds!.length) })),
    );
  }

  await audit(workspaceId, actorId, "claim.created", "claim", claim.id, {
    number: claim.number,
    source: c.source,
    amount: formatMoney(c.amountCents, c.currency),
    ai_confidence: c.aiConfidence ?? null,
    prompt_version: c.aiJson ? PROMPT_VERSION : undefined,
  });

  return runMatching(workspaceId, claim.id);
}

/** Rules-first dedupe; a strong match parks the claim in review with an AI-written rationale. */
export async function runMatching(workspaceId: string, claimId: string) {
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.workspaceId, workspaceId)));
  const others = await db
    .select()
    .from(claims)
    .where(and(eq(claims.workspaceId, workspaceId), ne(claims.id, claimId), ne(claims.status, "rejected")));
  const candidates = findMatches(claim, others);
  const top = candidates[0];
  if (!top || top.score < DUPLICATE_THRESHOLD) {
    const [updated] = await db.update(claims).set({ matchJson: { candidates }, duplicateOfId: null, updatedAt: new Date() }).where(eq(claims.id, claimId)).returning();
    return updated;
  }
  const other = others.find((o) => o.id === top.id)!;
  const day = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "an unknown date");
  const rationale = await explainMatch(
    `#${claim.number} ${claim.vendor}, ${formatMoney(claim.amountCents, claim.currency)} on ${day(claim.txnDate)}`,
    `#${other.number} ${other.vendor}, ${formatMoney(other.amountCents, other.currency)} on ${day(other.txnDate)}`,
    top.reasons,
    top.score,
  );
  const [updated] = await db
    .update(claims)
    .set({
      duplicateOfId: top.id,
      matchJson: { candidates, rationale },
      status: claim.status === "matched" ? "pending_review" : claim.status,
      updatedAt: new Date(),
    })
    .where(eq(claims.id, claimId))
    .returning();
  await audit(workspaceId, null, "claim.duplicate_suspected", "claim", claimId, { of: `#${other.number}`, score: top.score, rationale });
  return updated;
}

export async function getClaimsByIds(workspaceId: string, ids: string[]) {
  if (!ids.length) return [];
  return db.select().from(claims).where(and(eq(claims.workspaceId, workspaceId), inArray(claims.id, ids)));
}

export async function claimFromText(workspaceId: string, userId: string, text: string, source: "manual" | "slack" | "email") {
  const members = await workspaceMembers(workspaceId);
  const parsed = await parseClaimText(
    text,
    members.map((m) => ({ id: m.id, name: m.name, handle: handleOf(m.name) })),
    new Date().toISOString().slice(0, 10),
  );
  const byName = (n: string) => members.find((m) => m.name.toLowerCase() === n.toLowerCase() || handleOf(m.name) === n.toLowerCase());
  const payer = (parsed.payer_name && byName(parsed.payer_name)?.id) || userId;
  const split = new Set(parsed.payee_names.map((n) => byName(n)?.id).filter(Boolean) as string[]);
  if (parsed.includes_payer) split.add(payer);
  const claim = await createClaim(workspaceId, userId, {
    source,
    vendor: parsed.vendor ?? "",
    amountCents: parsed.amount_cents,
    currency: parsed.currency,
    txnDate: parsed.txn_date,
    note: parsed.note,
    rawText: text,
    aiJson: { ...parsed, provider: aiProvider() },
    aiConfidence: parsed.confidence,
    payerUserId: payer,
    splitUserIds: [...split],
  });
  await audit(workspaceId, userId, "ai.parse_ok", "claim", claim.id, { provider: aiProvider(), confidence: parsed.confidence });
  return claim;
}

export type EvidenceExtract = { vendor?: string | null; amount_cents?: number; currency?: string; txn_date?: string | null };

/**
 * Attaches another piece of proof to an existing claim. Fills only blank claim fields from it;
 * conflicting values are left for a human (see findContradictions).
 */
export async function addEvidence(
  workspaceId: string,
  actorId: string,
  claim: typeof claims.$inferSelect,
  e: { kind: EvidenceKind; source: "upload" | "slack" | "email" | "manual"; fileKey?: string; fileMime?: string; fileName?: string; rawText?: string | null; extract: EvidenceExtract & Record<string, unknown> },
) {
  const [row] = await db
    .insert(claimEvidence)
    .values({ workspaceId, claimId: claim.id, kind: e.kind, source: e.source, fileKey: e.fileKey, fileMime: e.fileMime, fileName: e.fileName, rawText: e.rawText ?? null, extractJson: e.extract, addedBy: actorId })
    .returning();
  const x = e.extract;
  const fill = {
    ...(!claim.vendor && x.vendor ? { vendor: x.vendor } : {}),
    ...(!claim.amountCents && x.amount_cents ? { amountCents: x.amount_cents, currency: x.currency ?? claim.currency } : {}),
    ...(!claim.txnDate && x.txn_date ? { txnDate: x.txn_date } : {}),
  };
  if (Object.keys(fill).length) await db.update(claims).set({ ...fill, updatedAt: new Date() }).where(eq(claims.id, claim.id));
  await audit(workspaceId, actorId, "claim.evidence_added", "claim", claim.id, { kind: e.kind, filled: Object.keys(fill) });
  await revalidateApproval(workspaceId, claim.id, actorId);
  return row;
}
