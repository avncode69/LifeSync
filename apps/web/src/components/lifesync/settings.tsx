"use client";
import { aiPermissionsSchema, type Preferences, updatePreferencesSchema } from "@lifesync/contracts";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { useLocale } from "./providers";
import { navigation, useAccount } from "./shell";
import { ErrorState, Loading } from "./states";
export function Settings({ onboarding = false }: { onboarding?: boolean }) {
  const { t, locale, setLocale } = useLocale();
  const account = useAccount();
  const prefs = useApi<Preferences>("/preferences");
  const permissions = useApi<Record<string, boolean>>("/ai/permissions");
  const [pending, setPending] = useState(false);
  const [values, setValues] = useState<Preferences>();
  const [permissionValues, setPermissionValues] = useState<Record<string, boolean>>({});
  const [offsetText, setOffsetText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (prefs.data) {
      setOffsetText(prefs.data.notificationOffsets.join(", "));
      setValues(
        onboarding ? { ...prefs.data, locale, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : prefs.data,
      );
    }
  }, [prefs.data, locale, onboarding]);
  useEffect(() => {
    if (permissions.data) setPermissionValues(permissions.data);
  }, [permissions.data]);
  function change(key: keyof Preferences, value: unknown) {
    setValues((previous) => (previous ? { ...previous, [key]: value } : previous));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !values) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      ...values,
      notificationOffsets: offsetText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map(Number),
      timezone: form.timezone,
      baseCurrency: form.baseCurrency,
      locale: form.locale,
      theme: form.theme,
      weekStart: Number(form.weekStart),
      dateFormat: form.dateFormat,
      timeFormat: form.timeFormat,
    };
    delete (body as Record<string, unknown>).id;
    delete (body as Record<string, unknown>).userId;
    delete (body as Record<string, unknown>).createdAt;
    delete (body as Record<string, unknown>).updatedAt;
    const valid = updatePreferencesSchema.safeParse(body);
    const profile = z
      .object({ name: z.string().trim().min(1).max(240), image: z.union([z.url(), z.literal("")]).optional() })
      .safeParse({ name: form.name, image: form.image });
    if (!valid.success || !profile.success) {
      setErrors(
        Object.fromEntries(
          [...(valid.success ? [] : valid.error.issues), ...(profile.success ? [] : profile.error.issues)].map(
            (issue) => [String(issue.path[0]), t("invalid")],
          ),
        ),
      );
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({ name: profile.data.name, image: profile.data.image || null }),
      });
      await api("/preferences", { method: "PATCH", body: JSON.stringify(valid.data) });
      if (valid.data.locale) setLocale(valid.data.locale);
      const checkedPermissions = aiPermissionsSchema.safeParse(permissionValues);
      if (checkedPermissions.success)
        await api("/ai/permissions", { method: "PATCH", body: JSON.stringify(checkedPermissions.data) });
      if (onboarding) {
        await api("/onboarding", { method: "POST", body: JSON.stringify({ completed: true }) });
        location.assign("/dashboard");
      }
      account.refresh();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  async function skip() {
    setPending(true);
    try {
      await api("/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          locale,
          timezone: values?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      await api("/onboarding", { method: "POST", body: JSON.stringify({ completed: true }) });
      location.assign("/dashboard");
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-heading">{t(onboarding ? "onboarding" : "settings")}</h1>
        {onboarding && (
          <Button variant="outline" disabled={pending} onClick={() => void skip()}>
            {t("skip")}
          </Button>
        )}
      </div>
      {prefs.loading ? (
        <Loading />
      ) : prefs.error ? (
        <ErrorState error={prefs.error} retry={() => void prefs.reload()} />
      ) : (
        values && (
          <form onSubmit={save} noValidate className="space-y-6">
            <section className="surface">
              <h2 className="text-lg font-semibold">{t("profile")}</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {[
                  { key: "name", value: account.user?.name },
                  { key: "image", value: account.user?.image },
                  { key: "timezone", value: values.timezone },
                  { key: "baseCurrency", value: values.baseCurrency },
                ].map(({ key, value }) => (
                  <div key={key}>
                    <label className="mb-2 block text-sm font-medium" htmlFor={key}>
                      {t(key)}
                    </label>
                    <input
                      id={key}
                      name={key}
                      className="control"
                      defaultValue={String(value ?? "")}
                      maxLength={key === "baseCurrency" ? 3 : 240}
                      aria-invalid={!!errors[key]}
                    />
                    {errors[key] && <p className="mt-1 text-xs text-destructive">{errors[key]}</p>}
                  </div>
                ))}
                {[
                  { key: "locale", options: ["uk", "en"] },
                  { key: "theme", options: ["light", "dark", "system"] },
                  { key: "weekStart", options: ["1", "0"] },
                  { key: "dateFormat", options: ["DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] },
                  { key: "timeFormat", options: ["12h", "24h"] },
                ].map(({ key, options }) => (
                  <div key={key}>
                    <label className="mb-2 block text-sm font-medium" htmlFor={key}>
                      {t(key)}
                    </label>
                    <select
                      id={key}
                      name={key}
                      className="control"
                      defaultValue={String(values[key as keyof Preferences])}
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {key === "weekStart"
                            ? new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
                                new Date(2024, 0, Number(option) === 1 ? 1 : 7),
                              )
                            : t(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
            <section className="surface">
              <h2 className="text-lg font-semibold">{t("modules")}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {navigation
                  .filter((item) =>
                    [
                      "inbox",
                      "calendar",
                      "projects",
                      "tasks",
                      "habits",
                      "finance",
                      "health",
                      "ai",
                      "workspace",
                    ].includes(item.key),
                  )
                  .map((item) => (
                    <label key={item.key} className="flex items-center gap-3 rounded-xl border p-3">
                      <input
                        className="size-5 accent-violet-600"
                        type="checkbox"
                        checked={!values.hiddenModules.includes(item.key as Preferences["hiddenModules"][number])}
                        onChange={(event) =>
                          change(
                            "hiddenModules",
                            event.target.checked
                              ? values.hiddenModules.filter((key) => key !== item.key)
                              : [...values.hiddenModules, item.key],
                          )
                        }
                      />
                      {t(item.key === "workspace" ? "integrations" : item.key)}
                    </label>
                  ))}
              </div>
            </section>
            <section className="surface">
              <h2 className="text-lg font-semibold">{t("permissions")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("permissionHelp")}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(aiPermissionsSchema.shape).map((key) => (
                  <label key={key} className="flex items-center gap-3 rounded-xl border p-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-violet-600"
                      checked={permissionValues[key] ?? false}
                      onChange={(event) => setPermissionValues({ ...permissionValues, [key]: event.target.checked })}
                    />
                    {t(key === "drive" ? "driveLinks" : key)}
                  </label>
                ))}
              </div>
            </section>
            <section className="surface">
              <h2 className="text-lg font-semibold">{t("notificationDefaults")}</h2>
              <label htmlFor="offsets" className="mt-4 block text-sm">
                {t("offsetMinutes")}
              </label>
              <input
                id="offsets"
                className="control mt-2"
                value={offsetText}
                aria-invalid={!!errors.notificationOffsets}
                onChange={(event) => setOffsetText(event.target.value)}
              />
            </section>
            <Button type="submit" className="min-h-11" disabled={pending}>
              {t(pending ? "loading" : "save")}
            </Button>
          </form>
        )
      )}
      {!onboarding && (
        <>
          <Sessions />
          <Privacy />
        </>
      )}
    </div>
  );
}
function Sessions() {
  const { t } = useLocale();
  const sessions = useApi<Row[]>("/sessions");
  async function revoke(id?: string) {
    try {
      await api(id ? `/sessions/${id}` : "/sessions/revoke-others", { method: id ? "DELETE" : "POST" });
      await sessions.reload();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  return (
    <section className="surface space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("sessions")}</h2>
        <Button variant="outline" onClick={() => void revoke()}>
          {t("revokeOthers")}
        </Button>
      </div>
      {sessions.error ? (
        <ErrorState error={sessions.error} retry={() => void sessions.reload()} />
      ) : (
        sessions.data?.map((session) => (
          <div key={session.id} className="flex items-center justify-between gap-4 border-t pt-4">
            <div className="min-w-0">
              <p className="truncate text-sm">{String(session.userAgent ?? "LifeSync")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {session.current ? t("current") : new Date(String(session.updatedAt)).toLocaleString()} · {t("expires")}
                : {new Date(String(session.expiresAt)).toLocaleString()}
              </p>
            </div>
            {!session.current && (
              <Button variant="outline" onClick={() => void revoke(session.id)}>
                {t("revoke")}
              </Button>
            )}
          </div>
        ))
      )}
    </section>
  );
}
function Privacy() {
  const { t } = useLocale();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.confirmation !== "DELETE" || pending) return;
    setPending(true);
    try {
      await api("/account", { method: "DELETE", body: JSON.stringify(values) });
      sessionStorage.clear();
      if ("caches" in window)
        await Promise.all(
          (await caches.keys()).filter((key) => key.startsWith("lifesync-private")).map((key) => caches.delete(key)),
        );
      location.assign("/");
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="surface space-y-4">
      <h2 className="text-lg font-semibold">{t("privacy")}</h2>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <a href="/api/v1/export" download>
            {t("export")}
          </a>
        </Button>
        <Button variant="destructive" onClick={() => setConfirm(!confirm)}>
          {t("deleteAccount")}
        </Button>
      </div>
      {confirm && (
        <form onSubmit={remove} className="space-y-4 rounded-xl border border-destructive/30 p-4">
          <p className="text-sm">{t("deleteAccountHelp")}</p>
          <input
            className="control"
            name="confirmation"
            aria-label={t("confirm")}
            required
            pattern="DELETE"
            placeholder="DELETE"
          />
          <input
            className="control"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-label={t("password")}
            placeholder={t("password")}
          />
          <Button variant="destructive" disabled={pending}>
            {t("deleteAccount")}
          </Button>
        </form>
      )}
    </section>
  );
}
