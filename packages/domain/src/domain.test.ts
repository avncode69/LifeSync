import { describe, expect, it } from "vitest";
import {
  authorizeTool,
  convertMoney,
  financeTotals,
  habitStatistics,
  localDay,
  nextOccurrences,
  parseCapture,
  reminderInstants,
} from "./index";

describe("decimal finance", () => {
  it("converts cross rates exactly and refuses unavailable rates", () => {
    expect(convertMoney("0.10", "USD", "EUR", { USD: "40", EUR: "50", UAH: "1" })).toBe("0.08");
    expect(() => convertMoney("3", "CHF", "USD", { USD: "40" })).toThrow("RATE_UNAVAILABLE");
  });
  it("excludes trash and transfers from income/expenses", () => {
    expect(
      financeTotals([
        { amount: "0.1", type: "income" },
        { amount: "0.2", type: "income" },
        { amount: "99", type: "expense", deletedAt: "2026-01-01" },
        { amount: "7", type: "transfer" },
      ]),
    ).toEqual({ income: "0.30", expense: "0.00", balance: "0.30" });
  });
});
describe("local schedule correctness", () => {
  it("keeps 09:00 local across DST", () => {
    const occurrences = nextOccurrences({
      rule: "FREQ=DAILY;COUNT=3",
      start: "2026-03-28T09:00:00",
      timezone: "Europe/Kyiv",
      after: "2026-03-27T00:00:00Z",
      limit: 3,
    });
    expect(occurrences).toEqual(["2026-03-28T07:00:00Z", "2026-03-29T06:00:00Z", "2026-03-30T06:00:00Z"]);
  });
  it("handles quota day at UTC boundaries", () => {
    expect(localDay("2026-10-05T23:30:00Z", "Europe/Kyiv")).toBe("2026-10-06");
  });
  it("unscheduled weekend does not break a habit streak", () => {
    const stats = habitStatistics({
      startDate: "2026-10-01",
      weekdays: [1, 2, 3, 4, 5],
      targetPerWeek: 5,
      entries: ["2026-10-01", "2026-10-02", "2026-10-05"],
      today: "2026-10-05",
    });
    expect(stats.currentStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });
  it("missed scheduled day breaks the chain", () => {
    expect(
      habitStatistics({
        startDate: "2026-10-01",
        weekdays: [1, 2, 3, 4, 5],
        targetPerWeek: 5,
        entries: ["2026-10-01", "2026-10-05"],
        today: "2026-10-05",
      }).currentStreak,
    ).toBe(1);
  });
  it("deduplicates reminders", () => {
    expect(reminderInstants("2026-10-05T15:00:00Z", [60, 10, 10])).toEqual([
      "2026-10-05T14:00:00Z",
      "2026-10-05T14:50:00Z",
    ]);
  });
});
describe("capture and AI boundary", () => {
  it("parses selected Ukrainian habit weekdays and a plain hour", () => {
    const result = parseCapture("Бігати понеділок середа п'ятниця о 7", "2026-10-05T10:00:00Z", "Europe/Kyiv");
    expect(result.kind).toBe("habit");
    expect(result.recurrenceRule).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(result.startsAt).toBe("2026-10-07T04:00:00Z");
  });
  it("previews next named weekday event", () => {
    expect(parseCapture("Зустріч у четвер 12:30", "2026-10-05T10:00:00Z", "Europe/Kyiv").startsAt).toBe(
      "2026-10-08T09:30:00Z",
    );
  });
  it("previews Ukrainian money without silently writing", () => {
    const result = parseCapture("Кава 95 грн сьогодні", "2026-10-05T10:00:00Z", "Europe/Kyiv");
    expect(result.kind).toBe("finance");
    expect(result.amount).toBe("95.00");
    expect(result.currency).toBe("UAH");
    expect(result.requiresConfirmation).toBe(true);
  });
  it("parses tomorrow in user's zone", () => {
    const result = parseCapture("Здати лабораторну завтра о 15:00", "2026-10-05T10:00:00Z", "Europe/Kyiv");
    expect(result.startsAt).toBe("2026-10-06T12:00:00Z");
  });
  it("rejects module access independently of model", () => {
    expect(() => authorizeTool("createTransaction", { finance: false }, true)).toThrow("AI_PERMISSION_DENIED");
    expect(() => authorizeTool("createTransaction", { finance: true }, false)).toThrow("AI_CONFIRMATION_REQUIRED");
    expect(authorizeTool("createTask", { tasks: true }, false)).toBe("tasks");
    expect(() => authorizeTool("executeSql", {}, true)).toThrow("AI_TOOL_DENIED");
  });
});
