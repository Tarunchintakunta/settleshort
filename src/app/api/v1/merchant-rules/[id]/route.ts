import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, merchantMappings } from "@/lib/db";

export const DELETE = route<{ id: string }>(
  async (_req, ctx, { id }) => {
    const [gone] = await db.delete(merchantMappings).where(and(eq(merchantMappings.id, id), eq(merchantMappings.workspaceId, ctx.workspace.id))).returning();
    if (!gone) fail(404, "not_found", "Rule not found");
    await audit(ctx.workspace.id, ctx.user.id, "merchant_rule.deleted", "merchant_mapping", gone.merchantKey, { merchant: gone.merchantLabel, category: gone.category });
    return { ok: true };
  },
  { admin: true },
);
