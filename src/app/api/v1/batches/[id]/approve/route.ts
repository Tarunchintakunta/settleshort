import { z } from "zod";
import { body, route } from "@/lib/api";
import { approveBatch } from "@/lib/batches";

// Human gate: admin role + typed confirmation. Never called by AI or automation.
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    await body(req, z.object({ confirm: z.string().trim().toUpperCase().pipe(z.literal("APPROVE", { error: 'Type "approve" to confirm' })) }));
    return approveBatch(ctx.workspace.id, ctx.user.id, id);
  },
  { admin: true },
);
