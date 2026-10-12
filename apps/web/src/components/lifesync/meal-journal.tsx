"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { ErrorState, Loading } from "./states";

export function MealJournal({ date, onDateChange }: { date: string; onDateChange: (date: string) => void }) {
  const { t } = useLocale();
  const meals = useApi<Row[]>("/health/meals?limit=100");
  const [linkedPortionId, setLinkedPortionId] = useState<string>();
  const linkedPortions = useApi<Row[]>(linkedPortionId ? "/health/meal-items?limit=100" : null);
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<Row | "new">();
  const [pending, setPending] = useState(false);
  const createKey = useRef<string>(crypto.randomUUID());
  const openedLink = useRef<string | undefined>(undefined);
  const rows = (meals.data ?? []).filter((row) => row.date === date);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("resource") === "mealEntryItems") setLinkedPortionId(params.get("item") ?? undefined);
  }, []);

  useEffect(() => {
    const refresh = () => void meals.reload();
    window.addEventListener("lifesync:health", refresh);
    return () => window.removeEventListener("lifesync:health", refresh);
  }, [meals.reload]);

  useEffect(() => {
    if (!meals.data) return;
    const params = new URLSearchParams(location.search);
    const id = params.get("item");
    if (!id || openedLink.current === id) return;
    const isPortion = params.get("resource") === "mealEntryItems";
    if (!isPortion && params.get("resource") !== "mealEntries") return;
    const mealId = isPortion ? linkedPortions.data?.find((row) => row.id === id)?.mealEntryId : id;
    const meal = meals.data.find((row) => row.id === mealId);
    if (meal) {
      openedLink.current = id;
      onDateChange(String(meal.date));
      setSelectedId(meal.id);
      if (!isPortion) {
        createKey.current = crypto.randomUUID();
        setEditor(meal);
      }
    }
  }, [meals.data, linkedPortions.data, onDateChange]);

  async function remove(meal: Row) {
    if (pending) return;
    setPending(true);
    try {
      await api(`/health/meals/${meal.id}`, { method: "DELETE" });
      toast.success(t("removed"), {
        action: {
          label: t("undo"),
          onClick: () => {
            void api(`/health/meals/${meal.id}/restore`, { method: "POST" })
              .then(() => {
                window.dispatchEvent(new Event("lifesync:health"));
              })
              .catch((error) => toast.error(t(errorKey(error))));
          },
        },
      });
      window.dispatchEvent(new Event("lifesync:health"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("mealJournal")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("mealJournalHint")}</p>
        </div>
        <Button
          className="min-h-11 gap-2"
          disabled={meals.loading || !!meals.error}
          onClick={() => {
            createKey.current = crypto.randomUUID();
            setEditor("new");
          }}
        >
          <Plus className="size-4" />
          {t("addMeal")}
        </Button>
      </div>
      {meals.loading ? (
        <Loading />
      ) : meals.error ? (
        <ErrorState error={meals.error} retry={() => void meals.reload()} />
      ) : !rows.length ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("addFirstMealHint")}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav aria-label={t("meals")} className="flex flex-col gap-2">
            {rows.map((meal) => (
              <button
                key={meal.id}
                type="button"
                aria-pressed={selected?.id === meal.id}
                onClick={() => setSelectedId(meal.id)}
                className={`rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-ring ${
                  selected?.id === meal.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"
                }`}
              >
                <span className="block font-medium">{t(String(meal.meal))}</span>
                {meal.note ? (
                  <span className="mt-1 block break-words text-sm text-muted-foreground">{String(meal.note)}</span>
                ) : null}
              </button>
            ))}
          </nav>
          {selected && (
            <div className="min-w-0 space-y-5 rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b pb-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t("selectedMeal")}</p>
                  <h3 className="mt-1 font-semibold">{t(String(selected.meal))}</h3>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="min-h-10 min-w-10"
                    aria-label={`${t("edit")} · ${t(String(selected.meal))}`}
                    onClick={() => {
                      createKey.current = crypto.randomUUID();
                      setEditor(selected);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-10 min-w-10 text-muted-foreground hover:text-destructive"
                    aria-label={`${t("delete")} · ${t(String(selected.meal))}`}
                    disabled={pending}
                    onClick={() => void remove(selected)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <ResourcePanel
                key={selected.id}
                resource="mealEntryItems"
                title="mealItems"
                initial={{ mealEntryId: selected.id }}
                createLabel="addFoodPortion"
                editorInitial={{ quantityGrams: "100", calories: "0", protein: "0", fat: "0", carbohydrates: "0" }}
              />
            </div>
          )}
        </div>
      )}
      {editor && (
        <ResourceEditor
          resource="mealEntries"
          row={editor === "new" ? undefined : editor}
          initial={{ date, meal: "breakfast" }}
          onClose={() => setEditor(undefined)}
          onSaved={() => void meals.reload()}
          saveOverride={async (input) => {
            const saved = await api<Row>(`/health/meals${editor === "new" ? "" : `/${editor.id}`}`, {
              method: editor === "new" ? "POST" : "PATCH",
              body: JSON.stringify(input),
              headers: { "Idempotency-Key": createKey.current },
            });
            setSelectedId(saved.id);
            onDateChange(String(saved.date));
          }}
        />
      )}
    </section>
  );
}
