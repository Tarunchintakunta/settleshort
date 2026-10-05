import { route } from "@/lib/api";
import { navCounts } from "@/lib/nav-counts";

// Re-read on every client navigation so badges never go stale behind a cached layout.
export const GET = route(async (_req, ctx) => navCounts(ctx.workspace.id, ctx.user.id));
