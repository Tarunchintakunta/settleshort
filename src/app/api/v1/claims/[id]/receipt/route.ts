import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, route } from "@/lib/api";
import { claims, db } from "@/lib/db";
import { receiptUrl } from "@/lib/s3";

// Redirects to a presigned S3 GET URL (5 minutes). Workspace-scoped, so only members can mint one.
export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [c] = await db
    .select({ key: claims.receiptKey })
    .from(claims)
    .where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c?.key) fail(404, "not_found", "No receipt for this claim");
  const res = NextResponse.redirect(await receiptUrl(c!.key!), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});
