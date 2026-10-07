import type { calendarEvents, Database } from "@lifesync/db";
import * as schema from "@lifesync/db";
import { localDay, nextOccurrences } from "@lifesync/domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ApiFailure } from "./security";

type CalendarEvent = typeof calendarEvents.$inferSelect;
export function localStartOfDay(date: string, timezone: string): Date {
  const [value] = nextOccurrences({
    rule: "FREQ=DAILY;COUNT=1",
    start: `${date}T00:00:00`,
    timezone,
    after: new Date(Date.parse(date) - 172800000).toISOString(),
    limit: 1,
  });
  if (!value) throw new ApiFailure("INVALID_DATE", "Invalid calendar day");
  return new Date(value);
}
export function nextDate(date: string, days = 1): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}
function localStart(instant: Date, timezone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export type CalendarOccurrence = CalendarEvent & { seriesId: string; occurrenceId: string };
export function expandCalendarEvents(
  events: CalendarEvent[],
  from: string,
  to: string,
  timezone: string,
): CalendarOccurrence[] {
  const windowStart = localStartOfDay(from, timezone),
    windowEnd = localStartOfDay(nextDate(to), timezone),
    output: CalendarOccurrence[] = [];
  for (const event of events) {
    const overlaps = (row: CalendarEvent) =>
      row.allDay
        ? row.startDate! < nextDate(to) && row.endDate! > from
        : row.startsAt! < windowEnd && row.endsAt! > windowStart;
    const append = (row: CalendarEvent, key: string) => {
      if (overlaps(row)) output.push({ ...row, seriesId: event.id, occurrenceId: `${event.id}:${key}` });
      if (output.length > 5000)
        throw new ApiFailure("CALENDAR_RANGE_TOO_LARGE", "Choose a shorter calendar range", 413);
    };
    if (!event.recurrenceRule) {
      append(event, event.startDate ?? event.startsAt!.toISOString());
      continue;
    }
    const duration = event.allDay
      ? Date.parse(event.endDate!) - Date.parse(event.startDate!)
      : event.endsAt!.getTime() - event.startsAt!.getTime();
    const start = event.allDay ? `${event.startDate}T00:00:00` : localStart(event.startsAt!, event.timezone);
    let after = new Date(
      (event.allDay ? Date.parse(from) - 172800000 : windowStart.getTime()) - duration - 1,
    ).toISOString();
    for (let page = 0; page < 60; page++) {
      const occurrences = nextOccurrences({
        rule: event.recurrenceRule,
        start,
        timezone: event.timezone,
        after,
        limit: 100,
      });
      let finished = false;
      for (const occurrence of occurrences) {
        const instant = new Date(occurrence);
        if (event.allDay) {
          const date = localDay(occurrence, event.timezone);
          if (date > to) {
            finished = true;
            break;
          }
          append({ ...event, startDate: date, endDate: nextDate(date, duration / 86400000) }, date);
        } else {
          if (instant >= windowEnd) {
            finished = true;
            break;
          }
          append({ ...event, startsAt: instant, endsAt: new Date(instant.getTime() + duration) }, occurrence);
        }
      }
      if (finished || occurrences.length < 100) break;
      after = occurrences.at(-1)!;
      if (page === 59) throw new ApiFailure("CALENDAR_RANGE_TOO_LARGE", "Choose a shorter calendar range", 413);
    }
  }
  return output.sort(
    (a, b) =>
      String(a.startDate ?? a.startsAt!.toISOString()).localeCompare(
        String(b.startDate ?? b.startsAt!.toISOString()),
      ) || a.id.localeCompare(b.id),
  );
}
export async function calendarOccurrences(db: Database, userId: string, from: string, to: string, timezone: string) {
  const lower = localStartOfDay(from, timezone),
    upper = localStartOfDay(nextDate(to), timezone);
  const events = await db
    .select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.userId, userId),
        isNull(schema.calendarEvents.deletedAt),
        sql`(${schema.calendarEvents.recurrenceRule} is not null or (${schema.calendarEvents.allDay} and ${schema.calendarEvents.startDate}<${nextDate(to)} and ${schema.calendarEvents.endDate}>${from}) or (not ${schema.calendarEvents.allDay} and ${schema.calendarEvents.startsAt}<${upper} and ${schema.calendarEvents.endsAt}>${lower}))`,
      ),
    )
    .limit(1001);
  if (events.length > 1000) throw new ApiFailure("CALENDAR_RANGE_TOO_LARGE", "Choose a shorter calendar range", 413);
  return expandCalendarEvents(events, from, to, timezone);
}
