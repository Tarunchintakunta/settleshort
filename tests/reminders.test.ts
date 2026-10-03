import { describe, expect, it } from "vitest";
import { blockerFor, escalationTarget } from "../src/lib/reminders";

const t = (key: string, detail = "") => ({ key, label: key, detail, tone: "neutral" as const });

describe("reminders explain the blocker", () => {
  it("asks the claimant only for what's missing", () => {
    expect(blockerFor(t("submitted"), { missing: ["What was it for?"] })).toEqual({ waitingOn: "claimant", why: "Missing: What was it for?", action: "Answer that one question" });
  });
  it("routes each stage to the right person", () => {
    expect(blockerFor(t("submitted"))?.waitingOn).toBe("approver");
    expect(blockerFor(t("scheduled"), { batchName: "September offsites" })).toEqual({ waitingOn: "releaser", why: "In September offsites waiting for release", action: "Release the batch to PayPal" });
    expect(blockerFor(t("paid"))?.waitingOn).toBe("receiver");
    expect(blockerFor(t("received"))).toBeNull();
  });
});

describe("escalation", () => {
  it("goes to the next person in the chain, then the owner, never in a loop", () => {
    expect(escalationTarget("lead", { lead: "cfo" }, "owner")).toBe("cfo");
    expect(escalationTarget("lead", {}, "owner")).toBe("owner");
    expect(escalationTarget("owner", {}, "owner")).toBeNull();
  });
});
