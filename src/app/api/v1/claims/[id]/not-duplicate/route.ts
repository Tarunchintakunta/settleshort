import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { body, fail, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { aiFeedback, claims, db } from "@/lib/db";

// A human decides two claims are different expenses. The pair is never suggested again for this claim.
export const POST = route<{ id: string }>(
  async (req, ctx, { id }) => {
    const { of, reason } = await body(req, z.object({ of: z.string().uuid(), reason: z.string().trim().max(300).optional() }));
    const [c] = await db.select().from(claims).where(and(eq(claims.id, id), eq(claims.workspaceId, ctx.workspace.id)));
    if (!c) fail(404, "not_found", "Claim not found");
    const m = (c!.matchJson ?? {}) as { dismissed?: string[]; candidates?: { id: string }[] };
    const dismissed = [...new Set([...(m.dismissed ?? []), of])];
    const [updated] = await db
      .update(claims)
      .set({ matchJson: { ...m, dismissed, candidates: (m.candidates ?? []).filter((x) => !dismissed.includes(x.id)), ambiguous: false }, duplicateOfId: c!.duplicateOfId === of ? null : c!.duplicateOfId, updatedAt: new Date() })
      .where(eq(claims.id, id))
      .returning();
    await audit(ctx.workspace.id, ctx.user.id, "claim.duplicate_dismissed", "claim", id, { of, reason });
    await db.insert(aiFeedback).values({ workspaceId: ctx.workspace.id, claimId: id, kind: "duplicate", subject: of, suggested: "duplicate", corrected: "different expense", reason, actorId: ctx.user.id });
    return updated;
  },
  { admin: true },
);
