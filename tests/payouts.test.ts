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
