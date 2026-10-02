import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { batches, batchItems, db } from "@/lib/db";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [batch] = await db.select().from(batches).where(and(eq(batches.id, id), eq(batches.workspaceId, ctx.workspace.id)));
  if (!batch) fail(404, "not_found", "Batch not found");
  return { ...batch, items: await db.select().from(batchItems).where(eq(batchItems.batchId, id)) };
});
