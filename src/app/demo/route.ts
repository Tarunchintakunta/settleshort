import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { createDemoWorkspace } from "@/lib/seed";

// One click: fresh isolated Acme Labs workspace, signed in as Maya (owner/admin).
export async function GET() {
  const { workspaceId, userId } = await createDemoWorkspace();
  await startSession(userId, workspaceId);
  redirect("/app");
}
