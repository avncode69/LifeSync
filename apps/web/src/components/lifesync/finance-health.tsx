"use client";
import { formatDecimal } from "@lifesync/i18n";
import { ArrowDownLeft, ArrowUpRight, Droplets } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { localDate } from "@/lib/time";
import { LifeDateInput, LifeSelect } from "./controls";
import { FinanceReport, Transfer } from "./finance-report";
import { MealJournal } from "./meal-journal";
import { useLocale } from "./providers";
import { ResourcePanel } from "./resource";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";

type FinanceSummary = {
  month: string;
  baseCurrency: string;
  accounts: { id: string; name: string; currency: string; balance: string }[];
  totals: { currency: string; type: string; amount: string }[];
  categories: { currency: string; category_id: string; name: string; amount: string }[];
  budgets: {
    id: string;
    name: string;
    amount: string;
    currency: string;
    warning_threshold: number;
    consumed: string;
  }[];
  savings: { id: string; name: string; target_amount: string; currency: string; current_amount: string }[];
};
export function Finance() {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const [month, setMonth] = useState(() => localDate(preferences?.timezone ?? "Europe/Kyiv").slice(0, 7));
  const [section, setSection] = useState("transactions");
  const [transactionView, setTransactionView] = useState("financeTransactions");
  const [planningView, setPlanningView] = useState("budgets");
  const [accountView, setAccountView] = useState("financialAccounts");
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("resource") ?? "";
    if (["budgets", "savingsGoals", "savingsContributions"].includes(requested)) {
      setSection("planning");
      setPlanningView(requested);
    } else if (["financialAccounts", "financeCategories"].includes(requested)) {
      setSection("accounts");
      setAccountView(requested);
    } else if (requested === "recurringTransactions") setTransactionView(requested);
  }, []);
  const summary = useApi<FinanceSummary>(`/finance/summary?month=${month}-01`);

  useEffect(() => {
    const refresh = () => void summary.reload();
    window.addEventListener("lifesync:finance", refresh);
    return () => window.removeEventListener("lifesync:finance", refresh);
  }, [summary.reload]);
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-heading">{t("finance")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("baseCurrency")}: {summary.data?.baseCurrency ?? preferences?.baseCurrency}
          </p>
        </div>
        <input
          className="control w-auto"
          type="month"
          aria-label={t("month")}
          value={month}
          onChange={(event) => {
            if (event.target.value) setMonth(event.target.value);
          }}
        />
      </div>
      <SectionNav
        label="finance"
        sections={["transactions", "planning", "accounts"]}
        value={section}
        onChange={setSection}
      />
      {summary.loading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorState error={summary.error} retry={() => void summary.reload()} />
      ) : (
        summary.data && (
          <>
            {section === "accounts" && (
              <div className="grid gap-4 md:grid-cols-3">
                {summary.data.accounts.map((account) => (
                  <article key={account.id} className="surface">
                    <p className="text-sm text-muted-foreground">{account.name}</p>
                    <p className="mt-5 text-3xl font-semibold tabular-nums tracking-tight">
                      {formatDecimal(account.balance, locale)}{" "}
                      <span className="text-lg text-muted-foreground">{account.currency}</span>
                    </p>
                  </article>
                ))}
                {!summary.data.accounts.length && (
                  <div className="md:col-span-3">
                    <Empty />
                  </div>
                )}
              </div>
            )}
            {section === "transactions" && transactionView === "reports" && (
              <div className="grid gap-5 md:grid-cols-2">
                <section className="surface">
                  <h2 className="text-lg font-semibold">{t("reports")}</h2>
                  <div className="mt-5 space-y-4">
                    {summary.data.totals.map((total) => (
                      <div key={`${total.currency}-${total.type}`} className="flex items-center gap-3 border-t pt-3">
                        <span
                          className={`rounded-lg p-2 ${total.type === "income" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"}`}
                        >
                          {total.type === "income" ? (
                            <ArrowDownLeft className="size-4" />
                          ) : (
                            <ArrowUpRight className="size-4" />
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">{t(total.type)}</span>
                        <span className="ml-auto font-semibold tabular-nums">
                          {formatDecimal(total.amount, locale)} {total.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="surface">
                  <h2 className="text-lg font-semibold">{t("categories")}</h2>
                  {summary.data.categories.length ? (
                    <div className="mt-5 space-y-4">
                      {summary.data.categories.map((category) => (
                        <div key={`${category.category_id}-${category.currency}`}>
                          <div className="mb-2 flex justify-between gap-3 text-sm">
                            <span>{category.name || t("noSelection")}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {formatDecimal(category.amount, locale)} {category.currency}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(100, (Math.abs(Number(category.amount)) / Math.max(1, ...(summary.data?.categories ?? []).filter((item) => item.currency === category.currency).map((item) => Math.abs(Number(item.amount))))) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty />
                  )}
                </section>
              </div>
            )}
            {section === "planning" && (
              <div className="grid gap-5 md:grid-cols-2">
                <ProgressCards
                  title="budgets"
                  items={summary.data.budgets.map((budget) => ({
                    id: budget.id,
                    name: budget.name,
                    current: budget.consumed,
                    target: budget.amount,
                    currency: budget.currency,
                  }))}
                />
                <ProgressCards
                  title="savingsGoals"
                  items={summary.data.savings.map((goal) => ({
                    id: goal.id,
                    name: goal.name,
                    current: goal.current_amount,
                    target: goal.target_amount,
                    currency: goal.currency,
                  }))}
                />
              </div>
            )}
          </>
        )
      )}
      {section === "transactions" && (
        <div className="space-y-6">
          <ViewSelect
            value={transactionView}
            onChange={setTransactionView}
            options={[
              ["financeTransactions", "transactions"],
              ["reports", "reports"],
              ["recurringTransactions", "recurring"],
            ]}
          />
          {transactionView === "reports" ? (
            <FinanceReport
              month={month}
              currency={summary.data?.baseCurrency ?? preferences?.baseCurrency ?? "UAH"}
              categories={summary.data?.categories ?? []}
            />
          ) : (
            <ResourcePanel
              key={transactionView}
              resource={transactionView === "recurringTransactions" ? "recurringTransactions" : "financeTransactions"}
              title={transactionView === "recurringTransactions" ? "recurring" : "transactions"}
            />
          )}
        </div>
      )}
      {section === "planning" && (
        <div className="space-y-6">
          <ViewSelect
            value={planningView}
            onChange={setPlanningView}
            options={[
              ["budgets", "budgets"],
              ["savingsGoals", "savingsGoals"],
              ["savingsContributions", "contributions"],
            ]}
          />
          <ResourcePanel
            key={planningView}
            resource={
              planningView === "savingsGoals"
                ? "savingsGoals"
                : planningView === "savingsContributions"
                  ? "savingsContributions"
                  : "budgets"
            }
          />
        </div>
      )}
      {section === "accounts" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ViewSelect
              value={accountView}
              onChange={setAccountView}
              options={[
                ["financialAccounts", "accounts"],
                ["financeCategories", "categories"],
              ]}
            />
            <Transfer accounts={summary.data?.accounts ?? []} refresh={() => void summary.reload()} />
          </div>
          <ResourcePanel
            key={accountView}
            resource={accountView === "financeCategories" ? "financeCategories" : "financialAccounts"}
            title={accountView === "financeCategories" ? "categories" : "accounts"}
          />
        </div>
      )}
    </div>
  );
}
function ProgressCards({
  title,
  items,
}: {
  title: string;
  items: { id: string; name: string; current: string; target: string; currency: string }[];
}) {
  const { t, locale } = useLocale();
  return (
    <section className="surface">
      <h2 className="text-lg font-semibold">{t(title)}</h2>
      <div className="mt-5 space-y-5">
        {items.length ? (
          items.map((item) => {
            const ratio = Math.min(100, Math.max(0, (Number(item.current) / Number(item.target)) * 100));
            return (
              <div key={item.id}>
                <div className="mb-2 flex justify-between gap-3 text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">
                    {formatDecimal(item.current, locale)} / {formatDecimal(item.target, locale)} {item.currency}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={item.name}
                  aria-valuenow={Math.round(ratio)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 rounded-full bg-muted"
                >
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <Empty />
        )}
      </div>
    </section>
  );
}
type HealthSummary = {
  date: string;
  profile: Row | null;
  macros: Record<string, string>;
  waterMl: number;
  measurements: Row[];
  workouts: Row[];
};
export function Health() {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const [date, setDate] = useState(() => localDate(preferences?.timezone ?? "Europe/Kyiv"));
  useEffect(() => {
    if (preferences?.timezone) setDate(localDate(preferences.timezone));
  }, [preferences?.timezone]);
  const [section, setSection] = useState("nutrition");
  const [nutritionView, setNutritionView] = useState("journal");
  const [workoutView, setWorkoutView] = useState("workoutSessions");
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("resource") ?? "";
    if (requested === "customFoods") setNutritionView("customFoods");
    else if (requested === "waterEntries") setSection("water");
    else if (requested === "bodyMeasurements") setSection("body");
    else if (requested === "healthProfiles") setSection("settings");
    else if (
      ["workoutSessions", "workoutSets", "workoutTemplates", "workoutTemplateExercises", "exercises"].includes(
        requested,
      )
    ) {
      setSection("workouts");
      setWorkoutView(requested === "workoutSets" ? "workoutSessions" : requested);
    }
  }, []);
  const summary = useApi<HealthSummary>(`/health/summary?date=${date}`);
  useEffect(() => {
    const refresh = () => void summary.reload();
    window.addEventListener("lifesync:health", refresh);
    return () => window.removeEventListener("lifesync:health", refresh);
  }, [summary.reload]);
  const [pending, setPending] = useState(false);
  const [waterVersion, setWaterVersion] = useState(0);
  async function water(amount: number) {
    if (pending) return;
    setPending(true);
    try {
      await api("/health/water", {
        method: "POST",
        body: JSON.stringify({ date, amountMl: amount }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      await summary.reload();
      setWaterVersion((previous) => previous + 1);
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-heading">{t("health")}</h1>
        <LifeDateInput
          className="control w-auto"
          type="date"
          aria-label={t("date")}
          value={date}
          onChange={(event) => {
            if (event.target.value) setDate(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionNav
          label="health"
          sections={["nutrition", "water", "body", "workouts"]}
          value={section}
          onChange={setSection}
        />
        <Button
          variant={section === "settings" ? "secondary" : "ghost"}
          className="min-h-11"
          onClick={() => setSection("settings")}
        >
          {t("healthSettings")}
        </Button>
      </div>
      {summary.loading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorState error={summary.error} retry={() => void summary.reload()} />
      ) : (
        summary.data && (
          <>
            {section === "nutrition" && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {["calories", "protein", "fat", "carbohydrates"].map((key) => {
                  const targets: Record<string, string> = {
                    calories: "calorieTarget",
                    protein: "proteinTarget",
                    fat: "fatTarget",
                    carbohydrates: "carbohydrateTarget",
                  };
                  const target = Number(summary.data?.profile?.[targets[key]] ?? 0);
                  const current = Number(summary.data?.macros[key] ?? 0);
                  return (
                    <article key={key} className="surface">
                      <p className="text-sm text-muted-foreground">{t(key)}</p>
                      <p className="mt-4 text-3xl font-semibold">
                        {formatDecimal(summary.data?.macros[key] ?? "0", locale)}
                      </p>
                      {target > 0 && (
                        <>
                          <p className="mt-1 text-xs text-muted-foreground">/ {target}</p>
                          <div
                            role="progressbar"
                            aria-label={t(key)}
                            aria-valuenow={Math.min(100, Math.round((current / target) * 100))}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="mt-4 h-1.5 rounded-full bg-muted"
                          >
                            <div
                              className="h-1.5 rounded-full bg-primary"
                              style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
                            />
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <div>
              {section === "water" && (
                <section className="surface">
                  <div className="flex items-center gap-2">
                    <Droplets className="size-5 text-primary" />
                    <h2 className="text-lg font-semibold">{t("water")}</h2>
                  </div>
                  <p className="my-6 text-4xl font-semibold">
                    {summary.data.waterMl}
                    <span className="ml-2 text-lg text-muted-foreground">ml</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[250, 500].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => void water(amount)}
                      >
                        + {amount} ml
                      </Button>
                    ))}
                  </div>
                </section>
              )}
              {section === "body" && (
                <section className="surface">
                  <h2 className="text-lg font-semibold">{t("measurements")}</h2>
                  {summary.data.measurements.length ? (
                    <>
                      <p className="my-5 text-4xl font-semibold">
                        {String(summary.data.measurements[0]?.weightKg ?? "—")}{" "}
                        <span className="text-lg text-muted-foreground">kg</span>
                      </p>
                      <Trend rows={[...summary.data.measurements].reverse()} field="weightKg" label={t("weightKg")} />
                    </>
                  ) : (
                    <Empty />
                  )}
                </section>
              )}
            </div>
          </>
        )
      )}
      {section === "nutrition" && (
        <div className="space-y-6">
          <ViewSelect
            value={nutritionView}
            onChange={setNutritionView}
            options={[
              ["journal", "mealJournal"],
              ["customFoods", "foodCatalog"],
            ]}
          />
          {nutritionView === "customFoods" ? (
            <ResourcePanel resource="customFoods" title="foodCatalog" />
          ) : (
            <MealJournal date={date} onDateChange={setDate} />
          )}
        </div>
      )}
      {section === "water" && (
        <ResourcePanel key={`${date}-${waterVersion}`} resource="waterEntries" title="water" initial={{ date }} />
      )}
      {section === "body" && <ResourcePanel resource="bodyMeasurements" title="measurements" initial={{ date }} />}
      {section === "settings" && (
        <div className="space-y-5">
          <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">{t("healthNotice")}</p>
          <ResourcePanel resource="healthProfiles" title="profiles" />
        </div>
      )}
      {section === "workouts" && (
        <div className="space-y-6">
          <ViewSelect
            value={workoutView}
            onChange={setWorkoutView}
            options={[
              ["workoutSessions", "workouts"],
              ["workoutTemplates", "templates"],
              ["workoutTemplateExercises", "templateExercises"],
              ["exercises", "exercises"],
            ]}
          />
          {workoutView === "workoutSessions" ? (
            <ResourcePanel
              key="workoutSessions"
              resource="workoutSessions"
              title="workouts"
              renderExtra={(row) => (
                <details className="mt-4 border-t pt-4">
                  <summary className="cursor-pointer text-sm font-medium">{t("sets")}</summary>
                  <div className="mt-4">
                    <ResourcePanel key={row.id} resource="workoutSets" title="sets" initial={{ sessionId: row.id }} />
                  </div>
                </details>
              )}
            />
          ) : workoutView === "workoutTemplates" ? (
            <ResourcePanel
              key="workoutTemplates"
              resource="workoutTemplates"
              title="templates"
              renderExtra={(row, refresh) => <StartWorkout row={row} refresh={refresh} />}
            />
          ) : (
            <ResourcePanel
              key={workoutView}
              resource={workoutView === "exercises" ? "exercises" : "workoutTemplateExercises"}
            />
          )}
        </div>
      )}
    </div>
  );
}
function Trend({ rows, field, label }: { rows: Row[]; field: string; label: string }) {
  const points = rows.filter((row) => row[field] != null).map((row) => Number(row[field]));
  if (points.length < 2) return null;
  const min = Math.min(...points),
    max = Math.max(...points);
  const path = points
    .map(
      (point, index) =>
        `${(index / (points.length - 1)) * 280 + 10},${90 - ((point - min) / Math.max(1, max - min)) * 70}`,
    )
    .join(" ");
  return (
    <figure>
      <svg viewBox="0 0 300 110" role="img" aria-label={label} className="h-28 w-full text-primary">
        <title>{label}</title>
        <polyline
          points={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>{String(rows[0]?.date)}</span>
        <span>{String(rows[rows.length - 1]?.date)}</span>
      </figcaption>
    </figure>
  );
}

function StartWorkout({ row, refresh }: { row: Row; refresh: () => void }) {
  const { t } = useLocale();
  const [pending, setPending] = useState(false);
  async function start() {
    if (pending) return;
    setPending(true);
    try {
      const session = await api<Row>(`/health/templates/${row.id}/start`, {
        method: "POST",
        body: JSON.stringify({ startsAt: new Date().toISOString() }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      refresh();
      toast.success(t("saved"), {
        action: {
          label: t("show"),
          onClick: () => location.assign(`/health?resource=workoutSessions&item=${session.id}`),
        },
      });
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <Button variant="outline" className="mt-4 min-h-11" disabled={pending} onClick={() => void start()}>
      {t(pending ? "loading" : "startWorkout")}
    </Button>
  );
}

function SectionNav({
  label,
  sections,
  value,
  onChange,
}: {
  label: string;
  sections: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useLocale();
  return (
    <nav aria-label={t(label)} className="flex max-w-full flex-wrap gap-1 rounded-xl border bg-muted/40 p-1">
      {sections.map((section) => (
        <Button
          key={section}
          variant={value === section ? "secondary" : "ghost"}
          aria-pressed={value === section}
          className="min-h-11 px-4"
          onClick={() => onChange(section)}
        >
          {t(section)}
        </Button>
      ))}
    </nav>
  );
}

function ViewSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  const { t } = useLocale();
  return (
    <div className="w-full sm:max-w-xs">
      <LifeSelect
        aria-label={t("view")}
        className="control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([key, title]) => (
          <option key={key} value={key}>
            {t(title)}
          </option>
        ))}
      </LifeSelect>
    </div>
  );
}
