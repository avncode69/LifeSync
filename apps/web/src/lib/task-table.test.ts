import { expect, it } from "vitest";
import { filterTasks, paginateTasks } from "./task-table";

const rows = [
  { id: "abc-123", title: "Plan release", status: "todo", priority: "high" },
  { id: "def-456", title: "Review", status: "done", priority: "low" },
  { id: "ghi-789", title: "Release notes", status: "todo", priority: "none" },
];

it("combines title or ID search with status and priority without changing source rows", () => {
  expect(filterTasks(rows, " RELEASE ", "todo", "high", "priority")).toEqual([rows[0]]);
  expect(filterTasks(rows, "def-", "", "", "title")).toEqual([rows[1]]);
  expect(rows.map((row) => row.id)).toEqual(["abc-123", "def-456", "ghi-789"]);
});

it("clamps the page after deletion or filtering and handles an empty result", () => {
  expect(paginateTasks(rows, 9, 2)).toEqual({ rows: [rows[2]], page: 2, pageCount: 2 });
  expect(paginateTasks([], 4, 10)).toEqual({ rows: [], page: 1, pageCount: 1 });
  expect(paginateTasks(rows, 0, 2).rows).toEqual(rows.slice(0, 2));
});
