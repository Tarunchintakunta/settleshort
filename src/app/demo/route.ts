import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { createDemoWorkspace, purgeOldDemoWorkspaces } from "@/lib/seed";

// One click: a fresh, isolated sample workspace (fake company, fake people), signed in as its owner.
// It is never connected to a real workspace, and demo workspaces older than a day are deleted on the next visit.
export async function GET() {
  await purgeOldDemoWorkspaces().catch((e) => console.warn("[demo] purge skipped:", e instanceof Error ? e.message : e));
  const { workspaceId, userId } = await createDemoWorkspace();
  await startSession(userId, workspaceId);
  redirect("/app");
}
