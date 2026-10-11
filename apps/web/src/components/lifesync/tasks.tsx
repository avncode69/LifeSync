"use client";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  CircleDashed,
  CircleDot,
  CircleX,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, errorKey, type Row, useApi } from "@/lib/api";
import { filterTasks, paginateTasks } from "@/lib/task-table";
import { LifeSelect } from "./controls";
import { useLocale } from "./providers";
import { ResourceEditor, ResourcePanel } from "./resource";
import { Empty, ErrorState, Loading } from "./states";

const statuses = ["inbox", "todo", "in_progress", "done", "cancelled"];
const priorities = ["urgent", "high", "medium", "low", "none"];
const statusColors: Record<string, string> = {
  inbox: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  todo: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  in_progress: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
const statusIcons = { inbox: CircleDashed, todo: Circle, in_progress: CircleDot, done: Check, cancelled: CircleX };

export function Tasks() {
  const { t } = useLocale();
  const tasks = useApi<Row[]>("/tasks?limit=100");
  const [view, setView] = useState("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("priority");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [editor, setEditor] = useState<Row | "new">();
  const [details, setDetails] = useState<Row>();
  const [pending, setPending] = useState(false);
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
    if (pending) return;
    setPending(true);
    try {
      await api(`/tasks/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await tasks.reload();
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  async function remove(row: Row) {
    if (pending) return;
    setPending(true);
    try {
      await api(`/tasks/${row.id}`, { method: "DELETE" });
      setSelected((ids) => ids.filter((id) => id !== row.id));
      if (details?.id === row.id) setDetails(undefined);
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
    } finally {
      setPending(false);
    }
  }
  const rows = filterTasks(tasks.data ?? [], query, status, priority, sort);
  const pagination = paginateTasks(rows, page, pageSize);
  const selectedRows = rows.filter((row) => selected.includes(row.id));
  const allPageSelected = pagination.rows.length > 0 && pagination.rows.every((row) => selected.includes(row.id));
  async function bulkComplete() {
    if (pending) return;
    setPending(true);
    try {
      const results = await Promise.allSettled(
        selectedRows.map((row) =>
          api(`/tasks/${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) }),
        ),
      );
      setSelected([]);
      await tasks.reload();
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") toast.error(t(errorKey(failed.reason)));
    } catch (error) {
      toast.error(t(errorKey(error)));
      await tasks.reload();
    } finally {
      setPending(false);
    }
  }
  const statusBadge = (row: Row) => {
    const value = String(row.status ?? "inbox");
    const Icon = statusIcons[value as keyof typeof statusIcons] ?? Circle;
    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${statusColors[value] ?? "border-border bg-muted text-muted-foreground"}`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {t(value)}
      </span>
    );
  };
  const priorityLabel = (row: Row) => {
    const value = String(row.priority ?? "none");
    const Icon = value === "low" ? ArrowDown : value === "high" || value === "urgent" ? ArrowUp : ArrowRight;
    return (
      <span
        className={`inline-flex items-center gap-2 whitespace-nowrap text-xs ${value === "urgent" ? "text-destructive" : "text-muted-foreground"}`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {t(value)}
      </span>
    );
  };
  const actions = (row: Row) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`${t("taskActions")}: ${String(row.title)}`}
          disabled={pending}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => setDetails(row)}>
          <Eye />
          {t("details")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setEditor(row)}>
          <Pencil />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void update(row, { status: row.status === "done" ? "todo" : "done" })}>
          <Check />
          {t(row.status === "done" ? "reopen" : "complete")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("status")}</DropdownMenuLabel>
        {statuses.map((value) => (
          <DropdownMenuItem key={value} onSelect={() => void update(row, { status: value })}>
            <span className="size-4">{row.status === value && <Check className="size-4" />}</span>
            {t(value)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void remove(row)}>
          <Trash2 />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const taskCard = (row: Row) => (
    <article
      key={row.id}
      className="rounded-lg border bg-card p-3"
      draggable={!pending}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/lifesync-task", row.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setDetails(row)}
          className="min-w-0 break-words text-left text-sm font-medium hover:underline"
        >
          {String(row.title)}
        </button>
        {actions(row)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {priorityLabel(row)}
        {statusBadge(row)}
      </div>
    </article>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-heading">{t("tasks")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("focus")}</p>
        </div>
        <Button disabled={tasks.loading} className="h-9 gap-2" onClick={() => setEditor("new")}>
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("filterTasks")}
            placeholder={t("filterTasks")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <LifeSelect
          className="h-9 w-auto min-w-32 rounded-md border bg-background px-3 text-sm"
          aria-label={t("status")}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </LifeSelect>
        <LifeSelect
          className="h-9 w-auto min-w-32 rounded-md border bg-background px-3 text-sm"
          aria-label={t("priority")}
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("allPriorities")}</option>
          {priorities.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </LifeSelect>
        <div className="sm:ml-auto">
          <LifeSelect
            className="h-9 w-auto rounded-md border bg-background px-3 text-sm"
            aria-label={t("view")}
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="list">
              {t("view")}: {t("list")}
            </option>
            <option value="kanban">
              {t("view")}: {t("kanban")}
            </option>
          </LifeSelect>
        </div>
      </div>
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs">
          <span>
            {selectedRows.length} {t("selected")}
          </span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void bulkComplete()}>
            {t("bulkComplete")}
          </Button>
        </div>
      )}
      {tasks.loading ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={() => void tasks.reload()} />
      ) : view === "list" ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead className="border-b bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded accent-primary"
                      aria-label={t("selectPage")}
                      checked={allPageSelected}
                      disabled={!pagination.rows.length}
                      ref={(element) => {
                        if (element)
                          element.indeterminate =
                            !allPageSelected && pagination.rows.some((row) => selected.includes(row.id));
                      }}
                      onChange={(event) => {
                        const ids = pagination.rows.map((row) => row.id);
                        setSelected((current) =>
                          event.target.checked
                            ? [...new Set([...current, ...ids])]
                            : current.filter((id) => !ids.includes(id)),
                        );
                      }}
                    />
                  </th>
                  <th className="w-32 px-3 py-3 font-medium">{t("taskId")}</th>
                  {["title", "status", "priority"].map((key) => (
                    <th
                      key={key}
                      className={`${key === "title" ? "" : key === "status" ? "w-40" : "w-32"} px-3 py-3 font-medium`}
                      aria-sort={sort === key ? (key === "priority" ? "descending" : "ascending") : "none"}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:text-foreground"
                        onClick={() => setSort(key)}
                      >
                        {t(key)}
                        <ArrowDown className="size-3" />
                      </button>
                    </th>
                  ))}
                  <th className="w-14 px-3 py-3">
                    <span className="sr-only">{t("taskActions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pagination.rows.map((row) => (
                  <tr key={row.id} className={selected.includes(row.id) ? "bg-muted/40" : "hover:bg-muted/20"}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded accent-primary"
                        aria-label={`${t("selected")}: ${String(row.title)}`}
                        checked={selected.includes(row.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked ? [...new Set([...ids, row.id])] : ids.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground" title={row.id}>
                      {row.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setDetails(row)}
                        className={`block max-w-xl truncate text-left font-medium hover:underline ${row.status === "done" ? "text-muted-foreground" : ""}`}
                        title={String(row.title)}
                      >
                        {String(row.title)}
                      </button>
                    </td>
                    <td className="px-3 py-3">{statusBadge(row)}</td>
                    <td className="px-3 py-3">{priorityLabel(row)}</td>
                    <td className="px-3 py-2">{actions(row)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <Empty />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-3 text-xs text-muted-foreground">
            <span>
              {selectedRows.length} {t("of")} {rows.length} {t("selected")}
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span>{t("rowsPerPage")}</span>
                <LifeSelect
                  className="h-8 w-16 rounded-md border bg-background px-2 text-xs"
                  aria-label={t("rowsPerPage")}
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 20, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </LifeSelect>
              </div>
              <span aria-live="polite">
                {t("page")} {pagination.page} {t("of")} {pagination.pageCount}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={pagination.page === 1}
                  aria-label={t("firstPage")}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={pagination.page === 1}
                  aria-label={t("previousPage")}
                  onClick={() => setPage(pagination.page - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={pagination.page === pagination.pageCount}
                  aria-label={t("nextPage")}
                  onClick={() => setPage(pagination.page + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  disabled={pagination.page === pagination.pageCount}
                  aria-label={t("lastPage")}
                  onClick={() => setPage(pagination.pageCount)}
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 overflow-x-auto md:grid-cols-3 xl:grid-cols-5">
          {statuses.map((value) => (
            <section
              key={value}
              aria-label={t(value)}
              className="min-w-48 rounded-lg border bg-muted/20 p-3"
              onDragOver={(event) => {
                if (!pending && event.dataTransfer.types.includes("text/lifesync-task")) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const row = tasks.data?.find((item) => item.id === event.dataTransfer.getData("text/lifesync-task"));
                if (row) void update(row, { status: value });
              }}
            >
              <h2 className="mb-3 flex items-center justify-between text-xs font-medium">
                {t(value)}
                <span className="text-muted-foreground">{rows.filter((row) => row.status === value).length}</span>
              </h2>
              <div className="space-y-2">{rows.filter((row) => row.status === value).map(taskCard)}</div>
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
      {details && (
        <TaskDetails
          row={tasks.data?.find((row) => row.id === details.id) ?? details}
          onClose={() => setDetails(undefined)}
        />
      )}
    </div>
  );
}
function TaskDetails({ row, onClose }: { row: Row; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{String(row.title)}</h2>
          {row.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{String(row.description)}</p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
      <ResourcePanel resource="taskChecklistItems" title="checklist" initial={{ taskId: row.id }} />
      <ResourcePanel resource="taskTags" title="tags" initial={{ taskId: row.id }} />
      <ResourcePanel resource="reminderRules" title="reminders" initial={{ taskId: row.id }} />
      <ResourcePanel resource="driveLinks" initial={{ taskId: row.id }} />
    </div>
  );
}
