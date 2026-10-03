// Pure SaaS spend checks for small teams: subscriptions paid personally, and the same tool bought twice. Unit-tested.
import { normalizeMerchant } from "./matching";

const KNOWN = [
  "figma", "notion", "slack", "github", "zoom", "google workspace", "openai", "chatgpt", "anthropic", "claude", "linear", "vercel", "aws",
  "canva", "miro", "loom", "adobe", "atlassian", "jira", "1password", "dropbox", "airtable", "hubspot", "intercom", "mailchimp", "webflow",
  "framer", "cursor", "postman", "datadog", "sentry", "netlify", "heroku", "digitalocean", "calendly", "grammarly", "zapier", "retool",
];

export type SaasClaim = { id: string; payerUserId: string; vendor: string; txnDate: string | null; category: string | null; amountCents: number; employeeFunded: boolean; status: string };

export const saasKey = (vendor: string) => {
  const n = normalizeMerchant(vendor);
  return KNOWN.find((k) => n === k || n.startsWith(k + " ")) ?? null;
};
const isSaas = (c: SaasClaim) => !!saasKey(c.vendor) || c.category === "Software";
const key = (c: SaasClaim) => saasKey(c.vendor) ?? normalizeMerchant(c.vendor);
const month = (d: string | null) => d?.slice(0, 7) ?? null;
const live = (c: SaasClaim) => c.status !== "rejected";

/** A teammate paying for a company tool from their own pocket in two or more different months. */
export function personallyFundedSaas(claims: SaasClaim[]) {
  const groups = new Map<string, SaasClaim[]>();
  for (const c of claims.filter((c) => live(c) && c.employeeFunded && isSaas(c) && month(c.txnDate))) {
    const k = `${c.payerUserId}|${key(c)}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.values()]
    .map((g) => ({ payerUserId: g[0].payerUserId, vendor: g[0].vendor, tool: key(g[0]), months: [...new Set(g.map((c) => month(c.txnDate)!))].sort(), totalCents: g.reduce((a, c) => a + c.amountCents, 0), claimIds: g.map((c) => c.id) }))
    .filter((g) => g.months.length >= 2);
}

/** The same tool claimed by two or more different people in the same month: probably one seat too many. */
export function overlappingSaas(claims: SaasClaim[]) {
  const groups = new Map<string, SaasClaim[]>();
  for (const c of claims.filter((c) => live(c) && isSaas(c) && month(c.txnDate))) {
    const k = `${key(c)}|${month(c.txnDate)}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  return [...groups.values()]
    .map((g) => ({ tool: key(g[0]), vendor: g[0].vendor, month: month(g[0].txnDate)!, payerUserIds: [...new Set(g.map((c) => c.payerUserId))], claimIds: g.map((c) => c.id) }))
    .filter((g) => g.payerUserIds.length >= 2);
}
