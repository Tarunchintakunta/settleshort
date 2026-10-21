import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { startSession } from "@/lib/auth";
import { createDemoWorkspace, purgeOldDemoWorkspaces } from "@/lib/seed";

// One click: a fresh, isolated sample workspace (fake company, fake people), signed in as its owner.
// It is never connected to a real workspace, and demo workspaces older than a day are deleted on the next visit.
const DEMO_TTL_MS = 4 * 3_600_000;
const LIMIT = { perWindow: 10, windowMs: 10 * 60_000 };
// ponytail: per-instance memory, so the cap is per serverless instance; move to the DB if abuse shows up.
const hits = new Map<string, number[]>();

export async function GET() {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < LIMIT.windowMs);
  if (recent.length >= LIMIT.perWindow) return new Response("Too many demo workspaces from this address. Try again in a few minutes.", { status: 429, headers: { "Retry-After": "600" } });
  hits.set(ip, [...recent, now]);
  await purgeOldDemoWorkspaces().catch((e) => console.warn("[demo] purge skipped:", e instanceof Error ? e.message : e));
  const { workspaceId, userId } = await createDemoWorkspace();
  await startSession(userId, workspaceId, DEMO_TTL_MS);
  redirect("/app");
}
