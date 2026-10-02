import { aiProvider } from "@/lib/ai";
import { paypalMode } from "@/lib/paypal";

export const GET = () => Response.json({ ok: true, paypal: paypalMode(), ai: aiProvider() });
