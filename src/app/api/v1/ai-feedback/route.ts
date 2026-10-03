import { desc, eq } from "drizzle-orm";
import { route } from "@/lib/api";
import { aiFeedback, db } from "@/lib/db";
import { PROMPT_VERSION } from "@/lib/ai";

// Every human override of the AI or a rule, as JSON Lines: the seed of the extraction eval set (blueprint B8).
export const GET = route(
  async (_req, ctx) => {
    const rows = await db.select().from(aiFeedback).where(eq(aiFeedback.workspaceId, ctx.workspace.id)).orderBy(desc(aiFeedback.createdAt));
    const lines = rows.map((r) => JSON.stringify({ kind: r.kind, subject: r.subject, suggested: r.suggested, corrected: r.corrected, reason: r.reason, claim_id: r.claimId, at: r.createdAt, prompt_version: PROMPT_VERSION }));
    return new Response(lines.join("\n"), {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Content-Disposition": 'attachment; filename="settleshort-ai-feedback.jsonl"' },
    });
  },
  { admin: true },
);
