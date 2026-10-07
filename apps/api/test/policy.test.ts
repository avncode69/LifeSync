import { effectiveEntitlement } from "@lifesync/config";
import { localDay, nextOccurrences } from "@lifesync/domain";
import { describe, expect, it } from "vitest";

describe("server entitlement and local recurrence policy", () => {
  it("FREE nullable limits never imply Pro", () =>
    expect(effectiveEntitlement({ plan: "FREE", aiDailyLimit: null, inboxBoxLimit: 5 }, 100)).toEqual({
      plan: "FREE",
      aiDailyLimit: 3,
      inboxLimit: 2,
    }));
  it("expired or deleted Pro falls back to Free", () => {
    expect(effectiveEntitlement({ plan: "PRO", expiresAt: new Date(0) }, 100).aiDailyLimit).toBe(3);
    expect(effectiveEntitlement({ plan: "PRO", deletedAt: new Date() }, 100).inboxLimit).toBe(2);
  });
  it("active Pro applies configured fair use and never exceeds five boxes", () =>
    expect(effectiveEntitlement({ plan: "PRO", inboxBoxLimit: 20 }, 90)).toEqual({
      plan: "PRO",
      aiDailyLimit: 90,
      inboxLimit: 5,
    }));
  it.each(["Europe/Kyiv", "Pacific/Kiritimati", "America/New_York"])(
    "date cursors include the next local day in %s",
    (timezone) => {
      const last = "2026-03-28";
      const after = new Date(Date.parse(`${last}T00:00:00Z`) - 86400000).toISOString();
      const dates = nextOccurrences({ rule: "FREQ=DAILY", start: "2026-03-27T00:00:00", timezone, after, limit: 10 })
        .map((value) => localDay(value, timezone))
        .filter((date) => date > last);
      expect(dates[0]).toBe("2026-03-29");
      expect(new Set(dates).size).toBe(dates.length);
    },
  );
});
