"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Row } from "@/lib/api";
import { AppearanceControls, useLocale } from "./providers";
import { Logo } from "./public";
export function Offline() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    try {
      const user = sessionStorage.getItem("lifesync.active-user");
      if (user) setRows(JSON.parse(sessionStorage.getItem(`lifesync.recent.tasks.${user}`) ?? "[]"));
    } catch {
      setRows([]);
    }
  }, []);
  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-8 px-5 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <AppearanceControls />
      </header>
      <p role="status" className="rounded-xl border bg-primary/10 p-5 text-primary">
        {t("offline")}
      </p>
      <Button className="min-h-11" onClick={() => location.assign("/dashboard")}>
        {t("retry")}
      </Button>
      <section className="surface">
        <h1 className="page-heading">
          {t("recent")} · {t("tasks")}
        </h1>
        <div className="mt-5 space-y-3">
          {rows.map((row) => (
            <article key={row.id} className="rounded-xl border p-3">
              <p className="font-medium">{String(row.title)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(String(row.status))}</p>
            </article>
          ))}
          {!rows.length && <p className="text-muted-foreground">{t("noResults")}</p>}
        </div>
      </section>
    </main>
  );
}
