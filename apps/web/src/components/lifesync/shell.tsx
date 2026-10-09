"use client";
import type { Preferences, ResourceName } from "@lifesync/contracts";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Heart,
  Home,
  Inbox,
  Layers,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Sprout,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { auth, errorKey, label, RequestError, type Row, useApi } from "@/lib/api";
import { cleanupBrowserPush } from "@/lib/push";
import { Capture } from "./capture";
import { AppearanceControls, useLocale } from "./providers";
import { Logo } from "./public";
import { PwaControls } from "./pwa";
import { ResourceEditor } from "./resource";
import { ErrorState, Loading } from "./states";
export const navigation = [
  { key: "dashboard", path: "/dashboard", icon: Home },
  { key: "inbox", path: "/inbox", icon: Inbox },
  { key: "calendar", path: "/calendar", icon: CalendarDays },
  { key: "projects", path: "/projects", icon: Layers },
  { key: "tasks", path: "/tasks", icon: CheckCheck },
  { key: "habits", path: "/habits", icon: Sprout },
  { key: "health", path: "/health", icon: Heart },
  { key: "finance", path: "/finance", icon: CircleDollarSign },
  { key: "ai", path: "/ai", icon: Sparkles },
  { key: "workspace", path: "/integrations", icon: CalendarDays },
  { key: "notifications", path: "/notifications", icon: Bell },
  { key: "settings", path: "/settings", icon: Settings2 },
  { key: "trash", path: "/trash", icon: Trash2 },
];
const AccountContext = createContext<{ user?: Row; preferences?: Preferences; refresh: () => void }>({
  refresh: () => {},
});
export function useAccount() {
  return useContext(AccountContext);
}
export function Shell({ children }: { children: React.ReactNode }) {
  const { t, setLocale } = useLocale();
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const me = useApi<Row>("/me");
  const prefs = useApi<Preferences>("/preferences");
  const notifications = useApi<{ count: number }>("/notifications/unread-count");
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState(false);
  const [capture, setCapture] = useState(false);
  const [offline, setOffline] = useState(false);
  const appliedThemePreference = useRef<Preferences | null>(null);
  useEffect(() => {
    if (me.error instanceof RequestError && me.error.status === 401) location.assign("/login");
  }, [me.error]);
  useEffect(() => {
    if (prefs.data) {
      if (prefs.data.onboardingCompleted && !sessionStorage.getItem("lifesync.locale-choice"))
        setLocale(prefs.data.locale);
      // next-themes changes setTheme's identity when the chosen theme changes.
      // Apply each fetched result once, including an explicit Settings save,
      // without undoing the header control on a theme-only rerender.
      if (appliedThemePreference.current !== prefs.data) {
        appliedThemePreference.current = prefs.data;
        setTheme(prefs.data.theme);
      }
    }
  }, [prefs.data, setLocale, setTheme]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearch((previous) => !previous);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setCapture(true);
      }
    };
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("keydown", onKey);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  async function logout() {
    let signedOut = false;
    try {
      await cleanupBrowserPush();
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
    try {
      await auth("/sign-out", {});
      signedOut = true;
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      sessionStorage.clear();
      if ("caches" in window) {
        try {
          await Promise.all(
            (await caches.keys()).filter((key) => key.startsWith("lifesync-private")).map((key) => caches.delete(key)),
          );
        } catch {
          toast.error(t("error"));
        }
      }
      if (signedOut) location.assign("/login");
    }
  }
  const visible = navigation.filter(
    (item) => !prefs.data?.hiddenModules.includes(item.key as Preferences["hiddenModules"][number]),
  );
  const unread = notifications.data?.count ?? 0;
  useEffect(() => {
    if (!me.data) return;
    const old = sessionStorage.getItem("lifesync.active-user");
    const pushUser = localStorage.getItem("lifesync.push-user");
    if ((old && old !== me.data.id) || (pushUser && pushUser !== me.data.id)) {
      void cleanupBrowserPush(false).catch((error) => toast.error(t(errorKey(error))));
    }

    if (old && old !== me.data.id) {
      const choice = sessionStorage.getItem("lifesync.locale-choice");
      sessionStorage.clear();
      if (choice) sessionStorage.setItem("lifesync.locale-choice", choice);
    }
    sessionStorage.setItem("lifesync.active-user", me.data.id);
  }, [me.data, t]);
  useEffect(() => {
    const reload = () => void notifications.reload();
    window.addEventListener("lifesync:notifications", reload);
    const timer = setInterval(reload, 60000);
    return () => {
      window.removeEventListener("lifesync:notifications", reload);
      clearInterval(timer);
    };
  }, [notifications.reload]);
  const navLink = (item: (typeof navigation)[number]) => (
    <Link
      key={item.key}
      href={item.path}
      onClick={() => setMore(false)}
      aria-current={pathname === item.path ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${pathname === item.path ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
    >
      <item.icon className="size-4 shrink-0" />
      <span>{t(item.key === "workspace" ? "integrations" : item.key)}</span>
      {item.key === "notifications" && unread > 0 && (
        <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>
      )}
    </Link>
  );
  return (
    <AccountContext.Provider
      value={{
        user: me.data,
        preferences: prefs.data,
        refresh: () => {
          void me.reload();
          void prefs.reload();
        },
      }}
    >
      <div className="lifesync-app min-h-dvh">
        <aside className="lifesync-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r px-3 py-4 lg:flex">
          <div className="px-2">
            <Logo />
          </div>
          <Button
            variant="outline"
            className="my-5 min-h-10 justify-between text-muted-foreground"
            onClick={() => setSearch(true)}
          >
            <span className="flex items-center gap-2">
              <Search className="size-4" />
              {t("search")}
            </span>
            <kbd className="text-xs">⌘K</kbd>
          </Button>
          <p className="mb-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("overview")}
          </p>
          <nav className="lifesync-navigation flex-1 space-y-0.5 overflow-y-auto">
            {visible.map(navLink)}
            {String(me.data?.role) === "admin" && navLink({ key: "admin", path: "/admin", icon: Shield })}
          </nav>
          <div className="mt-4 border-t pt-4">
            <p className="truncate px-3 text-sm font-semibold">{String(me.data?.name ?? "LifeSync")}</p>
            <Button
              variant="ghost"
              className="mt-2 min-h-11 w-full justify-start gap-3 text-muted-foreground"
              onClick={() => void logout()}
            >
              <LogOut className="size-4" />
              {t("logout")}
            </Button>
          </div>
        </aside>
        <div className="lg:pl-60">
          <header className="lifesync-header sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Logo compact />
              </div>
              <div className="hidden text-sm text-muted-foreground lg:block">
                {t(navigation.find((item) => item.path === pathname)?.key ?? "dashboard")}
              </div>
            </div>
            <Button
              variant="outline"
              className="mx-auto hidden min-h-10 min-w-0 flex-1 shrink max-w-xs justify-start gap-2 text-muted-foreground xl:flex"
              onClick={() => setSearch(true)}
            >
              <Search className="size-4" />
              <span className="truncate">{t("search")}</span>
              <kbd className="ml-auto rounded bg-muted px-1.5 text-xs">⌘K</kbd>
            </Button>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("search")}
                className="min-h-11 min-w-11 lg:hidden"
                onClick={() => setSearch(true)}
              >
                <Search />
              </Button>
              <div className="hidden sm:flex">
                <PwaControls />
              </div>
              <AppearanceControls />
              <Link
                href="/notifications"
                aria-label={t("notifications")}
                className="relative flex size-11 items-center justify-center rounded-xl hover:bg-muted"
              >
                <Bell className="size-5" />
                {unread > 0 && (
                  <span className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground">
                    {unread}
                  </span>
                )}
              </Link>
              <Button onClick={() => setCapture(true)} className="hidden min-h-11 sm:inline-flex">
                + {t("capture")}
              </Button>
            </div>
          </header>
          {offline && (
            <p role="status" className="border-b bg-primary/10 px-5 py-3 text-sm text-primary">
              {t("offline")}
            </p>
          )}
          <main
            id="main-content"
            className={`mx-auto max-w-7xl space-y-6 px-4 py-5 pb-28 sm:px-6 lg:py-6 ${offline ? "[&_form]:pointer-events-none [&_form]:opacity-60" : ""}`}
          >
            {me.loading ? (
              <Loading />
            ) : me.error ? (
              <ErrorState error={me.error} retry={() => void me.reload()} />
            ) : (
              children
            )}
          </main>
        </div>
        <nav
          className="lifesync-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
          aria-label={t("more")}
        >
          {navigation
            .filter((item) => ["dashboard", "calendar", "tasks", "ai"].includes(item.key))
            .map((item) => (
              <Link
                key={item.key}
                href={item.path}
                aria-current={pathname === item.path ? "page" : undefined}
                className={`flex min-h-17 flex-col items-center justify-center gap-1 text-[11px] ${pathname === item.path ? "text-primary" : "text-muted-foreground"}`}
              >
                <item.icon className="size-5" />
                {t(item.key === "dashboard" ? "home" : item.key)}
              </Link>
            ))}
          <button
            type="button"
            className="flex min-h-17 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground"
            onClick={() => setMore(true)}
          >
            <Menu className="size-5" />
            {t("more")}
          </button>
        </nav>
        <Dialog open={more} onOpenChange={setMore}>
          <DialogContent showCloseButton={false} className="max-h-[85dvh] overflow-y-auto">
            <DialogTitle>{t("more")}</DialogTitle>
            <PwaControls />
            <DialogDescription>LifeSync</DialogDescription>
            <nav className="grid grid-cols-2 gap-2">{visible.map(navLink)}</nav>
            <Button
              className="min-h-11"
              onClick={() => {
                setMore(false);
                setCapture(true);
              }}
            >
              {t("capture")}
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              {t("logout")}
            </Button>
          </DialogContent>
        </Dialog>
        {search && (
          <SearchPalette
            onClose={() => setSearch(false)}
            onCapture={() => {
              setSearch(false);
              setCapture(true);
            }}
          />
        )}
        {capture && (
          <Dialog open onOpenChange={() => setCapture(false)}>
            <DialogContent showCloseButton={false} className="sm:max-w-xl">
              <DialogTitle>{t("capture")}</DialogTitle>
              <DialogDescription>{t("captureHint")}</DialogDescription>
              <Capture onDone={() => setCapture(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AccountContext.Provider>
  );
}
function SearchPalette({ onClose, onCapture }: { onClose: () => void; onCapture: () => void }) {
  const { t, locale } = useLocale();
  const { preferences } = useAccount();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [index, setIndex] = useState(0);
  const [editor, setEditor] = useState<ResourceName>();
  const [recent, setRecent] = useState<string[]>([]);
  const results = useApi<{ resource: string; path: string; items: Row[] }[]>(
    debounced ? `/search?q=${encodeURIComponent(debounced)}` : null,
  );
  useEffect(() => {
    try {
      setRecent(JSON.parse(sessionStorage.getItem("lifesync.recent-actions") ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, []);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 180);
    return () => clearTimeout(timeout);
  }, [query]);
  const commands = [
    { name: `${t("create")} · ${t("tasks")}`, key: "tasks", run: () => setEditor("tasks") },
    { name: t("capture"), key: "capture", run: onCapture },
    { name: `${t("create")} · ${t("calendar")}`, key: "calendarEvents", run: () => setEditor("calendarEvents") },
    {
      name: `${t("create")} · ${t("transactions")}`,
      key: "financeTransactions",
      run: () => setEditor("financeTransactions"),
    },
    { name: `${t("create")} · ${t("meals")}`, key: "mealEntries", run: () => setEditor("mealEntries") },
    ...navigation.map((item) => ({ name: t(item.key), key: item.path, run: () => location.assign(item.path) })),
  ].filter(
    (command) =>
      !preferences?.hiddenModules.includes(
        (command.key.includes("finance")
          ? "finance"
          : command.key.includes("meal")
            ? "health"
            : command.key.startsWith("/")
              ? command.key.slice(1)
              : command.key) as Preferences["hiddenModules"][number],
      ),
  );
  const sorted = query
    ? commands.filter((command) => command.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)))
    : [...commands].sort(
        (a, b) =>
          (recent.indexOf(a.key) < 0 ? 999 : recent.indexOf(a.key)) -
          (recent.indexOf(b.key) < 0 ? 999 : recent.indexOf(b.key)),
      );
  const found = (query ? (results.data ?? []) : []).flatMap((group) =>
    group.items.map((row) => ({
      name: label(row),
      key: `${group.resource}:${row.id}`,
      group: group.resource,
      metadata: String(row.description ?? row.note ?? row.status ?? row.date ?? ""),
      run: () => location.assign(`${routeForResource(group.resource)}?resource=${group.resource}&item=${row.id}`),
    })),
  );
  const entries = [
    ...sorted.map((command) => ({
      ...command,
      group: recent.includes(command.key) ? "recent" : "commands",
      metadata: "",
    })),
    ...found,
  ];
  function run(i: number) {
    const entry = entries[i];
    if (!entry) return;
    const next = [entry.key, ...recent.filter((key) => key !== entry.key)].slice(0, 8);
    setRecent(next);
    sessionStorage.setItem("lifesync.recent-actions", JSON.stringify(next));
    entry.run();
  }
  function highlight(text: string) {
    const at = text.toLocaleLowerCase(locale).indexOf(query.toLocaleLowerCase(locale));
    return query && at >= 0 ? (
      <>
        {text.slice(0, at)}
        <mark className="rounded bg-primary/15 text-primary">{text.slice(at, at + query.length)}</mark>
        {text.slice(at + query.length)}
      </>
    ) : (
      text
    );
  }
  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent showCloseButton={false} className="max-h-[95dvh] sm:max-w-2xl">
          <DialogTitle>{t("search")}</DialogTitle>
          <DialogDescription>{t("commandHint")}</DialogDescription>
          <input
            autoFocus
            className="control min-h-14 text-lg"
            placeholder={t("search")}
            value={query}
            aria-controls="search-results"
            aria-activedescendant={entries[index] ? `search-entry-${index}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setIndex(
                  (previous) =>
                    (previous + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % Math.max(1, entries.length),
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                run(index);
              }
            }}
          />
          <div id="search-results" role="listbox" className="max-h-[60dvh] overflow-y-auto">
            {!!results.error && <ErrorState error={results.error} retry={() => void results.reload()} />}{" "}
            {query && results.loading && <Loading />}
            {entries.map((entry, i) => {
              const Icon =
                navigation.find((item) => item.key === entry.group)?.icon ??
                (entry.group === "commands" ? Plus : Search);
              return (
                <div key={entry.key}>
                  {(i === 0 || entries[i - 1].group !== entry.group) && (
                    <p className="px-4 pb-1 pt-3 text-xs font-medium text-muted-foreground">{t(entry.group)}</p>
                  )}
                  <button
                    id={`search-entry-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === index}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => run(i)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left ${i === index ? "bg-primary/10" : "hover:bg-muted"}`}
                  >
                    <Icon className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{highlight(entry.name)}</span>
                      {entry.metadata && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {highlight(t(entry.metadata))}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">↵</span>
                  </button>
                </div>
              );
            })}
            {!entries.length && !results.loading && <p className="p-5 text-muted-foreground">{t("noResults")}</p>}
          </div>
        </DialogContent>
      </Dialog>
      {editor && (
        <ResourceEditor
          resource={editor}
          initial={
            query
              ? editor === "mealEntries" || editor === "financeTransactions"
                ? { note: query }
                : { title: query }
              : undefined
          }
          onClose={() => setEditor(undefined)}
          onSaved={onClose}
        />
      )}
    </>
  );
}
export function routeForResource(resource: string) {
  if (["tasks", "projects", "habits", "notifications"].includes(resource)) return `/${resource}`;
  if (resource.startsWith("inbox")) return "/inbox";
  if (resource.startsWith("calendar")) return "/calendar";
  if (/finance|financial|budget|saving/i.test(resource)) return "/finance";
  if (/health|body|meal|water|workout|food|exercise/i.test(resource)) return "/health";
  return "/integrations";
}
