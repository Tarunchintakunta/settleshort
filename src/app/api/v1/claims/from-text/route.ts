import { z } from "zod";
import { body, route } from "@/lib/api";
import { claimFromText } from "@/lib/claims";

export const POST = route(async (req, ctx) => {
  // timeZone: the browser's IANA zone, so "today"/"yesterday" mean the user's day, not UTC's.
  const { text, timeZone } = await body(req, z.object({ text: z.string().trim().min(3).max(2000), timeZone: z.string().max(64).optional() }));
  return claimFromText(ctx.workspace.id, ctx.user.id, text, "manual", timeZone);
});
