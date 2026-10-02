import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { aiJobs, db } from "@/lib/db";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [job] = await db.select().from(aiJobs).where(and(eq(aiJobs.id, id), eq(aiJobs.workspaceId, ctx.workspace.id)));
  if (!job) fail(404, "not_found", "Job not found");
  return job;
});
