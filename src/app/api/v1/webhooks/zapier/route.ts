import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { errorResponse, fail } from "@/lib/api";
import { db, memberships, users, workspaces } from "@/lib/db";
import { claimFromText } from "@/lib/claims";

// Zapier "Slack new message" -> POST { workspace_slug, text, from_email } with header x-settleshort-secret.
export async function POST(req: Request) {
  try {
    const secret = process.env.ZAPIER_WEBHOOK_SECRET;
    const got = req.headers.get("x-settleshort-secret") ?? "";
    if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) fail(401, "unauthorized", "Bad secret");
    const input = z
      .object({ workspace_slug: z.string(), text: z.string().trim().min(3).max(2000), from_email: z.string().email().optional() })
      .parse(await req.json());
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, input.workspace_slug));
    if (!ws) fail(404, "not_found", "Unknown workspace");
    const members = await db
      .select({ userId: memberships.userId, role: memberships.role, email: users.email })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.workspaceId, ws.id)));
    const submitter = members.find((m) => m.email === input.from_email?.toLowerCase()) ?? members.find((m) => m.role === "owner")!;
    return Response.json(await claimFromText(ws.id, submitter.userId, input.text, "slack"));
  } catch (e) {
    return errorResponse(e);
  }
}
