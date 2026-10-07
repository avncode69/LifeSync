"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { DrivePicker } from "./drive-picker";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { ErrorState, Loading } from "./states";
export function Integrations() {
  const { t } = useLocale();
  const connection = useApi<Row>("/integrations/google");
  const connected = !!connection.data?.email;
  const calendars = useApi<Row[]>(connected ? "/integrations/google/calendars" : null);
  const conflicts = useApi<Row[]>(connected ? "/integrations/google/conflicts" : null);
  const [calendar, setCalendar] = useState(true);
  const [drive, setDrive] = useState(false);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState("");
  const [metadata, setMetadata] = useState<Record<string, unknown>>();
  async function action(path: string, body?: unknown, method = "POST") {
    setPending(true);
    try {
      const result = await api<{ url?: string }>(`/integrations/google${path}`, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (result?.url) location.assign(result.url);
      else {
        await connection.reload();
        void calendars.reload();
        void conflicts.reload();
        toast.success(t("saved"));
      }
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  async function selectFile(fileId: string) {
    const row = await api<{ id: string; name: string; mimeType: string; webViewLink: string; modifiedTime?: string }>(
      `/integrations/google/drive/metadata?file=${encodeURIComponent(fileId)}`,
    );
    setMetadata({
      googleFileId: row.id,
      name: row.name,
      mimeType: row.mimeType,
      webViewUrl: row.webViewLink,
      modifiedAt: row.modifiedTime,
    });
  }
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!file.trim() || pending) return;
    setPending(true);
    try {
      await selectFile(file);
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-7">
      <h1 className="page-heading">{t("integrations")}</h1>
      <p className="max-w-3xl text-muted-foreground">{t("integrationHelp")}</p>
      {connection.loading ? (
        <Loading />
      ) : connection.error ? (
        <ErrorState error={connection.error} retry={() => void connection.reload()} />
      ) : (
        <section className="surface space-y-5">
          <div>
            <div className="flex items-center gap-3">
              {typeof connection.data?.avatarUrl === "string" && (
                <img src={connection.data.avatarUrl} alt="" width={40} height={40} className="rounded-full" />
              )}
              <h2 className="text-xl font-semibold">
                {connected ? String(connection.data?.email) : t("disconnected")}
              </h2>
            </div>
            {connected && (
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span>
                  {t("calendarAccess")}: {t(connection.data?.calendarEnabled ? "connected" : "disconnected")}
                </span>
                <span>
                  {t("driveAccess")}: {t(connection.data?.driveEnabled ? "connected" : "disconnected")}
                </span>
              </div>
            )}
            {connection.data?.lastSyncedAt ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("lastSync")}: {new Date(String(connection.data.lastSyncedAt)).toLocaleString()}
              </p>
            ) : null}
            {connection.data?.errorCode ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {t("error")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={calendar} onChange={(event) => setCalendar(event.target.checked)} />
              {t("calendarAccess")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={drive} onChange={(event) => setDrive(event.target.checked)} />
              {t("driveAccess")}
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={pending || (!calendar && !drive)}
              className="min-h-11"
              onClick={() => void action("/connect", { calendar, drive })}
            >
              {t("connect")}
            </Button>
            {connected && (
              <>
                <Button
                  disabled={pending}
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void action("/sync", {})}
                >
                  {t("sync")}
                </Button>
                <Button
                  disabled={pending}
                  variant="destructive"
                  className="min-h-11"
                  onClick={() => void action("", undefined, "DELETE")}
                >
                  {t("disconnect")}
                </Button>
              </>
            )}
          </div>
        </section>
      )}
      {connected && (
        <>
          <section className="surface space-y-4">
            <h2 className="text-xl font-semibold">{t("calendar")}</h2>
            {calendars.error ? (
              <ErrorState error={calendars.error} retry={() => void calendars.reload()} />
            ) : (
              calendars.data?.map((row) => (
                <label key={row.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <input
                    type="checkbox"
                    checked={!!row.selected}
                    onChange={(event) =>
                      void action(`/calendars/${row.id}`, { selected: event.target.checked }, "PATCH")
                    }
                  />
                  <span>{String(row.name)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{String(row.timezone)}</span>
                </label>
              ))
            )}
          </section>
          {!!conflicts.data?.length && (
            <section className="surface space-y-4">
              <h2 className="text-xl font-semibold">{t("syncConflict")}</h2>
              {conflicts.data.map((row) => (
                <article key={row.id} className="flex flex-wrap items-center gap-3 border-t pt-3">
                  <span className="text-sm">{String(row.eventId)}</span>
                  <Button
                    variant="outline"
                    onClick={() => void action(`/conflicts/${row.id}/resolve`, { choice: "local" })}
                  >
                    {t("keepLocal")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void action(`/conflicts/${row.id}/resolve`, { choice: "google" })}
                  >
                    {t("keepGoogle")}
                  </Button>
                </article>
              ))}
            </section>
          )}
          <form onSubmit={lookup} className="surface space-y-4">
            <h2 className="text-xl font-semibold">{t("driveLinks")}</h2>
            {connection.data?.driveEnabled ? (
              <DrivePicker onSelected={selectFile} email={String(connection.data?.email ?? "")} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("driveAccessHelp")}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("driveGrantedHelp")}</p>
            <label className="block text-sm" htmlFor="google-file">
              {t("webViewUrl")}
            </label>
            <input
              id="google-file"
              className="control"
              required
              value={file}
              onChange={(event) => setFile(event.target.value)}
              maxLength={2000}
            />
            <Button disabled={pending || !connection.data?.driveEnabled}>{t("preview")}</Button>
          </form>
        </>
      )}
      <ResourcePanel resource="driveLinks" />
      {metadata && (
        <ResourceEditor
          resource="driveLinks"
          initial={metadata}
          onClose={() => setMetadata(undefined)}
          onSaved={() => {
            setFile("");
            location.reload();
          }}
        />
      )}
    </div>
  );
}
