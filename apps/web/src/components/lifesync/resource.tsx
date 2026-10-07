"use client";
import { type ResourceName, resourceRegistry } from "@lifesync/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, errorKey, label, type Row, useApi } from "@/lib/api";
import { displayInstant, inputInstant, localInput } from "@/lib/time";
import { useLocale } from "./providers";
import { RecurrenceInput } from "./recurrence";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";

type Property = {
  type?: string | string[];
  anyOf?: Property[];
  enum?: unknown[];
  default?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  properties?: Record<string, Property>;
};
const targetFields = ["projectId", "taskId", "eventId", "transactionId", "inboxItemId", "habitId"];
function normalize(property: Property): Property {
  const alternative = property.anyOf?.find((entry) => entry.type !== "null");
  return alternative ? { ...property, ...alternative } : property;
}
function kind(property: Property) {
  const normalized = normalize(property);
  return Array.isArray(normalized.type) ? normalized.type.find((entry) => entry !== "null") : normalized.type;
}
export function ResourceEditor({
  resource,
  row,
  initial,
  onClose,
  onSaved,
  saveOverride,
}: {
  resource: ResourceName;
  row?: Row;
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
  saveOverride?: (input: Record<string, unknown>) => Promise<unknown>;
}) {
  const registry = resourceRegistry[resource];
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const timezone = preferences?.timezone ?? "Europe/Kyiv";
  const idempotency = useRef(crypto.randomUUID());
  const schema = row ? registry.updateSchema : registry.createSchema;
  const json = z.toJSONSchema(registry.createSchema, { unrepresentable: "any" }) as {
    properties?: Record<string, Property>;
    required?: string[];
  };
  const properties = json.properties ?? {};
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...Object.fromEntries(
      Object.entries(properties)
        .filter(([, p]) => p.default !== undefined)
        .map(([key, p]) => [key, p.default]),
    ),
    ...(properties.timezone ? { timezone } : {}),
    ...(resource === "reminderRules" ? { triggerType: "offset", offsetMinutes: 10, channels: ["in_app"] } : {}),
    ...(row ?? initial),
  }));
  const [targetField, setTargetField] = useState(() => targetFields.find((key) => (row ?? initial)?.[key]) ?? "taskId");
  const polymorphic = ["reminderRules", "driveLinks"].includes(resource);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [parents, setParents] = useState<Record<string, Row[]>>({});
  const [parentError, setParentError] = useState(false);
  const [relationVersion, setRelationVersion] = useState(0);
  useEffect(() => {
    let active = true;
    if (relationVersion > 0) setParents({});
    setParentError(false);
    const relations = {
      ...registry.relations,
      ...(["reminderRules", "driveLinks"].includes(resource)
        ? {
            projectId: "projects",
            taskId: "tasks",
            eventId: "calendarEvents",
            transactionId: "financeTransactions",
            inboxItemId: "inboxItems",
            habitId: "habits",
          }
        : {}),
    } as Record<string, ResourceName>;
    void Promise.all(
      Object.entries(relations).map(async ([field, parent]) => {
        try {
          const rows = await api<Row[]>(`${resourceRegistry[parent].path}?limit=100`);
          if (active) setParents((previous) => ({ ...previous, [field]: rows }));
        } catch {
          if (active) setParentError(true);
        }
      }),
    );
    return () => {
      active = false;
    };
  }, [registry, resource, relationVersion]);
  function update(key: string, value: unknown) {
    setValues((previous) => {
      const next = { ...previous, [key]: value };
      if (resource === "reminderRules" && key === "triggerType") {
        if (value === "offset") {
          next.offsetMinutes = 10;
          delete next.exactAt;
        } else {
          delete next.offsetMinutes;
        }
      }
      if (resource === "calendarEvents" && key === "allDay") {
        if (value) {
          delete next.startsAt;
          delete next.endsAt;
        } else {
          delete next.startDate;
          delete next.endDate;
        }
      }
      if (resource === "mealEntryItems" && (key === "foodId" || key === "quantityGrams")) {
        const food = parents.foodId?.find((item) => item.id === next.foodId);
        if (food) {
          next.name = food.name;
          const grams = Number(next.quantityGrams ?? food.servingGrams ?? 100);
          next.quantityGrams = String(grams);
          for (const macro of ["calories", "protein", "fat", "carbohydrates"])
            next[macro] = (
              (Number(food[macro] ?? 0) * grams) /
              Math.max(0.001, Number(food.servingGrams ?? 100))
            ).toFixed(3);
        }
      }
      return next;
    });
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending || !navigator.onLine) return;
    const input: Record<string, unknown> = {};
    const parsing: Record<string, string> = {};
    for (const [key, property] of Object.entries(properties)) {
      const value = values[key];
      if (value === "" || value === undefined) {
        if (row && key === "recurrenceRule") input[key] = null;
        continue;
      }
      if (["servingGrams", "quantityGrams"].includes(key) && Number(value) <= 0) parsing[key] = t("invalid");
      if (key === "recurrenceRule" && value) {
        const interval = Number(/INTERVAL=(\d+)/.exec(String(value))?.[1] ?? 1);
        if (interval < 1 || interval > 365) parsing[key] = t("invalid");
      }
      const type = kind(property);
      if ((type === "object" || type === "array") && typeof value === "string") {
        try {
          input[key] = JSON.parse(value);
        } catch {
          parsing[key] = t("invalid");
        }
      } else if (type === "number" || type === "integer") input[key] = Number(value);
      else if (normalize(property).format === "date-time" && typeof value === "string") {
        try {
          input[key] = value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value) ? value : inputInstant(value, timezone);
        } catch {
          parsing[key] = t("invalid");
        }
      } else input[key] = value;
    }
    const validated = schema.safeParse(input);
    if (!validated.success) {
      for (const issue of validated.error.issues)
        parsing[issue.path[0] === undefined ? "_form" : String(issue.path[0])] = t("invalid");
    }
    setErrors(parsing);
    if (Object.keys(parsing).length || !validated.success) return;
    setPending(true);
    try {
      if (saveOverride) await saveOverride(validated.data);
      else
        await api(`${registry.path}${row ? `/${row.id}` : ""}`, {
          method: row ? "PATCH" : "POST",
          body: JSON.stringify(validated.data),
          headers: { "Idempotency-Key": idempotency.current },
        });
      toast.success(t("saved"));
      if (resourceRegistry[resource].path.startsWith("/finance/")) window.dispatchEvent(new Event("lifesync:finance"));
      onSaved();
      onClose();
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle>
          {t(row ? "edit" : "create")} · {t(resource)}
        </DialogTitle>
        <DialogDescription>
          {t("required")} * · {timezone}
        </DialogDescription>
        {parentError && (
          <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">
            <p>{t("error")}</p>
            <Button type="button" variant="outline" onClick={() => setRelationVersion(relationVersion + 1)}>
              {t("retry")}
            </Button>
          </div>
        )}
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          {polymorphic && (
            <div className="sm:col-span-2">
              <label htmlFor="target-type" className="mb-2 block text-sm font-medium">
                {t("target")}
              </label>
              <select
                id="target-type"
                className="control"
                value={targetField}
                onChange={(event) => {
                  setTargetField(event.target.value);
                  setValues((previous) =>
                    Object.fromEntries(Object.entries(previous).filter(([key]) => !targetFields.includes(key))),
                  );
                }}
              >
                {targetFields.map((key) => (
                  <option key={key} value={key}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {Object.entries(properties)
            .filter(
              ([key]) =>
                (!polymorphic || !targetFields.includes(key) || key === targetField) &&
                !["exchangeRateId", "occurrenceDate", "completedAt"].includes(key) &&
                (resource !== "reminderRules" || key !== "exactAt" || values.triggerType === "exact") &&
                (resource !== "reminderRules" || key !== "offsetMinutes" || values.triggerType === "offset") &&
                (resource !== "calendarEvents" ||
                  !(
                    (["startDate", "endDate"].includes(key) && !values.allDay) ||
                    (["startsAt", "endsAt"].includes(key) && !!values.allDay)
                  )),
            )
            .map(([key, raw]) => {
              const property = normalize(raw);
              const type = kind(property);
              const options = property.enum;
              const value = values[key];
              const required = json.required?.includes(key);
              const relation =
                key in registry.relations || (polymorphic && targetFields.includes(key))
                  ? (parents[key] ?? [])
                  : undefined;
              let input: React.ReactNode;
              const common = {
                id: `field-${key}`,
                "aria-invalid": !!errors[key],
                "aria-describedby": errors[key] ? `error-${key}` : undefined,
                disabled:
                  pending ||
                  (resource === "mealEntryItems" &&
                    !!values.foodId &&
                    ["name", "calories", "protein", "fat", "carbohydrates"].includes(key)),
                className: "control",
              };
              if (relation)
                input = (
                  <select {...common} value={String(value ?? "")} onChange={(event) => update(key, event.target.value)}>
                    <option value="">{t("noSelection")}</option>
                    {relation.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {label(parent)}
                      </option>
                    ))}
                  </select>
                );
              else if (key === "recurrenceRule")
                input = (
                  <RecurrenceInput
                    value={String(value ?? "")}
                    onChange={(value) => update(key, value)}
                    disabled={pending}
                  />
                );
              else if (options)
                input = (
                  <select {...common} value={String(value ?? "")} onChange={(event) => update(key, event.target.value)}>
                    <option value="">{t("noSelection")}</option>
                    {options.map((option) => (
                      <option key={String(option)} value={String(option)}>
                        {t(String(option))}
                      </option>
                    ))}
                  </select>
                );
              else if (type === "boolean")
                input = (
                  <input
                    {...common}
                    className="size-5 accent-violet-600"
                    type="checkbox"
                    checked={!!value}
                    onChange={(event) => update(key, event.target.checked)}
                  />
                );
              else if (type === "array") {
                const choices = key === "weekdays" ? [0, 1, 2, 3, 4, 5, 6] : ["in_app", "push"];
                const selected = Array.isArray(value) ? value : [];
                input = (
                  <div className="flex flex-wrap gap-2">
                    {choices.map((choice) => (
                      <label key={String(choice)} className="flex items-center gap-2 rounded-lg border p-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(choice)}
                          onChange={(event) =>
                            update(
                              key,
                              event.target.checked ? [...selected, choice] : selected.filter((item) => item !== choice),
                            )
                          }
                        />
                        {typeof choice === "number"
                          ? new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 7 + choice))
                          : t(choice)}
                      </label>
                    ))}
                  </div>
                );
              } else if (["description", "content", "notes", "note"].includes(key))
                input = (
                  <textarea
                    {...common}
                    rows={3}
                    value={String(value ?? "")}
                    onChange={(event) => update(key, event.target.value)}
                  />
                );
              else {
                const dateTime = property.format === "date-time";
                const date = property.format === "date";
                input = (
                  <input
                    {...common}
                    type={
                      dateTime
                        ? "datetime-local"
                        : date
                          ? "date"
                          : type === "integer" || type === "number"
                            ? "number"
                            : key === "color"
                              ? "color"
                              : "text"
                    }
                    min={property.minimum}
                    max={property.maximum}
                    minLength={property.minLength}
                    maxLength={property.maxLength}
                    step={type === "integer" ? "1" : "any"}
                    value={
                      dateTime && typeof value === "string" && (value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value))
                        ? localInput(value, timezone)
                        : String(value ?? "")
                    }
                    onChange={(event) => update(key, event.target.value)}
                  />
                );
              }
              return (
                <div
                  key={key}
                  className={
                    type === "array" || type === "object" || ["description", "content"].includes(key)
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <label className="mb-2 block text-sm font-medium" htmlFor={`field-${key}`}>
                    {t(key)}
                    {required && " *"}
                  </label>
                  {input}
                  {errors[key] && (
                    <p id={`error-${key}`} className="mt-1 text-xs text-destructive">
                      {errors[key]}
                    </p>
                  )}
                </div>
              );
            })}
          {errors._form && (
            <p role="alert" className="sm:col-span-2 text-sm text-destructive">
              {errors._form}
            </p>
          )}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card pt-4 sm:col-span-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || parentError} className="min-h-11">
              {t(pending ? "loading" : "save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ResourcePanel({
  resource,
  title,
  initial,
  renderExtra,
}: {
  resource: ResourceName;
  title?: string;
  initial?: Record<string, unknown>;
  renderExtra?: (row: Row, refresh: () => void) => React.ReactNode;
}) {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const path = resourceRegistry[resource].path;
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useApi<Row[]>(`${path}?limit=100`);
  const [editor, setEditor] = useState<Row | "new">();
  const openedLink = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    const query = new URLSearchParams(location.search);
    const id = query.get("item");
    if (query.get("resource") === resource && id && openedLink.current !== id) {
      const row = data.find((item) => item.id === id);
      if (row) {
        openedLink.current = id;
        setEditor(row);
      }
    }
  }, [data, resource]);
  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (row) =>
          (!initial || Object.entries(initial).every(([key, value]) => row[key] === value)) &&
          (!query || label(row).toLowerCase().includes(query.toLowerCase())),
      ),
    [data, query, initial],
  );
  async function remove(row: Row) {
    try {
      await api(`${path}/${row.id}`, { method: "DELETE" });
      toast.success(t("removed"), {
        action: {
          label: t("undo"),
          onClick: () => {
            void api(`${path}/${row.id}/restore`, { method: "POST" })
              .then(reload)
              .catch((error) => toast.error(t(errorKey(error))));
          },
        },
      });
      await reload();
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t(title ?? resource)}</h2>
        <Button disabled={loading} onClick={() => setEditor("new")} className="min-h-11 gap-2">
          <Plus />
          {t("create")}
        </Button>
      </div>
      <input
        className="control max-w-md"
        aria-label={t("search")}
        placeholder={t("search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => void reload()} />
      ) : !rows.length ? (
        <Empty />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="transition hover:ring-primary/40">
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{label(row)}</h3>
                    {row.description || row.note || row.content ? (
                      <p className="mt-1 line-clamp-3 break-words text-sm text-muted-foreground">
                        {String(row.description ?? row.note ?? row.content)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      className="min-h-10 min-w-10"
                      aria-label={t("edit")}
                      onClick={() => setEditor(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10 min-w-10 text-muted-foreground hover:text-destructive"
                      aria-label={t("delete")}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {Object.entries(row)
                    .filter(
                      ([key, value]) =>
                        ![
                          "id",
                          "userId",
                          "createdAt",
                          "updatedAt",
                          "deletedAt",
                          "name",
                          "title",
                          "description",
                          "note",
                          "content",
                        ].includes(key) &&
                        value !== null &&
                        typeof value !== "object" &&
                        !key.endsWith("Id"),
                    )
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="inline">{t(key)}: </dt>
                        <dd className="inline font-medium text-foreground">
                          {typeof value === "boolean"
                            ? value
                              ? t("enabled")
                              : t("disabled")
                            : typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)
                              ? displayInstant(
                                  value,
                                  locale,
                                  preferences?.timezone ?? "Europe/Kyiv",
                                  preferences?.timeFormat,
                                )
                              : t(String(value))}
                        </dd>
                      </div>
                    ))}
                </dl>
                {renderExtra?.(row, () => void reload())}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {editor && (
        <ResourceEditor
          resource={resource}
          row={editor === "new" ? undefined : editor}
          initial={initial}
          onClose={() => setEditor(undefined)}
          onSaved={() => void reload()}
        />
      )}
    </section>
  );
}
export function ResourceTabs({
  tabs,
}: {
  tabs: {
    resource: ResourceName;
    label: string;
    initial?: Record<string, unknown>;
    renderExtra?: (row: Row, refresh: () => void) => React.ReactNode;
  }[];
}) {
  const { t } = useLocale();
  const [selectedResource, setSelectedResource] = useState(tabs[0].resource);
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("resource");
    if (requested) setSelectedResource(requested as ResourceName);
  }, []);
  const active = tabs.find((tab) => tab.resource === selectedResource) ?? tabs[0];
  return (
    <div className="space-y-6">
      <div role="tablist" className="flex max-w-full gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.resource}
            role="tab"
            aria-selected={active.resource === tab.resource}
            variant={active.resource === tab.resource ? "default" : "outline"}
            className="min-h-11"
            onClick={() => setSelectedResource(tab.resource)}
          >
            {t(tab.label)}
          </Button>
        ))}
      </div>
      <ResourcePanel
        key={active.resource}
        resource={active.resource}
        title={active.label}
        renderExtra={active.renderExtra}
        initial={active.initial}
      />
    </div>
  );
}
