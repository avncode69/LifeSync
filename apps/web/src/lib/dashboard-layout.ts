export const dashboardDefinitions = [
  { id: "greeting", path: "/dashboard", module: "dashboard" },
  { id: "priorityTasks", path: "/tasks", module: "tasks" },
  { id: "todayCalendar", path: "/calendar", module: "calendar" },
  { id: "quickCapture", path: "/inbox", module: "inbox" },
  { id: "healthSummary", path: "/health", module: "health" },
  { id: "financeSummary", path: "/finance", module: "finance" },
  { id: "projects", path: "/projects", module: "projects" },
  { id: "habits", path: "/habits", module: "habits" },
  { id: "aiInput", path: "/ai", module: "ai" },
  { id: "upcomingReminders", path: "/notifications", module: "dashboard" },
];

export type DashboardWidget = { id: string; visible: boolean; size: "small" | "medium" | "large"; position: number };
export function defaultDashboardWidgets(): DashboardWidget[] {
  return dashboardDefinitions.map((definition, i) => ({
    id: definition.id,
    visible: true,
    size: ["greeting", "priorityTasks", "quickCapture"].includes(definition.id) ? "large" : "small",
    position: i,
  }));
}
