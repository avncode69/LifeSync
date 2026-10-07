"use client";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { localDate, moveCalendarMonth } from "@/lib/time";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { useAccount } from "./shell";
import { ErrorState, Loading } from "./states";
export function Calendar() {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState("month");
  const [editor, setEditor] = useState<Row | "new">();
  const [initial, setInitial] = useState<Record<string, unknown>>();
  const timezone = preferences?.timezone ?? "Europe/Kyiv";
  useEffect(() => {
    setDate(new Date(`${localDate(timezone)}T12:00:00`));
  }, [timezone]);
  useEffect(() => {
    const target = new URLSearchParams(location.search).get("item");
    if (!target) return;
    let active = true;
    void api<Row>(`/calendar/events/${encodeURIComponent(target)}`)
      .then((row) => {
        if (!active) return;
        setEditor(row);
        setInitial(undefined);
        const day = row.allDay
          ? String(row.startDate)
          : row.startsAt
            ? localDate(timezone, new Date(String(row.startsAt)))
            : undefined;
        if (day) setDate(new Date(`${day}T12:00:00`));
      })
      .catch((reason) => {
        if (active) toast.error(t(errorKey(reason)));
      });
    return () => {
      active = false;
    };
  }, [t, timezone]);
  const start = new Date(date.getFullYear(), date.getMonth(), view === "month" ? 1 : date.getDate());
  const firstWeekday = preferences?.weekStart ?? 1;
  if (view === "month" || view === "week") start.setDate(start.getDate() - ((start.getDay() - firstWeekday + 7) % 7));
  const count = view === "month" ? 42 : view === "week" ? 7 : 1;
  const days = Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index);
    return day;
  });
  function dayString(day: Date) {
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }
  const events = useApi<Row[]>(
    `/calendar/occurrences?from=${dayString(days[0])}&to=${dayString(days[days.length - 1])}`,
  );
  async function editSeries(event: Row) {
    try {
      setEditor(await api<Row>(`/calendar/events/${event.id}`));
      setInitial(undefined);
    } catch (reason) {
      toast.error(t(errorKey(reason)));
    }
  }
  function belongs(row: Row, day: Date) {
    const target = dayString(day);
    if (row.allDay) return String(row.startDate) <= target && String(row.endDate) > target;
    if (!row.startsAt) return false;
    const first = localDate(timezone, new Date(String(row.startsAt)));
    const last = row.endsAt ? localDate(timezone, new Date(new Date(String(row.endsAt)).getTime() - 1)) : first;
    return first <= target && last >= target;
  }
  function move(direction: number) {
    const next = view === "month" ? moveCalendarMonth(date, direction) : new Date(date);
    if (view !== "month") next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1));
    setDate(next);
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="page-heading">{t("calendar")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{timezone}</p>
        </div>
        <Button
          className="min-h-11 gap-2"
          disabled={events.loading}
          onClick={() => {
            setInitial(undefined);
            setEditor("new");
          }}
        >
          <Plus />
          {t("create")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" aria-label={t("previous")} onClick={() => move(-1)}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" aria-label={t("next")} onClick={() => move(1)}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" onClick={() => setDate(new Date(`${localDate(timezone)}T12:00:00`))}>
            {t("today")}
          </Button>
          <h2 className="ml-2 text-lg font-semibold">
            {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date)}
          </h2>
        </div>
        <div className="flex rounded-xl bg-muted p-1">
          {["day", "week", "month"].map((option) => (
            <Button key={option} variant={view === option ? "default" : "ghost"} onClick={() => setView(option)}>
              {t(option)}
            </Button>
          ))}
        </div>
      </div>
      {events.loading ? (
        <Loading />
      ) : events.error ? (
        <ErrorState error={events.error} retry={() => void events.reload()} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <div className={view === "day" ? "" : "min-w-[660px]"}>
            {view !== "day" && (
              <div className="grid grid-cols-7 border-b">
                {days.slice(0, 7).map((day) => (
                  <p key={day.toISOString()} className="p-3 text-center text-xs font-medium text-muted-foreground">
                    {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(day)}
                  </p>
                ))}
              </div>
            )}
            <div className={view === "day" ? "" : "grid grid-cols-7"}>
              {days.map((day) => (
                <section
                  key={day.toISOString()}
                  className={`min-h-32 border-b border-r p-2 ${day.getMonth() !== date.getMonth() && view === "month" ? "bg-muted/30" : ""} ${view !== "month" ? "min-h-80" : ""}`}
                >
                  <button
                    type="button"
                    aria-label={`${t("create")} ${dayString(day)}`}
                    className={`mb-2 flex size-8 items-center justify-center rounded-full text-xs ${dayString(day) === localDate(timezone) ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => {
                      setInitial({
                        allDay: true,
                        startDate: dayString(day),
                        endDate: dayString(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)),
                      });
                      setEditor("new");
                    }}
                  >
                    {day.getDate()}
                  </button>
                  <div className="space-y-1">
                    {events.data
                      ?.filter((event) => belongs(event, day))
                      .map((event) => (
                        <button
                          type="button"
                          key={String(event.occurrenceId ?? event.id)}
                          onClick={() => void editSeries(event)}
                          className="block w-full rounded-md border-l-2 border-primary bg-primary/10 p-1.5 text-left text-xs text-primary"
                        >
                          <span className="block truncate font-medium">{String(event.title)}</span>
                          {!event.allDay && (
                            <time className="text-[10px]">
                              {new Intl.DateTimeFormat(locale, { timeZone: timezone, timeStyle: "short" }).format(
                                new Date(String(event.startsAt)),
                              )}
                            </time>
                          )}
                        </button>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
      <ResourcePanel resource="reminderRules" title="reminders" />
      <ResourcePanel resource="driveLinks" />
      {editor && (
        <ResourceEditor
          resource="calendarEvents"
          row={editor === "new" ? undefined : editor}
          initial={initial}
          onClose={() => setEditor(undefined)}
          onSaved={() => void events.reload()}
        />
      )}
    </div>
  );
}
