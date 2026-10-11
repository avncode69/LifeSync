import type { Row } from "./api";

const priorities: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };

export function filterTasks(rows: Row[], query: string, status: string, priority: string, sort: string): Row[] {
  const search = query.trim().toLocaleLowerCase();
  return rows
    .filter(
      (row) =>
        (!search || `${row.title ?? ""} ${row.id}`.toLocaleLowerCase().includes(search)) &&
        (!status || row.status === status) &&
        (!priority || row.priority === priority),
    )
    .sort((a, b) =>
      sort === "priority"
        ? (priorities[String(b.priority)] ?? 0) - (priorities[String(a.priority)] ?? 0)
        : String(a[sort] ?? "").localeCompare(String(b[sort] ?? "")),
    );
}

export function paginateTasks(rows: Row[], requestedPage: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageCount };
}
