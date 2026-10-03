import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { fail, route } from "@/lib/api";
import { claimEvidence, db } from "@/lib/db";
import { receiptUrl } from "@/lib/s3";

// Redirects to a 5 minute presigned URL for one evidence file. Workspace-scoped.
export const GET = route<{ id: string; eid: string }>(async (_req, ctx, { id, eid }) => {
  const [e] = await db
    .select({ key: claimEvidence.fileKey, private: claimEvidence.privateFile, addedBy: claimEvidence.addedBy })
    .from(claimEvidence)
    .where(and(eq(claimEvidence.id, eid), eq(claimEvidence.claimId, id), eq(claimEvidence.workspaceId, ctx.workspace.id)));
  if (!e?.key) fail(404, "not_found", "No file for this evidence");
  // A personal statement file stays with the person who uploaded it; reviewers see only the lines they shared.
  if (e!.private && e!.addedBy !== ctx.user.id) fail(403, "private", "The uploader kept this statement private");
  const res = NextResponse.redirect(await receiptUrl(e!.key!), 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});
