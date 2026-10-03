import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

// Claude provider (vision + PDF + text) with structured outputs. Used when ANTHROPIC_API_KEY is set.
// Plain schemas here (no transforms); results are re-validated by the strict schemas in ai.ts.

const MODEL = () => process.env.AI_MODEL_CLAUDE ?? "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const ReceiptOut = z.object({
  vendor: z.string(),
  amount_cents: z.number().int(),
  currency: z.string(),
  txn_date: z.string().nullable(),
  tax_cents: z.number().int(),
  tip_cents: z.number().int(),
  line_items: z.array(z.object({ name: z.string(), amount_cents: z.number().int() })),
  payment_last4: z.string().nullable(),
  confidence: z.number(),
  notes: z.string(),
  evidence: z.object({ vendor: z.string(), total: z.string(), date: z.string(), tax: z.string(), tip: z.string() }),
  field_confidence: z.object({ vendor: z.number(), amount: z.number(), date: z.number(), currency: z.number(), tax: z.number(), tip: z.number() }),
});

const TextOut = z.object({
  amount_cents: z.number().int(),
  currency: z.string(),
  vendor: z.string().nullable(),
  payee_names: z.array(z.string()),
  payer_name: z.string().nullable(),
  includes_payer: z.boolean(),
  txn_date: z.string().nullable(),
  note: z.string(),
  confidence: z.number(),
  field_confidence: z.object({ amount: z.number(), vendor: z.number(), date: z.number(), currency: z.number(), payees: z.number() }),
});

async function parse<T extends z.ZodType>(schema: T, system: string, content: Anthropic.ContentBlockParam[]) {
  const res = await anthropic().messages.parse({
    model: MODEL(),
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(schema), effort: "low" },
    system,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to read this file");
  if (!res.parsed_output) throw new Error("The model returned no structured output");
  return res.parsed_output as z.infer<T>;
}

export async function claudeReceipt(file: Buffer, mime: string, system: string) {
  const data = file.toString("base64");
  const block: Anthropic.ContentBlockParam =
    mime === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/webp", data } };
  return parse(ReceiptOut, system, [block, { type: "text", text: "Extract this receipt. In evidence, quote the exact receipt text you used for vendor, total, date, tax and tip (empty string if absent). Score each field's certainty separately in field_confidence." }]);
}

export async function claudeText(prompt: string, system: string) {
  return parse(TextOut, system, [{ type: "text", text: prompt }]);
}

export async function claudeRationale(prompt: string) {
  const r = await parse(z.object({ rationale: z.string() }), "You review expense claims for duplicates. One short sentence for a finance lead.", [{ type: "text", text: prompt }]);
  return r.rationale;
}
