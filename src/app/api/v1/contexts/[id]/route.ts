import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { contexts, db } from "@/lib/db";

export const DELETE = route<{ id: string }>(
  async (_req, ctx, { id }) => {
    const [gone] = await db.delete(contexts).where(and(eq(contexts.id, id), eq(contexts.workspaceId, ctx.workspace.id))).returning();
    if (!gone) fail(404, "not_found", "Context not found");
    return { ok: true };
  },
  { admin: true },
);
