import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { body, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { contexts, db } from "@/lib/db";

export const GET = route(async (_req, ctx) => db.select().from(contexts).where(eq(contexts.workspaceId, ctx.workspace.id)).orderBy(desc(contexts.startsOn)));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Admins record real business context; purposes are only ever suggested from these.
export const POST = route(
  async (req, ctx) => {
    const input = await body(req, z.object({ kind: z.enum(["customer_meeting", "project", "event"]), name: z.string().trim().min(2).max(120), startsOn: date, endsOn: date.nullable().optional() }));
    const [row] = await db.insert(contexts).values({ ...input, workspaceId: ctx.workspace.id, createdBy: ctx.user.id }).returning();
    await audit(ctx.workspace.id, ctx.user.id, "context.created", "context", row.id, { kind: row.kind, name: row.name });
    return row;
  },
  { admin: true },
);
