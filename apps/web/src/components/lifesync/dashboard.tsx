"use client";
import { dashboardLayoutSchema, type Preferences } from "@lifesync/contracts";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Heart,
  Inbox,
  Layers,
  Plus,
  Settings2,
  Sparkles,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, label, type Row, useApi } from "@/lib/api";
import {
  defaultDashboardWidgets as defaults,
  dashboardDefinitions as definitions,
  type DashboardWidget as Widget,
} from "@/lib/dashboard-layout";
import { localDate } from "@/lib/time";
import { Capture } from "./capture";
import { LifeSelect } from "./controls";
import { useLocale } from "./providers";
import { useAccount } from "./shell";
import { ErrorState, Loading } from "./states";

const widgetIcons = {
  todayCalendar: CalendarDays,
  priorityTasks: CheckCheck,
  habits: Sprout,
  financeSummary: CircleDollarSign,
  healthSummary: Heart,
  projects: Layers,
  quickCapture: Inbox,
  aiInput: Sparkles,
  upcomingReminders: Bell,
};
const widgetColors: Record<string, string> = {
  todayCalendar: "text-violet-500 dark:text-violet-400",
  priorityTasks: "text-blue-600 dark:text-blue-400",
  habits: "text-emerald-600 dark:text-emerald-400",
  financeSummary: "text-amber-600 dark:text-amber-400",
  healthSummary: "text-rose-600 dark:text-rose-400",
  quickCapture: "text-cyan-600 dark:text-cyan-400",
  aiInput: "text-cyan-600 dark:text-cyan-400",
};
export function Dashboard() {
  const { t, locale } = useLocale();
  const account = useAccount();
  const data = useApi<Record<string, Row[]>>("/dashboard");
  const finance = useApi<Record<string, unknown>>(
    account.preferences?.hiddenModules.includes("finance") ? null : "/finance/summary",
  );
  const health = useApi<Record<string, unknown>>(
    account.preferences?.hiddenModules.includes("health") ? null : "/health/summary",
  );
  const reminders = useApi<Row[]>("/reminders?limit=50");
  const [customize, setCustomize] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(defaults);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const result = dashboardLayoutSchema.safeParse(account.preferences?.dashboardLayout);
    if (result.success)
      setWidgets(
        result.data.widgets
          .filter((widget) => definitions.some((definition) => definition.id === widget.id))
          .sort((a, b) => a.position - b.position),
      );
  }, [account.preferences?.dashboardLayout]);
  async function save(next = widgets) {
    setPending(true);
    try {
      await api("/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          dashboardLayout: { version: 1, widgets: next.map((widget, index) => ({ ...widget, position: index })) },
        }),
      });
      account.refresh();
      setCustomize(false);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  const keyFor: Record<string, string> = {
    priorityTasks: "tasks",
    todayCalendar: "calendarEvents",
    habits: "habits",
    projects: "projects",
  };
  const emptyKeys: Record<string, string> = {
    priorityTasks: "dashboardNoTasks",
    todayCalendar: "dashboardNoEvents",
    projects: "dashboardNoProjects",
    financeSummary: "dashboardNoAccounts",
    habits: "dashboardNoHabits",
    upcomingReminders: "dashboardNoReminders",
  };
  const actionKeys: Record<string, string> = {
    priorityTasks: "dashboardAddTask",
    todayCalendar: "dashboardPlanEvent",
    projects: "dashboardAddProject",
    financeSummary: "dashboardAddAccount",
    habits: "dashboardAddHabit",
    upcomingReminders: "reminders",
  };
  const visibleWidgets = widgets.filter(
    (widget) =>
      widget.visible &&
      !account.preferences?.hiddenModules.includes(
        definitions.find((entry) => entry.id === widget.id)?.module as Preferences["hiddenModules"][number],
      ),
  );
  const showGreeting = visibleWidgets.some((widget) => widget.id === "greeting");
  function empty(id: string) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-3">
        <p className="text-sm text-muted-foreground">{t(emptyKeys[id] ?? "empty")}</p>
        <Link
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          href={definitions.find((entry) => entry.id === id)?.path ?? "/dashboard"}
        >
          <Plus className="size-3.5" /> {t(actionKeys[id] ?? "create")}
        </Link>
      </div>
    );
  }
  function content(id: string) {
    if (id === "quickCapture") return <Capture onDone={() => void data.reload()} />;
    if (id === "aiInput")
      return (
        <form action="/ai" className="space-y-3">
          <input
            name="prompt"
            className="control"
            aria-label={t("aiInput")}
            placeholder={t("aiHelp")}
            maxLength={5000}
          />
          <Button type="submit" className="min-h-11">
            {t("send")}
          </Button>
        </form>
      );
    if (id === "financeSummary") {
      if (finance.loading) return <Loading />;
      if (finance.error) return <ErrorState error={finance.error} retry={() => void finance.reload()} />;
      const accounts = finance.data?.accounts as Row[] | undefined;
      return accounts?.length ? (
        <div className="space-y-3">
          {accounts.slice(0, 3).map((row) => (
            <div key={row.id} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{String(row.name)}</span>
              <span className="font-semibold tabular-nums">
                {String(row.balance)} {String(row.currency)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        empty(id)
      );
    }
    if (id === "healthSummary") {
      if (health.loading) return <Loading />;
      if (health.error) return <ErrorState error={health.error} retry={() => void health.reload()} />;
      const macros = health.data?.macros as Record<string, string> | undefined;
      return (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "calories", value: macros?.calories },
            { key: "water", value: health.data?.waterMl },
          ].map((item) => (
            <div key={item.key} className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t(item.key)}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {String(item.value ?? 0)}
                {item.key === "water" && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{t("ml")}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      );
    }
    if (id === "upcomingReminders" && reminders.loading) return <Loading />;
    if (id === "upcomingReminders" && reminders.error)
      return <ErrorState error={reminders.error} retry={() => void reminders.reload()} />;
    const rows = id === "upcomingReminders" ? reminders.data : data.data?.[keyFor[id]];
    const today = localDate(account.preferences?.timezone ?? "Europe/Kyiv");
    const filtered =
      id === "todayCalendar"
        ? rows?.filter((row) =>
            row.allDay
              ? String(row.startDate) <= today && String(row.endDate) > today
              : !!row.startsAt &&
                localDate(account.preferences?.timezone ?? "Europe/Kyiv", new Date(String(row.startsAt))) <= today &&
                localDate(
                  account.preferences?.timezone ?? "Europe/Kyiv",
                  row.endsAt ? new Date(new Date(String(row.endsAt)).getTime() - 1) : new Date(String(row.startsAt)),
                ) >= today,
          )
        : id === "priorityTasks"
          ? rows?.filter((row) => !["done", "cancelled"].includes(String(row.status)))
          : rows;
    return filtered?.length ? (
      <div className="divide-y divide-border">
        {filtered.slice(0, 5).map((row) => (
          <Link
            key={row.id}
            href={`${definitions.find((entry) => entry.id === id)?.path ?? "/dashboard"}?item=${encodeURIComponent(String(row.id))}`}
            className="flex min-h-12 items-center gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {id === "priorityTasks" ? (
              <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/35" />
            ) : (
              <span
                className={`size-2 shrink-0 rounded-full ${id === "todayCalendar" ? "bg-violet-500" : "bg-primary"}`}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{label(row)}</span>
            {id === "todayCalendar" && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {row.allDay
                  ? t("allDay")
                  : new Intl.DateTimeFormat(locale, {
                      timeZone: account.preferences?.timezone ?? "Europe/Kyiv",
                      timeStyle: "short",
                      hour12: account.preferences?.timeFormat === "12h",
                    }).format(new Date(String(row.startsAt)))}
              </span>
            )}
            {row.status ? (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t(String(row.status))}</span>
            ) : null}
          </Link>
        ))}
      </div>
    ) : (
      empty(id)
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">
            {showGreeting ? t("today") : t("dashboard")}
            {showGreeting && account.user?.name ? (
              <span className="font-normal text-muted-foreground"> · {String(account.user.name).split(" ")[0]}</span>
            ) : null}
          </h1>
          {showGreeting && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "full",
                timeZone: account.preferences?.timezone ?? "Europe/Kyiv",
              }).format(new Date())}
            </p>
          )}
        </div>
        <Button variant="outline" className="min-h-11 gap-2" onClick={() => setCustomize(!customize)}>
          <Settings2 className="size-4" />
          {t("customize")}
        </Button>
      </div>
      {customize && (
        <div className="surface space-y-4">
          {widgets.map((widget, index) => (
            <div key={widget.id} className="flex flex-wrap items-center gap-3">
              <label className="flex flex-1 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={widget.visible}
                  onChange={(event) =>
                    setWidgets(
                      widgets.map((entry) =>
                        entry.id === widget.id ? { ...entry, visible: event.target.checked } : entry,
                      ),
                    )
                  }
                />
                {t(widget.id)}
              </label>
              <LifeSelect
                className="control w-auto"
                aria-label={t("size")}
                value={widget.size}
                onChange={(event) =>
                  setWidgets(
                    widgets.map((entry) =>
                      entry.id === widget.id ? { ...entry, size: event.target.value as Widget["size"] } : entry,
                    ),
                  )
                }
              >
                {["small", "medium", "large"].map((size) => (
                  <option key={size} value={size}>
                    {t(size)}
                  </option>
                ))}
              </LifeSelect>
              <Button
                variant="outline"
                aria-label={t("moveUp")}
                disabled={!index}
                onClick={() => {
                  const next = [...widgets];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  setWidgets(next);
                }}
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending} onClick={() => void save()}>
              {t("save")}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                const next = defaults();
                setWidgets(next);
                void save(next);
              }}
            >
              {t("defaults")}
            </Button>
          </div>
        </div>
      )}
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} retry={() => void data.reload()} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleWidgets
            .filter((widget) => widget.id !== "greeting")
            .map((widget) => {
              const Icon = widgetIcons[widget.id as keyof typeof widgetIcons] ?? Inbox;
              return (
                <section
                  key={widget.id}
                  className={`surface dashboard-card ${widget.size === "large" ? "md:col-span-2" : widget.size === "small" ? "!p-4" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className={`size-4 ${widgetColors[widget.id] ?? "text-primary"}`} />
                      {t(widget.id)}
                    </h2>
                    <Link
                      href={definitions.find((entry) => entry.id === widget.id)?.path ?? "/dashboard"}
                      aria-label={t(widget.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <ArrowRight className="size-4" />
                    </Link>
                  </div>
                  {content(widget.id)}
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
