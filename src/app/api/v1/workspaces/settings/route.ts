import { eq } from "drizzle-orm";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { db, workspaces } from "@/lib/db";

export const PATCH = route(
  async (req, ctx) => {
    const input = await body(
      req,
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        maxSingleCents: z.number().int().positive().max(10_000_000).optional(),
        maxBatchCents: z.number().int().positive().max(100_000_000).optional(),
      }),
    );
    const [ws] = await db.update(workspaces).set(input).where(eq(workspaces.id, ctx.workspace.id)).returning();
    await audit(ctx.workspace.id, ctx.user.id, "workspace.settings_updated", "workspace", ws.id, input);
    return ws;
  },
  { admin: true },
);
