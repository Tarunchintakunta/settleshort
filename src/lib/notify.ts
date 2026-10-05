import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { batches, batchItems, claims, db, memberships, notifications, users } from "./db";
import { formatMoney } from "./money";
import { claimTitle } from "./title";

// `alsoActor`: failures and escalations reach the person who triggered them too; they still need to act.
type Note = { userIds: string[]; title: string; body?: string; href?: string; alsoActor?: boolean };

// Email is optional: with no SMTP config it is skipped and said once in the log.
let transport: Transporter | null | undefined;
function mailer() {
  if (transport !== undefined) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    console.info("[notify] SMTP not configured; email notifications are off (in-app only).");
    return (transport = null);
  }
  const port = Number(SMTP_PORT ?? 465);
  return (transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 5000 }));
}

const admins = async (workspaceId: string) =>
  (await db.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.workspaceId, workspaceId), ne(memberships.role, "member")))).map((r) => r.id);

/** Who hears about an audit event, and what they read. Null = nobody. */
async function route(workspaceId: string, action: string, entityType: string, entityId: string | null): Promise<Note | null> {
  if (!entityId) return null;
  if (entityType === "claim") {
    const [c] = await db.select().from(claims).where(eq(claims.id, entityId));
    if (!c) return null;
    const href = `/app/claims/${c.id}`;
    const label = `#${c.number} ${c.vendor || claimTitle(c)}${c.vendor ? ` (${formatMoney(c.amountCents, c.currency)})` : ""}`;
    if (action === "claim.created") return { userIds: await admins(workspaceId), title: `New claim to review: ${label}`, href };
    if (action === "claim.duplicate_suspected") return { userIds: await admins(workspaceId), title: `Possible duplicate: ${label}`, href };
    if (action === "claim.approved") return { userIds: [...new Set([c.payerUserId, c.submitterId])], title: `Approved: ${label}`, body: "It will be paid in the next PayPal batch.", href };
    if (action === "claim.escalated")
      return { userIds: [...new Set([...(c.escalatedToUserId ? [c.escalatedToUserId] : []), ...(await admins(workspaceId))])], title: `Overdue approval escalated: ${label}`, body: "This claim has waited too long for an approver.", href, alsoActor: true };
    if (action === "claim.rejected") return { userIds: [c.submitterId], title: `Rejected: ${label}`, href };
    if (action === "claim.fix_requested") return { userIds: [c.submitterId], title: `Fix requested on ${label}`, href };
    return null;
  }
  if (entityType === "batch" && (action === "payout.failed" || action === "payout.uncertain")) {
    const [b] = await db.select().from(batches).where(eq(batches.id, entityId));
    if (!b) return null;
    const amount = formatMoney(b.totalCents, b.currency);
    return action === "payout.failed"
      ? { userIds: await admins(workspaceId), title: `Payout failed: ${b.name} (${amount})`, body: "PayPal rejected the batch. Nothing was paid; the claims are back in the queue.", href: `/app/batches/${b.id}`, alsoActor: true }
      : { userIds: await admins(workspaceId), title: `PayPal didn't answer: ${b.name} (${amount})`, body: "Verify the batch with PayPal before doing anything else.", href: `/app/batches/${b.id}`, alsoActor: true };
  }
  if (entityType === "batch_item" && action.startsWith("payout.item.")) {
    const [i] = await db.select().from(batchItems).where(eq(batchItems.id, entityId));
    if (!i) return null;
    const status = action.slice("payout.item.".length);
    const amount = formatMoney(i.amountCents, i.currency);
    const href = `/app/claims/${i.claimId}`;
    const receiver = i.receiverUserId ? [i.receiverUserId] : [];
    if (status === "success") return { userIds: receiver, title: `You were paid ${amount} via PayPal`, href };
    if (["failed", "unclaimed", "returned", "blocked", "refunded", "reversed"].includes(status))
      return { userIds: [...new Set([...receiver, ...(await admins(workspaceId))])], title: `PayPal payout ${status}: ${amount} to ${i.receiverName}`, body: "Check the PayPal address and retry from a new batch.", href, alsoActor: true };
  }
  return null;
}

/** Called from audit(). Never throws: a notification problem must not break the action it reports. */
export async function notifyFor(workspaceId: string, actorId: string | null, action: string, entityType: string, entityId: string | null) {
  try {
    const n = await route(workspaceId, action, entityType, entityId);
    const userIds = n?.userIds.filter((u) => n.alsoActor || u !== actorId) ?? [];
    if (!n || !userIds.length) return;
    await db.insert(notifications).values(userIds.map((userId) => ({ workspaceId, userId, title: n.title, body: n.body ?? "", href: n.href ?? null })));
    const mail = mailer();
    if (!mail) return;
    const to = await db.select({ email: users.email }).from(users).where(inArray(users.id, userIds));
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    for (const { email } of to) {
      if (email.endsWith("@demo.settleshort.app")) continue; // seeded people have no real inbox
      await mail.sendMail({ from: process.env.MAIL_FROM, to: email, subject: n.title, text: `${n.body ?? ""}\n\n${n.href ? base + n.href : ""}`.trim() }).catch((e) => console.warn("[notify] email failed:", e instanceof Error ? e.message : "unknown"));
    }
  } catch (e) {
    console.warn("[notify] skipped:", e instanceof Error ? e.message : "unknown");
  }
}
