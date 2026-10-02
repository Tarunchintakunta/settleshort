import "server-only";
import { auditEvents, db } from "./db";

export async function audit(
  workspaceId: string,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditEvents).values({ workspaceId, actorId, action, entityType, entityId, metaJson: meta ?? null });
}
