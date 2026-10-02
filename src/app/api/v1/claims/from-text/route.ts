import { z } from "zod";
import { body, route } from "@/lib/api";
import { claimFromText } from "@/lib/claims";

export const POST = route(async (req, ctx) => {
  const { text } = await body(req, z.object({ text: z.string().trim().min(3).max(2000) }));
  return claimFromText(ctx.workspace.id, ctx.user.id, text, "manual");
});
