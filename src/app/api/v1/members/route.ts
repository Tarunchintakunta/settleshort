import { route } from "@/lib/api";
import { workspaceMembers } from "@/lib/claims";

export const GET = route(async (_req, ctx) => workspaceMembers(ctx.workspace.id));
