import { describe, expect, it } from "vitest";
import { calendarDayDraft } from "./calendar-day";

describe("calendar cell creation", () => {
  it("seeds the clicked day and an exclusive next-day end", () => {
    expect(calendarDayDraft(new Date(2026, 9, 12, 12))).toEqual({
      allDay: true,
      startDate: "2026-10-12",
      endDate: "2026-10-13",
    });
  });

  it.each([
    [2026, 11, 31, "2026-12-31", "2027-01-01"],
    [2024, 1, 28, "2024-02-28", "2024-02-29"],
    [2024, 1, 29, "2024-02-29", "2024-03-01"],
    [2026, 2, 29, "2026-03-29", "2026-03-30"],
    [2026, 9, 25, "2026-10-25", "2026-10-26"],
  ] as const)("keeps calendar boundaries for %s-%s-%s", (year, month, day, startDate, endDate) => {
    expect(calendarDayDraft(new Date(year, month, day, 12))).toEqual({ allDay: true, startDate, endDate });
  });
});
