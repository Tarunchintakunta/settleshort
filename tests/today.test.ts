import { describe, expect, it } from "vitest";

describe("todayIn", () => {
  it("uses the user's day, not UTC's", async () => {
    const { todayIn } = await import("@/lib/claims");
    const t = new Date("2026-10-04T19:30:00Z"); // 01:00 on Oct 5 in India
    expect(todayIn("Asia/Kolkata", t)).toBe("2026-10-05");
    expect(todayIn("UTC", t)).toBe("2026-10-04");
    expect(todayIn("Not/AZone", t)).toBe("2026-10-04");
  });
});
