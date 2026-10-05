import "server-only";
import { and, count, eq, isNull } from "drizzle-orm";
import { batches, claims, db, notifications } from "./db";

/** The one source for sidebar badges. The claims tabs count the same `pending_review` status. */
export async function navCounts(workspaceId: string, userId: string) {
  const [[review], [awaiting], [unread]] = await Promise.all([
    db.select({ n: count() }).from(claims).where(and(eq(claims.workspaceId, workspaceId), eq(claims.status, "pending_review"))),
    db.select({ n: count() }).from(batches).where(and(eq(batches.workspaceId, workspaceId), eq(batches.status, "awaiting_approval"))),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId), isNull(notifications.readAt))),
  ]);
  return { "/app/claims": review.n, "/app/batches": awaiting.n, "/app/notifications": unread.n };
}
