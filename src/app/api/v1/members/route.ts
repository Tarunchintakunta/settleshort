import { route } from "@/lib/api";
import { workspaceMembers } from "@/lib/claims";

// Members see names and roles; emails and PayPal receivers are for admins (and your own row).
export const GET = route(async (_req, ctx) => {
  const rows = await workspaceMembers(ctx.workspace.id);
  return ctx.isAdmin ? rows : rows.map((m) => (m.id === ctx.user.id ? m : { ...m, email: "", paypalEmail: null }));
});
