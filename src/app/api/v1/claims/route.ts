import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { route } from "@/lib/api";
import { claims, CLAIM_STATUSES, db, type ClaimStatus } from "@/lib/db";

export const GET = route(async (req, ctx) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  const where: SQL[] = [eq(claims.workspaceId, ctx.workspace.id)];
  if (status && CLAIM_STATUSES.includes(status as ClaimStatus)) where.push(eq(claims.status, status as ClaimStatus));
  if (q) where.push(or(ilike(claims.vendor, `%${q}%`), ilike(claims.note, `%${q}%`))!);
  return db.select().from(claims).where(and(...where)).orderBy(desc(claims.number));
});
