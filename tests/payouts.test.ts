import { describe, expect, it } from "vitest";
import { isForwardTransition } from "../src/lib/payout-status";

describe("payout item transitions", () => {
  it("moves forward from pending to settled", () => {
    expect(isForwardTransition("PENDING", "SUCCESS")).toBe(true);
    expect(isForwardTransition("NEW", "PENDING")).toBe(true);
  });
  it("ignores replays and late pending events after settlement", () => {
    expect(isForwardTransition("SUCCESS", "SUCCESS")).toBe(false);
    expect(isForwardTransition("SUCCESS", "PENDING")).toBe(false);
    expect(isForwardTransition("UNCLAIMED", "PENDING")).toBe(false);
  });
  it("allows a settled payout to be returned or reversed", () => {
    expect(isForwardTransition("SUCCESS", "RETURNED")).toBe(true);
    expect(isForwardTransition("UNCLAIMED", "SUCCESS")).toBe(true);
  });
});

describe("PayPal error classification", () => {
  it("flags a region-blocked sender and words it for humans", async () => {
    process.env.PAYPAL_CLIENT_ID = "id";
    process.env.PAYPAL_CLIENT_SECRET = "secret";
    const { vi } = await import("vitest");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).endsWith("/v1/oauth2/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
        return new Response(JSON.stringify({ name: "AUTHORIZATION_ERROR", message: "You live in a country that is not allowed to send this payout." }), { status: 403 });
      }),
    );
    const { createPayout, friendlyPaypalError, PayPalError } = await import("../src/lib/paypal");
    const err = await createPayout("batch-1", [{ senderItemId: "a", email: "x@y.test", amountCents: 100, currency: "USD", note: "" }]).catch((e) => e);
    vi.unstubAllGlobals();
    expect(err).toBeInstanceOf(PayPalError);
    expect(err.uncertain).toBe(false);
    expect(err.senderRestricted).toBe(true);
    expect(friendlyPaypalError(err.message)).toMatch(/country that cannot send Payouts/);
    expect(friendlyPaypalError("PayPal 400: RECEIVER_UNREGISTERED")).toBe("PayPal 400: RECEIVER_UNREGISTERED");
  });
});
