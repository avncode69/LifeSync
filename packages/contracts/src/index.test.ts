import { describe, expect, it } from "vitest";
import { preferencesSchema, resourceRegistry, updatePreferencesSchema } from "./index";

describe("untrusted API inputs", () => {
  it("does not overwrite existing settings on a theme-only patch", () =>
    expect(updatePreferencesSchema.parse({ theme: "dark" })).toEqual({ theme: "dark" }));
  it("rejects a budget that does not start on the first day of a month", () =>
    expect(
      resourceRegistry.budgets.createSchema.safeParse({
        name: "Budget",
        month: "2026-10-05",
        amount: "10",
        currency: "UAH",
      }).success,
    ).toBe(false));
  it("requires exactly one owned target for a Drive link", () =>
    expect(
      resourceRegistry.driveLinks.createSchema.safeParse({
        googleFileId: "abcdefghijklmn",
        name: "File",
        mimeType: "text/plain",
        webViewUrl: "https://drive.google.com/file/d/abcdefghijklmn",
        taskId: "21b8d064-9948-47cf-9fb2-d84767003125",
        projectId: "21b8d064-9948-47cf-9fb2-d84767003125",
      }).success,
    ).toBe(false));
  it("rejects injected owner ids", () =>
    expect(resourceRegistry.tasks.createSchema.safeParse({ title: "Task", userId: "attacker" }).success).toBe(false));
  it("rejects floating point money", () =>
    expect(
      resourceRegistry.financeTransactions.createSchema.safeParse({
        accountId: "21b8d064-9948-47cf-9fb2-d84767003125",
        type: "expense",
        amount: 12.5,
        currency: "UAH",
        transactionDate: "2026-10-05",
      }).success,
    ).toBe(false));
  it("accepts exact decimal strings", () =>
    expect(
      resourceRegistry.financialAccounts.createSchema.safeParse({
        name: "Cash",
        currency: "UAH",
        openingBalance: "0.1000",
      }).success,
    ).toBe(true));
  it("requires destination for transfers", () =>
    expect(
      resourceRegistry.financeTransactions.createSchema.safeParse({
        accountId: "21b8d064-9948-47cf-9fb2-d84767003125",
        type: "transfer",
        amount: "12.50",
        currency: "UAH",
        transactionDate: "2026-10-05",
      }).success,
    ).toBe(false));
  it("rejects nonexistent timezone", () =>
    expect(preferencesSchema.safeParse({ timezone: "Moon/City" }).success).toBe(false));
  it("rejects all day events with fake instants", () =>
    expect(
      resourceRegistry.calendarEvents.createSchema.safeParse({
        title: "Event",
        allDay: true,
        startsAt: "2026-10-05T00:00:00Z",
        endsAt: "2026-10-06T00:00:00Z",
      }).success,
    ).toBe(false));
  it("does not reset status on title-only patches", () =>
    expect(resourceRegistry.tasks.updateSchema.parse({ title: "Rename" })).toEqual({ title: "Rename" }));
  it("rejects an empty patch", () => expect(resourceRegistry.tasks.updateSchema.safeParse({}).success).toBe(false));
});
