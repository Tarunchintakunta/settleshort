import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { claims, db } from "@/lib/db";
import { presignUpload } from "@/lib/intake";

// Step 1 of attaching a file to an existing claim.
export const POST = route<{ id: string }>(async (req, ctx, { id }) => {
  const [claim] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!claim) fail(404, "not_found", "Claim not found");
  if (!ctx.isAdmin && claim.submitterId !== ctx.user.id) fail(403, "forbidden", "You can only add evidence to your own claims");
  return presignUpload(ctx.workspace.id, id, await req.json().catch(() => ({})));
});
