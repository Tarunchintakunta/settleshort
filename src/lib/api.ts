import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCtx } from "./auth";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string) => {
  throw new ApiError(status, code, message);
};

type WsCtx = NonNullable<Awaited<ReturnType<typeof getCtx>>> & {
  workspace: NonNullable<NonNullable<Awaited<ReturnType<typeof getCtx>>>["workspace"]>;
};

/** Wraps a route handler: auth + workspace required, uniform error shape `{ error: { code, message } }`. */
export function route<P = Record<string, string>>(
  handler: (req: Request, ctx: WsCtx, params: P) => Promise<unknown>,
  opts: { admin?: boolean } = {},
) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const ctx = await getCtx();
      if (!ctx) fail(401, "unauthorized", "Sign in required");
      if (!ctx!.workspace) fail(403, "no_workspace", "Create a workspace first");
      if (opts.admin && !ctx!.isAdmin) fail(403, "forbidden", "Admins only");
      const out = await handler(req, ctx as WsCtx, await params);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json({ error: { code: "invalid_input", message: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") } }, { status: 400 });
  console.error(e);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await req.json().catch(() => ({})));
}
