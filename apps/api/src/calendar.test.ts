import type { calendarEvents } from "@lifesync/db";
import { describe, expect, it } from "vitest";
import { expandCalendarEvents } from "./calendar";

const base: typeof calendarEvents.$inferSelect = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  title: "Colored event",
  description: null,
  color: "#aAbB09",
  projectId: null,
  allDay: true,
  startDate: "2026-10-12",
  endDate: "2026-10-13",
  startsAt: null,
  endsAt: null,
  location: null,
  meetUrl: null,
  recurrenceRule: null,
  timezone: "Europe/Kyiv",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
  deletedAt: null,
};

describe("calendar occurrence colors", () => {
  it("preserves colors for individual and recurring all-day events", () => {
    expect(expandCalendarEvents([base], "2026-10-12", "2026-10-14", "Europe/Kyiv")[0]?.color).toBe(base.color);
    const rows = expandCalendarEvents(
      [{ ...base, recurrenceRule: "FREQ=DAILY;COUNT=3" }],
      "2026-10-12",
      "2026-10-14",
      "Europe/Kyiv",
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.color)).toEqual([base.color, base.color, base.color]);
  });
  it("preserves colors for recurring timed events and supports existing uncolored events", () => {
    const event = {
      ...base,
      allDay: false,
      startDate: null,
      endDate: null,
      startsAt: new Date("2026-10-12T06:00:00Z"),
      endsAt: new Date("2026-10-12T07:00:00Z"),
      recurrenceRule: "FREQ=DAILY;COUNT=2",
    };
    const rows = expandCalendarEvents([event], "2026-10-12", "2026-10-13", "Europe/Kyiv");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.color)).toEqual([base.color, base.color]);
    expect(
      expandCalendarEvents([{ ...base, color: null }], "2026-10-12", "2026-10-12", "Europe/Kyiv")[0]?.color,
    ).toBeNull();
  });
});
