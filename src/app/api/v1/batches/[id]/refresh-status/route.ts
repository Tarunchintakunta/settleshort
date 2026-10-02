import { route } from "@/lib/api";
import { refreshBatch } from "@/lib/batches";

export const POST = route<{ id: string }>(async (_req, ctx, { id }) => refreshBatch(ctx.workspace.id, id, ctx.user.id));
