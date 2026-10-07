"use client";
import { Check, Circle, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { displayInstant } from "@/lib/time";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";

const statuses = ["inbox", "todo", "in_progress", "done", "cancelled"];
export function Tasks() {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const tasks = useApi<Row[]>("/tasks?limit=100");
  const projects = useApi<Row[]>("/projects?limit=100");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [project, setProject] = useState("");
  const [sort, setSort] = useState("priority");
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Row | "new">();
  const [details, setDetails] = useState<Row>();
  useEffect(() => {
    if (!tasks.data) return;
    const user = sessionStorage.getItem("lifesync.active-user");
    if (user)
      sessionStorage.setItem(
        `lifesync.recent.tasks.${user}`,
        JSON.stringify(
          tasks.data.slice(0, 20).map(({ id, title, status, dueDate }) => ({ id, title, status, dueDate })),
        ),
      );
  }, [tasks.data]);
  useEffect(() => {
    const target = new URLSearchParams(location.search).get("item");
    if (!target) return;
    let active = true;
    void api<Row>(`/tasks/${encodeURIComponent(target)}`)
      .then((row) => {
        if (active) setDetails(row);
      })
      .catch((reason) => {
        if (active) toast.error(t(errorKey(reason)));
      });
    return () => {
      active = false;
    };
  }, [t]);
  async function update(row: Row, patch: Record<string, unknown>) {
    try {
      await api(`/tasks/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await tasks.reload();
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  async function remove(row: Row) {
    try {
      await api(`/tasks/${row.id}`, { method: "DELETE" });
      await tasks.reload();
      toast.success(t("removed"), {
        action: {
          label: t("undo"),
          onClick: () => {
            void api(`/tasks/${row.id}/restore`, { method: "POST" })
              .then(tasks.reload)
              .catch((error) => toast.error(t(errorKey(error))));
          },
        },
      });
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  const priorities: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };
  const rows = (tasks.data ?? [])
    .filter(
      (row) =>
        (!query || String(row.title).toLowerCase().includes(query.toLowerCase())) &&
        (!filter || row.status === filter) &&
        (!project || row.projectId === project),
    )
    .sort((a, b) =>
      sort === "priority"
        ? (priorities[String(b.priority)] ?? 0) - (priorities[String(a.priority)] ?? 0)
        : String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")),
    );
  async function bulkComplete() {
    try {
      await Promise.all(
        selected.map((id) => api(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) })),
      );
      setSelected([]);
      await tasks.reload();
    } catch (error) {
      toast.error(t(errorKey(error)));
      await tasks.reload();
    }
  }
  const taskCard = (row: Row) => (
    <article
      key={row.id}
      className="surface p-4"
      draggable={view === "kanban"}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/lifesync-task", row.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start gap-3">
        {view === "list" && (
          <input
            type="checkbox"
            className="mt-1 size-4 accent-violet-600"
            aria-label={`${t("selected")} ${String(row.title)}`}
            checked={selected.includes(row.id)}
            onChange={(event) =>
              setSelected(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))
            }
          />
        )}
        <button
          type="button"
          className="mt-.5 text-primary"
          aria-label={`${t("complete")} ${String(row.title)}`}
          onClick={() => void update(row, { status: row.status === "done" ? "todo" : "done" })}
        >
          {row.status === "done" ? <Check className="size-5" /> : <Circle className="size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDetails(row)}
            className={`break-words text-left font-semibold ${row.status === "done" ? "text-muted-foreground line-through" : ""}`}
          >
            {String(row.title)}
          </button>
          {row.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{String(row.description)}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span
              className={row.priority === "urgent" ? "text-destructive" : row.priority === "high" ? "text-primary" : ""}
            >
              {t(String(row.priority))}
            </span>
            {row.dueAt || row.dueDate ? (
              <time>
                {String(
                  row.dueDate ??
                    displayInstant(
                      String(row.dueAt),
                      locale,
                      preferences?.timezone ?? "Europe/Kyiv",
                      preferences?.timeFormat,
                    ),
                )}
              </time>
            ) : null}
            {row.recurrenceRule ? <span>↻ {t("recurring")}</span> : null}
            {row.projectId ? (
              <span>{String(projects.data?.find((item) => item.id === row.projectId)?.name ?? "")}</span>
            ) : null}
          </div>
        </div>
        <Button
          variant="ghost"
          aria-label={t("edit")}
          size="icon"
          className="min-h-10 min-w-10"
          onClick={() => setEditor(row)}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <select
          className="control w-auto min-h-9 py-1 text-xs"
          aria-label={t("status")}
          value={String(row.status)}
          onChange={(event) => void update(row, { status: event.target.value })}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(status)}
            </option>
          ))}
        </select>
        <Button size="icon" variant="ghost" aria-label={t("delete")} onClick={() => void remove(row)}>
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </article>
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-heading">{t("tasks")}</h1>
          <p className="mt-2 text-muted-foreground">{t("focus")}</p>
        </div>
        <Button disabled={tasks.loading} className="min-h-11 gap-2" onClick={() => setEditor("new")}>
          <Plus />
          {t("create")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-muted p-1">
          {["list", "kanban"].map((value) => (
            <Button key={value} variant={view === value ? "default" : "ghost"} onClick={() => setView(value)}>
              {t(value)}
            </Button>
          ))}
        </div>
        <input
          className="control w-full sm:w-56"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="control w-auto"
          aria-label={t("filter")}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="">{t("status")}</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {t(status)}
            </option>
          ))}
        </select>
        <select
          className="control w-auto"
          aria-label={t("projects")}
          value={project}
          onChange={(event) => setProject(event.target.value)}
        >
          <option value="">{t("projects")}</option>
          {projects.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {String(item.name)}
            </option>
          ))}
        </select>
        <select
          className="control w-auto"
          aria-label={t("sort")}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          {["priority", "title", "dueAt"].map((key) => (
            <option key={key} value={key}>
              {t(key)}
            </option>
          ))}
        </select>
      </div>
      {selected.length > 0 && (
        <div className="flex items-center gap-4 rounded-xl bg-primary/10 p-3">
          <span className="text-sm">
            {selected.length} {t("selected")}
          </span>
          <Button onClick={() => void bulkComplete()}>{t("bulkComplete")}</Button>
        </div>
      )}
      {tasks.loading ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={() => void tasks.reload()} />
      ) : view === "list" ? (
        rows.length ? (
          <div className="grid gap-3">{rows.map(taskCard)}</div>
        ) : (
          <Empty />
        )
      ) : (
        <div className="grid gap-4 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
          {statuses.map((status) => (
            <section
              key={status}
              aria-label={t(status)}
              className="min-w-52 rounded-2xl bg-muted/50 p-3"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("text/lifesync-task")) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const row = tasks.data?.find((item) => item.id === event.dataTransfer.getData("text/lifesync-task"));
                if (row) void update(row, { status });
              }}
            >
              <h2 className="mb-4 flex items-center justify-between px-1 text-sm font-semibold">
                {t(status)}
                <span className="text-muted-foreground">{rows.filter((row) => row.status === status).length}</span>
              </h2>
              <div className="space-y-3">{rows.filter((row) => row.status === status).map(taskCard)}</div>
            </section>
          ))}
        </div>
      )}
      {editor && (
        <ResourceEditor
          resource="tasks"
          row={editor === "new" ? undefined : editor}
          onClose={() => setEditor(undefined)}
          onSaved={() => void tasks.reload()}
        />
      )}
      {details && <TaskDetails row={details} onClose={() => setDetails(undefined)} />}
    </div>
  );
}
function TaskDetails({ row, onClose }: { row: Row; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <div className="space-y-6 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-semibold">{String(row.title)}</h2>
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
      <ResourcePanel resource="tasks" title="tasks" initial={{ parentTaskId: row.id }} />
      <ResourcePanel resource="taskChecklistItems" title="checklist" initial={{ taskId: row.id }} />
      <ResourcePanel resource="taskTags" title="tags" initial={{ taskId: row.id }} />
      <ResourcePanel resource="reminderRules" title="reminders" initial={{ taskId: row.id }} />
      <ResourcePanel resource="driveLinks" initial={{ taskId: row.id }} />
    </div>
  );
}
