"use client";
import { dashboardLayoutSchema, type Preferences } from "@lifesync/contracts";
import { ArrowRight, ArrowUp, Settings2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, label, type Row, useApi } from "@/lib/api";
import { localDate } from "@/lib/time";
import { Capture } from "./capture";
import { useLocale } from "./providers";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";

const definitions = [
  { id: "greeting", path: "/dashboard", module: "dashboard" },
  { id: "todayCalendar", path: "/calendar", module: "calendar" },
  { id: "priorityTasks", path: "/tasks", module: "tasks" },
  { id: "habits", path: "/habits", module: "habits" },
  { id: "financeSummary", path: "/finance", module: "finance" },
  { id: "healthSummary", path: "/health", module: "health" },
  { id: "projects", path: "/projects", module: "projects" },
  { id: "quickCapture", path: "/inbox", module: "inbox" },
  { id: "aiInput", path: "/ai", module: "ai" },
  { id: "upcomingReminders", path: "/notifications", module: "dashboard" },
];
type Widget = { id: string; visible: boolean; size: "small" | "medium" | "large"; position: number };
function defaults(): Widget[] {
  return definitions.map((definition, i) => ({
    id: definition.id,
    visible: true,
    size: ["priorityTasks", "quickCapture"].includes(definition.id) ? "large" : "medium",
    position: i,
  }));
}
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
  function content(id: string) {
    if (id === "greeting")
      return (
        <div className="py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "full",
              timeZone: account.preferences?.timezone ?? "Europe/Kyiv",
            }).format(new Date())}
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            {t("welcome")}, {String(account.user?.name ?? "").split(" ")[0]}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("focus")}</p>
        </div>
      );
    if (id === "quickCapture") return <Capture onDone={() => void data.reload()} />;
    if (id === "aiInput")
      return (
        <form action="/ai" className="space-y-3">
          <textarea
            name="prompt"
            className="control min-h-24"
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
        <Empty />
      );
    }
    if (id === "healthSummary") {
      if (health.error) return <ErrorState error={health.error} retry={() => void health.reload()} />;
      const macros = health.data?.macros as Record<string, string> | undefined;
      return (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "calories", value: macros?.calories },
            { key: "water", value: health.data?.waterMl },
          ].map((item) => (
            <div key={item.key} className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">{t(item.key)}</p>
              <p className="mt-2 text-2xl font-semibold">{String(item.value ?? 0)}</p>
            </div>
          ))}
        </div>
      );
    }
    const rows = id === "upcomingReminders" ? reminders.data : data.data?.[keyFor[id]];
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: account.preferences?.timezone ?? "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const filtered =
      id === "todayCalendar"
        ? rows?.filter((row) =>
            row.allDay
              ? String(row.startDate) <= today && String(row.endDate) > today
              : !!row.startsAt &&
                localDate(account.preferences?.timezone ?? "Europe/Kyiv", new Date(String(row.startsAt))) === today,
          )
        : id === "priorityTasks"
          ? rows?.filter((row) => !["done", "cancelled"].includes(String(row.status)))
          : rows;
    return filtered?.length ? (
      <div className="space-y-3">
        {filtered.slice(0, 5).map((row) => (
          <div key={row.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
            <span className="size-2 shrink-0 rounded-full bg-primary" />
            <span className="truncate text-sm">{label(row)}</span>
            {row.status ? (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t(String(row.status))}</span>
            ) : null}
          </div>
        ))}
      </div>
    ) : (
      <Empty />
    );
  }
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-heading">{t("dashboard")}</h1>
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
              <select
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
              </select>
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {widgets
            .filter(
              (widget) =>
                widget.visible &&
                !account.preferences?.hiddenModules.includes(
                  definitions.find((entry) => entry.id === widget.id)?.module as Preferences["hiddenModules"][number],
                ),
            )
            .map((widget) => (
              <section key={widget.id} className={`surface ${widget.size === "large" ? "md:col-span-2" : ""}`}>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{t(widget.id)}</h2>
                  <Link
                    href={definitions.find((entry) => entry.id === widget.id)?.path ?? "/dashboard"}
                    aria-label={t(widget.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
                {content(widget.id)}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
