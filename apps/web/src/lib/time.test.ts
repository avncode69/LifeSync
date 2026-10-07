import { formatDecimal } from "@lifesync/i18n";
import { describe, expect, it } from "vitest";
import { inputInstant, localDate, localInput, moveCalendarMonth } from "./time";

describe("user timezone inputs", () => {
  it("uses the user day across UTC midnight", () => {
    expect(localDate("America/Los_Angeles", new Date("2026-10-07T01:00:00Z"))).toBe("2026-10-06");
  });
  it("converts ordinary wall time to UTC and back", () => {
    expect(inputInstant("2026-10-07T15:00", "Europe/Kyiv")).toBe("2026-10-07T12:00:00Z");
    expect(localInput("2026-10-07T12:00:00Z", "Europe/Kyiv")).toBe("2026-10-07T15:00");
  });
  it("rejects nonexistent and ambiguous DST wall times", () => {
    expect(() => inputInstant("2026-03-29T03:30", "Europe/Kyiv")).toThrow();
    expect(() => inputInstant("2026-10-25T03:30", "Europe/Kyiv")).toThrow();
  });
});

describe("localized exact decimal display", () => {
  it("preserves decimal precision beyond Number safe integers", () => {
    expect(formatDecimal("1234567890123456.7891", "en")).toBe("1,234,567,890,123,456.7891");
  });
  it("retains the sign for amounts smaller than one", () => {
    expect(formatDecimal("-0.45", "en")).toBe("-0.45");
  });
});

describe("calendar month navigation", () => {
  it("clamps January 31 to February rather than skipping a month", () => {
    const next = moveCalendarMonth(new Date(2026, 0, 31, 12), 1);
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2026, 1, 28]);
  });
  it("keeps leap days and crosses years in either direction", () => {
    expect(moveCalendarMonth(new Date(2024, 0, 31), 1).getDate()).toBe(29);
    const previous = moveCalendarMonth(new Date(2026, 0, 31), -1);
    expect([previous.getFullYear(), previous.getMonth(), previous.getDate()]).toEqual([2025, 11, 31]);
  });
});
