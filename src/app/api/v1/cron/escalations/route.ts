import { timingSafeEqual } from "node:crypto";
import { db, workspaces } from "@/lib/db";
import { runEscalations } from "@/lib/escalations";

// Vercel Cron (daily, see vercel.json): moves overdue approvals up the chain in every workspace.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return Response.json({ error: { code: "unauthorized", message: "Bad secret" } }, { status: 401 });
  let moved = 0;
  for (const ws of await db.select().from(workspaces)) moved += await runEscalations(ws);
  return Response.json({ ok: true, escalated: moved });
}
