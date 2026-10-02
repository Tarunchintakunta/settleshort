import { and, eq } from "drizzle-orm";
import { fail, route } from "@/lib/api";
import { db, receipts } from "@/lib/db";

export const GET = route<{ id: string }>(async (_req, ctx, { id }) => {
  const [r] = await db.select().from(receipts).where(and(eq(receipts.id, id), eq(receipts.workspaceId, ctx.workspace.id)));
  if (!r) fail(404, "not_found", "Receipt not found");
  return new Response(Buffer.from(r.dataB64, "base64"), {
    headers: { "Content-Type": r.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
});
