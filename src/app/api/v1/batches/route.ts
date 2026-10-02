import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { createBatch } from "@/lib/batches";
import { batches, db } from "@/lib/db";

export const GET = route(async (_req, ctx) =>
  db.select().from(batches).where(eq(batches.workspaceId, ctx.workspace.id)).orderBy(desc(batches.createdAt)),
);

export const POST = route(
  async (req, ctx) => {
    const { claimIds, name } = await body(req, z.object({ claimIds: z.array(z.string().uuid()).min(1).max(500), name: z.string().max(100).optional() }));
    return createBatch(ctx.workspace.id, ctx.user.id, claimIds, name);
  },
  { admin: true },
);
