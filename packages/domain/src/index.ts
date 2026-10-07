import { Temporal } from "@js-temporal/polyfill";
import Decimal from "decimal.js";
import * as rruleModule from "rrule";

// rrule publishes CJS for Node and ESM for bundlers with different export shapes.
const { rrulestr } = (Reflect.get(rruleModule, "default") ?? rruleModule) as typeof import("rrule");

export function localDay(instant: string, timezone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timezone).toPlainDate().toString();
}

export function convertMoney(amount: string, from: string, to: string, rates: Record<string, string>): string {
  const value = new Decimal(amount);
  if (!value.isFinite()) throw new Error("INVALID_AMOUNT");
  if (from === to) return value.toFixed(2);
  const source = from === "UAH" ? "1" : rates[from];
  const destination = to === "UAH" ? "1" : rates[to];
  if (!source || !destination || !new Decimal(source).gt(0) || !new Decimal(destination).gt(0)) {
    throw new Error("RATE_UNAVAILABLE");
  }
  return value.mul(source).div(destination).toFixed(2, Decimal.ROUND_HALF_EVEN);
}

export function financeTotals(rows: { amount: string; type: string; deletedAt?: string | null }[]) {
  let income = new Decimal(0);
  let expense = new Decimal(0);
  for (const row of rows) {
    if (row.deletedAt) continue;
    if (row.type === "income") income = income.plus(row.amount);
    if (row.type === "expense") expense = expense.plus(row.amount);
  }
  return { income: income.toFixed(2), expense: expense.toFixed(2), balance: income.minus(expense).toFixed(2) };
}

export function nextOccurrences(input: {
  rule: string;
  start: string;
  timezone: string;
  after: string;
  limit: number;
}): string[] {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
    throw new Error("INVALID_RECURRENCE_LIMIT");
  if (
    input.rule.length > 500 ||
    /[\r\n]/.test(input.rule) ||
    !/^(RRULE:)?FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)/.test(input.rule)
  ) {
    throw new Error("INVALID_RECURRENCE_RULE");
  }
  const start = Temporal.PlainDateTime.from(input.start);
  const floating = (date: Temporal.PlainDateTime) => new Date(`${date.toString({ smallestUnit: "second" })}Z`);
  const after = Temporal.Instant.from(input.after);
  const afterLocal = after.toZonedDateTimeISO(input.timezone).toPlainDateTime();
  const parsed = rrulestr(input.rule, { dtstart: floating(start) });
  const upperBound = floating(afterLocal.add({ years: 10 }));
  // Generate wall-clock dates, then resolve each against the IANA zone. This preserves DST.
  const candidates = parsed.between(
    floating(afterLocal.subtract({ days: 1 })),
    upperBound,
    true,
    (_date, index) => index < input.limit + 4,
  );
  return candidates
    .map((date) =>
      Temporal.PlainDateTime.from(date.toISOString().slice(0, 19))
        .toZonedDateTime(input.timezone, { disambiguation: "compatible" })
        .toInstant(),
    )
    .filter((instant) => Temporal.Instant.compare(instant, after) > 0)
    .slice(0, input.limit)
    .map((instant) => instant.toString());
}

export function habitStatistics(input: {
  startDate: string;
  weekdays: number[];
  targetPerWeek: number;
  entries: string[];
  today: string;
  endDate?: string | null;
  schedule?: "daily" | "weekdays" | "weekly_goal";
}) {
  const start = Temporal.PlainDate.from(input.startDate);
  const today = Temporal.PlainDate.from(input.today);
  const end = input.endDate && input.endDate < input.today ? Temporal.PlainDate.from(input.endDate) : today;
  const entries = new Set(input.entries.filter((date) => date >= input.startDate && date <= end.toString()));
  const scheduled = (date: Temporal.PlainDate) => !input.weekdays.length || input.weekdays.includes(date.dayOfWeek % 7);
  let chain = 0;
  let bestStreak = 0;
  let scheduledDays = 0;
  let completed = 0;
  const weeks = new Map<string, number>();
  // Bound history to 100 years; malformed histories must not create an unbounded loop.
  if (start.until(end).days > 36600) throw new Error("HABIT_RANGE_TOO_LARGE");
  for (let date = start; Temporal.PlainDate.compare(date, end) <= 0; date = date.add({ days: 1 })) {
    const day = date.toString();
    if (entries.has(day)) {
      const week = date.subtract({ days: date.dayOfWeek - 1 }).toString();
      weeks.set(week, (weeks.get(week) ?? 0) + 1);
    }
    if (!scheduled(date)) continue;
    scheduledDays++;
    if (entries.has(day)) {
      chain++;
      completed++;
      bestStreak = Math.max(bestStreak, chain);
    } else if (day !== input.today) chain = 0;
  }
  if (input.schedule === "weekly_goal") {
    chain = 0;
    bestStreak = 0;
    const startWeek = start.subtract({ days: start.dayOfWeek - 1 });
    const currentWeek = today.subtract({ days: today.dayOfWeek - 1 });
    for (let week = startWeek; Temporal.PlainDate.compare(week, currentWeek) <= 0; week = week.add({ weeks: 1 })) {
      if ((weeks.get(week.toString()) ?? 0) >= input.targetPerWeek) {
        chain++;
        bestStreak = Math.max(bestStreak, chain);
      } else if (Temporal.PlainDate.compare(week, currentWeek) < 0) chain = 0;
    }
  }
  return {
    currentStreak: chain,
    bestStreak,
    completionPercentage: scheduledDays ? Math.round((completed / scheduledDays) * 100) : 0,
    weeklyProgress: weeks.get(today.subtract({ days: today.dayOfWeek - 1 }).toString()) ?? 0,
    monthlyCount: [...entries].filter((date) => date.startsWith(input.today.slice(0, 7))).length,
  };
}

export function reminderInstants(target: string, offsetsMinutes: number[]): string[] {
  const instant = Temporal.Instant.from(target);
  return [...new Set(offsetsMinutes)]
    .map((minutes) => {
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 525600) throw new Error("INVALID_REMINDER_OFFSET");
      return instant.subtract({ seconds: minutes * 60 }).toString();
    })
    .sort();
}

export interface CapturePreview {
  kind: "task" | "event" | "finance" | "habit" | "inbox";
  title: string;
  startsAt?: string;
  recurrenceRule?: string;
  amount?: string;
  currency?: string;
  requiresConfirmation: true;
  confidence: number;
}
export function parseCapture(text: string, now: string, timezone: string): CapturePreview {
  const title = text.trim();
  if (!title || title.length > 2000) throw new Error("INVALID_CAPTURE");
  const money = /(?:^|\s)(\d+(?:[.,]\d{1,2})?)\s*(грн|₴|uah|usd|\$|eur|€|pln|gbp|chf|czk|cad)(?=\s|$)/iu.exec(title);
  const preview: CapturePreview = { kind: "task", title, requiresConfirmation: true, confidence: 0.55 };
  if (money) {
    const code = money[2].toUpperCase();
    preview.kind = "finance";
    preview.amount = new Decimal(money[1].replace(",", ".")).toFixed(2);
    preview.currency = ({ ГРН: "UAH", "₴": "UAH", $: "USD", "€": "EUR" } as Record<string, string>)[code] ?? code;
    preview.confidence = 0.9;
  } else if (/зустріч|meeting|подія|event/iu.test(title)) preview.kind = "event";
  else if (/звичк|habit|бігати|щодня|daily/iu.test(title)) preview.kind = "habit";
  const current = Temporal.Instant.from(now).toZonedDateTimeISO(timezone);
  let date = /завтра|tomorrow/iu.test(title) ? current.toPlainDate().add({ days: 1 }) : current.toPlainDate();
  const weekdayPatterns = [
    /понеділ|monday/iu,
    /вівтор|tuesday/iu,
    /серед|wednesday/iu,
    /четвер|thursday/iu,
    /п['’]?ятниц|friday/iu,
    /субот|saturday/iu,
    /(?:^|[^\p{L}])(?:неділ|sunday)/iu,
  ];
  const weekdays = weekdayPatterns.flatMap((pattern, index) => (pattern.test(title) ? [index + 1] : []));
  const time = /(?:\b|о\s)(\d{1,2}):(\d{2})\b/u.exec(title) ?? /(?:о|at)\s+(\d{1,2})(?:\s|$)/iu.exec(title);
  const hour = time ? Number(time[1]) : 0;
  const minute = time ? Number(time[2] ?? 0) : 0;
  if (weekdays.length) {
    const offsets = weekdays.map((day) => {
      const offset = (day - current.dayOfWeek + 7) % 7;
      return offset === 0 && (hour < current.hour || (hour === current.hour && minute <= current.minute)) ? 7 : offset;
    });
    date = current.toPlainDate().add({ days: Math.min(...offsets) });
    if (preview.kind === "habit")
      preview.recurrenceRule = `FREQ=WEEKLY;BYDAY=${weekdays.map((day) => ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][day - 1]).join(",")}`;
  } else if (preview.kind === "habit" && /щодня|daily/iu.test(title)) preview.recurrenceRule = "FREQ=DAILY";
  if (time && hour < 24 && minute < 60) {
    preview.startsAt = date
      .toPlainDateTime({ hour, minute })
      .toZonedDateTime(timezone, { disambiguation: "compatible" })
      .toInstant()
      .toString();
    preview.confidence = Math.max(preview.confidence, 0.8);
  }
  return preview;
}

const tools: Record<string, { module: string; confirmation: boolean }> = {
  search: { module: "tasks", confirmation: false },
  createTask: { module: "tasks", confirmation: false },
  completeTask: { module: "tasks", confirmation: false },
  updateTask: { module: "tasks", confirmation: true },
  deleteTask: { module: "tasks", confirmation: true },
  createEvent: { module: "calendar", confirmation: false },
  rescheduleEvent: { module: "calendar", confirmation: true },
  createHabit: { module: "habits", confirmation: false },
  logHabit: { module: "habits", confirmation: false },
  createInboxItem: { module: "inbox", confirmation: false },
  createTransaction: { module: "finance", confirmation: true },
  createHealthEntry: { module: "health", confirmation: true },
  preparePlan: { module: "health", confirmation: false },
};
export function authorizeTool(name: string, permissions: Record<string, boolean>, confirmed: boolean): string {
  const policy = tools[name];
  if (!policy) throw new Error("AI_TOOL_DENIED");
  if (!permissions[policy.module]) throw new Error("AI_PERMISSION_DENIED");
  if (policy.confirmation && !confirmed) throw new Error("AI_CONFIRMATION_REQUIRED");
  return policy.module;
}
