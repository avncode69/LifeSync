import { describe, expect, it } from "vitest";
import { formatControlDate, parseControlDate } from "../apps/web/src/components/lifesync/control-values";

describe("LifeSync date control values", () => {
  it.each(["2026-10-11", "2024-02-29", "0099-01-03"])("roundtrips %s in local calendar time", (value) => {
    const date = parseControlDate(value);
    expect(date).toBeInstanceOf(Date);
    expect(formatControlDate(date as Date)).toBe(value);
    expect(date?.getHours()).toBe(0);
  });

  it("keeps the selected calendar day from a local date-time", () => {
    const date = parseControlDate("2026-10-11T23:45");
    expect(formatControlDate(date as Date)).toBe("2026-10-11");
  });

  it.each([
    "",
    "not-a-date",
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "0000-01-01",
    "2026-10-11extra",
  ])("rejects invalid date %s", (value) => {
    expect(parseControlDate(value)).toBeUndefined();
  });
});
