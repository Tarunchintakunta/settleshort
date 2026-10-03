import { z } from "zod";
import { route } from "@/lib/api";
import { evidencePackCsv } from "@/lib/export";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Accountant-ready CSV for a period: categories, approvals, adjustments, payouts and unresolved exceptions together.
export const GET = route(
  async (req, ctx) => {
    const url = new URL(req.url);
    const from = date.parse(url.searchParams.get("from"));
    const to = date.parse(url.searchParams.get("to"));
    const body = await evidencePackCsv(ctx.workspace.id, from, to, process.env.NEXT_PUBLIC_APP_URL ?? url.origin);
    return new Response(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="settleshort-evidence-${from}-to-${to}.csv"` },
    });
  },
  { admin: true },
);
