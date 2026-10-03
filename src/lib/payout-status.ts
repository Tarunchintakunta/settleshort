// Pure PayPal payout-item status rules, shared by polling, webhooks and the UI.

export const PAID = new Set(["SUCCESS"]);
export const FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);
export const TERMINAL = new Set([...PAID, ...FAILED, "UNCLAIMED"]);

/** A late or replayed event must never move a settled item back to pending. */
export function isForwardTransition(from: string, to: string) {
  if (from === to) return false;
  return !TERMINAL.has(from) || TERMINAL.has(to);
}
