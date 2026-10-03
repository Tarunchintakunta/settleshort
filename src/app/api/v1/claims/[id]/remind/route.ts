import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { claims, db } from "@/lib/db";
import { notify, openBlockers } from "@/lib/escalations";

// A reminder that says exactly what is blocking the claim and the one action that unblocks it.
export const POST = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
  if (!c) fail(404, "not_found", "Claim not found");
  const hit = (await openBlockers(ctx.workspace)).find((b) => b.claim.id === id);
  if (!hit) fail(409, "nothing_blocking", "Nothing is blocking this claim");
  const text = `Claim #${c!.number} ${c!.vendor || ""} is waiting on the ${hit!.blocker.waitingOn}: ${hit!.blocker.why}. Smallest next step: ${hit!.blocker.action}.`;
  const sent = await notify(text);
  await audit(ctx.workspace.id, ctx.user.id, "claim.reminded", "claim", id, { waiting_on: hit!.blocker.waitingOn, why: hit!.blocker.why, action: hit!.blocker.action, delivered: sent ? "slack" : "in-app" });
  return { text, delivered: sent ? "slack" : "in-app" };
});
