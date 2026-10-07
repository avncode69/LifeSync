"use client";

import type { ResourceName } from "@lifesync/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";

import { api, errorKey, label, type Row, useApi } from "@/lib/api";
import { registerPushSubscription } from "@/lib/push";
import { localDate } from "@/lib/time";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel, ResourceTabs } from "./resource";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";
import { usePublicConfig } from "./turnstile";

export function Notifications() {
  const { t } = useLocale();
  const data = useApi<Row[]>("/notifications?limit=100");
  const config = usePublicConfig();
  const { user } = useAccount();
  const [pending, setPending] = useState(false);
  async function read(id?: string, unread = false) {
    setPending(true);
    try {
      const rows = id ? data.data?.filter((row) => row.id === id) : [];
      if (!id) await api("/notifications/read-all", { method: "POST", body: "{}" });
      await Promise.all(
        (rows ?? []).map((row) =>
          api(`/notifications/${row.id}`, {
            method: "PATCH",
            body: JSON.stringify({ readAt: unread ? null : new Date().toISOString() }),
          }),
        ),
      );
      await data.reload();
      window.dispatchEvent(new Event("lifesync:notifications"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  async function push() {
    setPending(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !config?.vapidPublicKey)
        throw new Error("UNAVAILABLE");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(t("pushDenied"));
        return;
      }
      const worker = await navigator.serviceWorker.ready;
      const encoded = config.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      await registerPushSubscription(
        worker.pushManager,
        { userVisibleOnly: true, applicationServerKey: bytes },
        (subscription) => {
          const value = subscription.toJSON();
          return api("/push/subscriptions", {
            method: "POST",
            body: JSON.stringify({
              endpoint: value.endpoint,
              p256dh: value.keys?.p256dh,
              auth: value.keys?.auth,
              deviceName: navigator.userAgent,
            }),
          });
        },
      );
      if (user) localStorage.setItem("lifesync.push-user", user.id);
      await api("/preferences", { method: "PATCH", body: JSON.stringify({ webPushEnabled: true }) });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-heading">{t("notifications")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => void read()}>
            {t("markAll")}
          </Button>
          {config?.vapidPublicKey && (
            <Button disabled={pending} onClick={() => void push()}>
              {t("push")}
            </Button>
          )}
        </div>
      </div>
      {data.loading ? (
        <Loading />
      ) : data.error ? (
        <ErrorState error={data.error} retry={() => void data.reload()} />
      ) : !data.data?.length ? (
        <Empty />
      ) : (
        <div className="space-y-3">
          {data.data.map((row) => (
            <article
              key={row.id}
              className={`surface flex flex-wrap items-start justify-between gap-3 ${!row.readAt ? "border-primary/30" : ""}`}
            >
              <div>
                <h2 className="font-semibold">{label(row)}</h2>
                {row.body ? <p className="mt-2 text-sm text-muted-foreground">{String(row.body)}</p> : null}
                <p className="mt-3 text-xs text-muted-foreground">{new Date(String(row.createdAt)).toLocaleString()}</p>
                {notificationUrl(row) && (
                  <a href={notificationUrl(row)} className="mt-2 inline-flex text-sm text-primary">
                    {t("show")} →
                  </a>
                )}
              </div>
              <Button variant="outline" disabled={pending} onClick={() => void read(row.id, !!row.readAt)}>
                {t(row.readAt ? "markUnread" : "markRead")}
              </Button>
            </article>
          ))}
        </div>
      )}
      <ResourcePanel resource="reminderRules" title="reminders" />
    </div>
  );
}

export function Trash() {
  const { t } = useLocale();
  const trash = useApi<{ resource: ResourceName; path: string; data: Row[] }[]>("/trash");
  const [pending, setPending] = useState<string>();
  async function action(path: string, id: string, restore: boolean) {
    if (!restore && !window.confirm(t("confirmDelete"))) return;
    setPending(id);
    try {
      await api(restore ? `${path}/${id}/restore` : `/trash/${path}/${id}`, { method: restore ? "POST" : "DELETE" });
      await trash.reload();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(undefined);
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="page-heading">{t("trash")}</h1>
      {trash.loading ? (
        <Loading />
      ) : trash.error ? (
        <ErrorState error={trash.error} retry={() => void trash.reload()} />
      ) : trash.data?.some((group) => group.data.length) ? (
        trash.data
          .filter((group) => group.data.length)
          .map((group) => (
            <section key={group.resource} className="surface space-y-4">
              <h2 className="text-lg font-semibold">{t(group.resource)}</h2>
              {group.data.map((row) => (
                <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <span>{label(row)}</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={pending === row.id}
                      onClick={() => void action(group.path, row.id, true)}
                    >
                      {t("restore")}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={pending === row.id}
                      onClick={() => void action(group.resource, row.id, false)}
                    >
                      {t("permanent")}
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          ))
      ) : (
        <Empty />
      )}
    </div>
  );
}

export function Admin() {
  const { t } = useLocale();
  const users = useApi<Row[]>("/admin/users");
  const metrics = useApi<Record<string, unknown>>("/admin/metrics");
  const flags = useApi<Row[]>("/admin/flags");
  const audit = useApi<Row[]>("/admin/audit");
  const jobs = useApi<Row[]>("/admin/jobs");
  const [pending, setPending] = useState(false);
  const [flagError, setFlagError] = useState("");
  async function createFlag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const valid = z
      .object({ key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), description: z.string().trim().min(1).max(500) })
      .safeParse(values);
    if (!valid.success) {
      setFlagError(t("invalid"));
      return;
    }
    setFlagError("");
    await patch(`/flags/${valid.data.key}`, { enabled: values.enabled === "on", description: valid.data.description });
  }

  async function patch(path: string, body: unknown) {
    if (pending) return;
    setPending(true);
    try {
      await api(`/admin${path}`, { method: "PATCH", body: JSON.stringify(body) });
      await users.reload();
      await flags.reload();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-7">
      <h1 className="page-heading">{t("admin")}</h1>
      {users.loading ? (
        <Loading />
      ) : users.error ? (
        <ErrorState error={users.error} retry={() => void users.reload()} />
      ) : (
        <>
          {!!metrics.error && <ErrorState error={metrics.error} retry={() => void metrics.reload()} />}
          <section className="grid gap-4 sm:grid-cols-3">
            {Object.entries(metrics.data ?? {})
              .filter(([, value]) => typeof value !== "object")
              .map(([key, value]) => (
                <article key={key} className="surface">
                  <p className="text-xs text-muted-foreground">{t(key)}</p>
                  <p className="mt-4 text-3xl font-semibold">{String(value)}</p>
                </article>
              ))}
          </section>
          <section className="surface space-y-4">
            <h2 className="text-xl font-semibold">{t("users")}</h2>
            {users.data?.map((user) => (
              <article key={user.id} className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
                <div>
                  <p className="font-medium">{String(user.name)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(user.email)} · {String(user.plan)} · {new Date(String(user.createdAt)).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void patch(`/users/${user.id}`, { plan: user.plan === "PRO" ? "FREE" : "PRO" })}
                  >
                    {t(user.plan === "PRO" ? "revokePro" : "grantPro")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void patch(`/users/${user.id}`, { disabled: !user.disabled })}
                  >
                    {t(user.disabled ? "enableAccount" : "disableAccount")}
                  </Button>
                </div>
              </article>
            ))}
          </section>
          <section className="surface space-y-4">
            <h2 className="text-xl font-semibold">{t("flags")}</h2>
            {flags.loading ? (
              <Loading />
            ) : flags.error ? (
              <ErrorState error={flags.error} retry={() => void flags.reload()} />
            ) : null}
            <form onSubmit={createFlag} className="grid gap-3 sm:grid-cols-2" noValidate>
              <div>
                <label htmlFor="flag-key" className="text-sm">
                  {t("flagKey")}
                </label>
                <input id="flag-key" name="key" className="control mt-2" required maxLength={64} />
              </div>
              <div>
                <label htmlFor="flag-description" className="text-sm">
                  {t("description")}
                </label>
                <input id="flag-description" name="description" className="control mt-2" required maxLength={500} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input name="enabled" type="checkbox" />
                {t("enabled")}
              </label>
              <Button type="submit" disabled={pending}>
                {t(pending ? "loading" : "create")}
              </Button>
              {flagError && (
                <p role="alert" className="text-sm text-destructive">
                  {flagError}
                </p>
              )}
            </form>
            {flags.data?.map((flag) => (
              <label key={String(flag.key)} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!flag.enabled}
                  disabled={pending}
                  onChange={(event) => void patch(`/flags/${String(flag.key)}`, { enabled: event.target.checked })}
                />
                {String(flag.key)}
              </label>
            ))}
          </section>
          <section className="surface space-y-3">
            <h2 className="text-xl font-semibold">{t("jobs")}</h2>
            {jobs.loading ? (
              <Loading />
            ) : jobs.error ? (
              <ErrorState error={jobs.error} retry={() => void jobs.reload()} />
            ) : jobs.data?.length ? (
              jobs.data.map((job) => (
                <article key={job.id} className="flex flex-wrap justify-between gap-3 border-t pt-3 text-sm">
                  <span>{t(String(job.type))}</span>
                  <span>
                    {t(String(job.status))} · {t("attempts")}: {String(job.attempts)}
                  </span>
                  <span className="text-xs text-muted-foreground">{String(job.errorCode ?? "")}</span>
                </article>
              ))
            ) : (
              <Empty />
            )}
          </section>
          <section className="surface space-y-3">
            <h2 className="text-xl font-semibold">{t("audit")}</h2>
            {audit.loading ? (
              <Loading />
            ) : audit.error ? (
              <ErrorState error={audit.error} retry={() => void audit.reload()} />
            ) : null}
            {audit.data?.map((entry) => (
              <div key={entry.id} className="flex flex-wrap justify-between gap-3 border-t pt-3 text-xs">
                <span>{String(entry.action)}</span>
                <time>{new Date(String(entry.createdAt)).toLocaleString()}</time>
                <span className="text-muted-foreground">{String(entry.requestId ?? "")}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export function Inbox() {
  const { t } = useLocale();
  return (
    <div className="space-y-6">
      <h1 className="page-heading">{t("inbox")}</h1>
      <ResourceTabs
        tabs={[
          {
            resource: "inboxItems",
            label: "items",
            renderExtra: (row, refresh) => <ConvertInbox row={row} refresh={refresh} />,
          },
          { resource: "inboxBoxes", label: "boxes" },
          { resource: "reminderRules", label: "reminders" },
          { resource: "driveLinks", label: "driveLinks" },
        ]}
      />
    </div>
  );
}

function ConvertInbox({ row, refresh }: { row: Row; refresh: () => void }) {
  const { t } = useLocale();
  const { preferences } = useAccount();
  const [target, setTarget] = useState<ResourceName>("tasks");
  const [open, setOpen] = useState(false);
  const initial: Record<string, unknown> =
    target === "projects"
      ? { name: row.title, description: row.content }
      : target === "habits"
        ? { name: row.title, startDate: localDate(preferences?.timezone ?? "Europe/Kyiv") }
        : target === "financeTransactions"
          ? {
              note: [row.title, row.content].filter(Boolean).join("\n"),
              transactionDate: localDate(preferences?.timezone ?? "Europe/Kyiv"),
              type: "expense",
            }
          : { title: row.title, description: row.content };
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-muted-foreground">{t("conversionHistory")}</p>
      {row.convertedId ? (
        <p className="text-sm text-primary">
          {t("converted")} · {t(String(row.convertedType))}
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            className="control"
            aria-label={t("target")}
            value={target}
            onChange={(event) => setTarget(event.target.value as ResourceName)}
          >
            {["tasks", "projects", "calendarEvents", "habits", "financeTransactions"].map((resource) => (
              <option key={resource} value={resource}>
                {t(resource)}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setOpen(true)}>
            {t("convert")}
          </Button>
        </div>
      )}
      {open && (
        <ResourceEditor
          resource={target}
          initial={initial}
          onClose={() => setOpen(false)}
          onSaved={refresh}
          saveOverride={(input) =>
            api(`/inbox/items/${row.id}/convert`, {
              method: "POST",
              body: JSON.stringify({ resource: target, input }),
              headers: { "Idempotency-Key": crypto.randomUUID() },
            })
          }
        />
      )}
    </div>
  );
}

function notificationUrl(row: Row): string | undefined {
  const routes: Record<string, [string, string]> = {
    task: ["tasks", "tasks"],
    tasks: ["tasks", "tasks"],
    event: ["calendar", "calendarEvents"],
    calendarEvents: ["calendar", "calendarEvents"],
    habit: ["habits", "habits"],
    habits: ["habits", "habits"],
    transaction: ["finance", "financeTransactions"],
    financeTransactions: ["finance", "financeTransactions"],
    project: ["projects", "projects"],
    projects: ["projects", "projects"],
    inboxItem: ["inbox", "inboxItems"],
    inboxItems: ["inbox", "inboxItems"],
  };
  const target = routes[String(row.targetType)];
  return target && typeof row.targetId === "string"
    ? `/${target[0]}?resource=${target[1]}&item=${encodeURIComponent(row.targetId)}`
    : undefined;
}
