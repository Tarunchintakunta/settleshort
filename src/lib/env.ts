import { z } from "zod";

// Env contract. Validated once at server start (src/instrumentation.ts) so a bad deploy fails loudly,
// not halfway through a payout. Optional integrations are all-or-nothing: half a config is an error.
const opt = z.string().trim().min(1).optional();

const Env = z
  .object({
    NODE_ENV: z.string().default("development"),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
    SESSION_SECRET: opt,
    OPENAI_API_KEY: opt,
    ANTHROPIC_API_KEY: opt,
    PAYPAL_CLIENT_ID: opt,
    PAYPAL_CLIENT_SECRET: opt,
    PAYPAL_API_BASE: z.string().url().refine((u) => !u.includes("api-m.paypal.com"), "live PayPal host refused; use https://api-m.sandbox.paypal.com").optional(),
    PAYPAL_WEBHOOK_ID: opt,
    AWS_REGION: opt,
    S3_BUCKET_NAME: opt,
    SMTP_HOST: opt,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: opt,
    SMTP_PASS: opt,
    MAIL_FROM: opt,
  })
  .superRefine((e, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (e.NODE_ENV === "production" && (!e.SESSION_SECRET || e.SESSION_SECRET.length < 32))
      issue("SESSION_SECRET", "required in production, at least 32 chars (openssl rand -hex 32)");
    if (!!e.PAYPAL_CLIENT_ID !== !!e.PAYPAL_CLIENT_SECRET) issue("PAYPAL_CLIENT_SECRET", "set both PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, or neither");
    if (!!e.AWS_REGION !== !!e.S3_BUCKET_NAME) issue("S3_BUCKET_NAME", "set both AWS_REGION and S3_BUCKET_NAME, or neither");
    const smtp = [e.SMTP_HOST, e.SMTP_USER, e.SMTP_PASS, e.MAIL_FROM];
    if (smtp.some(Boolean) && !smtp.every(Boolean)) issue("SMTP_HOST", "set SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM together, or none");
  });

export type Env = z.infer<typeof Env>;

/** Throws one readable error listing every bad variable. Never echoes values. */
export function validateEnv(src: Record<string, string | undefined> = process.env): Env {
  const r = Env.safeParse(Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v === "" ? undefined : v])));
  if (r.success) return r.data;
  const lines = r.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join("\n")}\nSee .env.example.`);
}
