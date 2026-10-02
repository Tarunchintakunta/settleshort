import { route } from "@/lib/api";
import { aiProvider } from "@/lib/ai";
import { paypalMode } from "@/lib/paypal";

export const GET = route(async (_req, ctx) => ({ ...ctx.workspace, role: ctx.role, paypal: paypalMode(), ai: aiProvider() }));
