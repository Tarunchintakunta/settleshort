import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { riskSignalsFor } from "@/lib/approvals";
import { claims, db } from "@/lib/db";

// Soft fraud signals for one claim. Computed from current claims, so they're never stale.
export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [c] = await db.select({ id: claims.id }).from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  return { signals: (await riskSignalsFor(ctx.workspace.id, [id])).get(id) ?? [] };
});
