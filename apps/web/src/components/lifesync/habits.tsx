"use client";
import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";
export function Habits() {
  const { t } = useLocale();
  const habits = useApi<Row[]>("/habits?limit=100");
  const [editor, setEditor] = useState<Row | "new">();
  const [section, setSection] = useState("habits");
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resource = params.get("resource");
    if (resource === "habitEntries") setSection("entries");
    if (resource === "reminderRules") setSection("reminders");
    if (resource && resource !== "habits") return;
    const target = params.get("item");
    if (!target) return;
    let active = true;
    void api<Row>(`/habits/${encodeURIComponent(target)}`)
      .then((row) => {
        if (active) setEditor(row);
      })
      .catch((reason) => {
        if (active) toast.error(t(errorKey(reason)));
      });
    return () => {
      active = false;
    };
  }, [t]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">{t("habits")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("habitsHint")}</p>
        </div>
        {section === "habits" && (
          <Button disabled={habits.loading} className="min-h-11 gap-2" onClick={() => setEditor("new")}>
            <Plus />
            {t("create")}
          </Button>
        )}
      </div>
      <div
        role="tablist"
        aria-label={t("habits")}
        className="grid max-w-2xl grid-cols-3 gap-1 rounded-xl border bg-muted/40 p-1"
      >
        {["habits", "entries", "reminders"].map((key) => (
          <button
            key={key}
            id={`habit-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={section === key}
            tabIndex={section === key ? 0 : -1}
            aria-controls={`habit-panel-${key}`}
            onClick={() => setSection(key)}
            onKeyDown={(event) => {
              const sections = ["habits", "entries", "reminders"];
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const index =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? 2
                    : (sections.indexOf(key) + (event.key === "ArrowRight" ? 1 : 2)) % 3;
              setSection(sections[index]);
              document.getElementById(`habit-tab-${sections[index]}`)?.focus();
            }}
            className={`min-h-11 rounded-lg px-2 text-sm font-medium transition ${section === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`habit-panel-${section}`} aria-labelledby={`habit-tab-${section}`}>
        {section === "habits" &&
          (habits.loading ? (
            <Loading />
          ) : habits.error ? (
            <ErrorState error={habits.error} retry={() => void habits.reload()} />
          ) : !habits.data?.length ? (
            <Empty />
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {habits.data.map((habit) => (
                <HabitCard key={habit.id} row={habit} edit={() => setEditor(habit)} />
              ))}
            </div>
          ))}
        {section === "entries" && <ResourcePanel resource="habitEntries" title="entries" />}
        {section === "reminders" && <ResourcePanel resource="reminderRules" title="reminders" />}
      </section>
      {editor && (
        <ResourceEditor
          resource="habits"
          row={editor === "new" ? undefined : editor}
          initial={{ startDate: new Date().toISOString().slice(0, 10) }}
          onClose={() => setEditor(undefined)}
          onSaved={() => void habits.reload()}
        />
      )}
    </div>
  );
}
function HabitCard({ row, edit }: { row: Row; edit: () => void }) {
  const { t } = useLocale();
  const { preferences } = useAccount();
  const statistics = useApi<{
    currentStreak: number;
    bestStreak: number;
    completionPercentage: number;
    weeklyProgress: number;
    monthlyCount: number;
  }>(`/habits/${row.id}/statistics`);
  const entries = useApi<Row[]>(`/habits/entries?habitId=${row.id}&limit=100`);
  const [pending, setPending] = useState(false);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: preferences?.timezone ?? "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const ownEntries = entries.data?.filter((entry) => entry.habitId === row.id) ?? [];
  const logged = ownEntries.some((entry) => entry.date === today);
  async function log() {
    if (pending) return;
    setPending(true);
    try {
      await api("/habits/entries", {
        method: "POST",
        body: JSON.stringify({ habitId: row.id, date: today, count: row.targetCount ?? "1" }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      await entries.reload();
      await statistics.reload();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  const now = new Date();
  const days = Array.from(
    { length: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() },
    (_, index) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
  );
  return (
    <article className="surface">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{String(row.name)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(String(row.schedule))} · {String(row.weeklyGoal)}/7
          </p>
        </div>
        <Button variant="outline" onClick={edit}>
          {t("edit")}
        </Button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { key: "streak", value: statistics.data?.currentStreak },
          { key: "bestStreak", value: statistics.data?.bestStreak },
          { key: "completionRate", value: statistics.data ? `${statistics.data.completionPercentage}%` : undefined },
        ].map((metric) => (
          <div key={metric.key} className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t(metric.key)}</p>
            <p className="mt-2 text-xl font-semibold">{metric.value ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-1">
        {days.map((date) => (
          <span
            key={date}
            role="img"
            title={date}
            aria-label={`${date}: ${ownEntries.some((entry) => entry.date === date) ? t("completed") : t("noSelection")}`}
            className={`size-5 rounded-md ${ownEntries.some((entry) => entry.date === date) ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t("weeklyGoal")}: {statistics.data?.weeklyProgress ?? 0}/{String(row.weeklyGoal)}
        </span>
        <Button disabled={pending || logged} onClick={() => void log()} className="min-h-11 gap-2">
          {logged && <Check className="size-4" />}
          {t(logged ? "completed" : "logToday")}
        </Button>
      </div>
      {!!statistics.error && <p className="mt-3 text-xs text-destructive">{t(errorKey(statistics.error))}</p>}
    </article>
  );
}
