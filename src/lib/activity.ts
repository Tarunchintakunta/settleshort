import "server-only";
import { desc, eq } from "drizzle-orm";
import { auditEvents, db, users } from "./db";

export async function recentActivity(workspaceId: string, limit = 200) {
  return db
    .select({ e: auditEvents, actor: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(eq(auditEvents.workspaceId, workspaceId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

const VERBS: Record<string, string> = {
  "workspace.created": "created the workspace",
  "workspace.settings_updated": "updated workspace settings",
  "claim.created": "submitted a claim",
  "claim.edited": "edited a claim",
  "claim.marked_ready": "marked a claim ready",
  "claim.rejected": "rejected a claim",
  "claim.merged": "merged duplicate claims",
  "claim.duplicate_suspected": "flagged a likely duplicate",
  "ai.extract_ok": "extracted a receipt with AI",
  "ai.extract_failed": "failed to read a receipt",
  "ai.parse_ok": "parsed a message with AI",
  "batch.created": "created a settlement batch",
  "batch.approved": "approved a batch for payout",
  "payout.created": "sent the batch to PayPal",
  "payout.failed": "PayPal rejected the payout",
  "batch.completed": "batch fully paid",
  "batch.partial": "batch partially paid",
  "batch.failed": "batch failed",
  "member.invited": "invited a member",
  "member.updated": "updated a member",
};

export function describe(action: string) {
  if (VERBS[action]) return VERBS[action];
  const m = action.match(/^payout\.item\.(\w+)/);
  if (m) return `payout item ${m[1].toUpperCase()}`;
  return action;
}

export function timeAgo(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
