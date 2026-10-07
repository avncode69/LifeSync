import { Temporal } from "temporal-polyfill";
export function localDate(timezone: string, now = new Date()) {
  return Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function localInput(instant: string, timezone: string) {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function inputInstant(value: string, timezone: string) {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(timezone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function displayInstant(value: string, locale: string, timezone: string, timeFormat = "24h") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: timeFormat === "12h",
  }).format(new Date(value));
}

export function moveCalendarMonth(date: Date, direction: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + direction);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}
