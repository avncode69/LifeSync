"use client";
import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api";
import { useLocale } from "./providers";
export function Loading() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("loading")} className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="empty-state" role="alert">
      <AlertCircle className="size-8 text-destructive" />
      <p>{t(errorKey(error))}</p>
      <Button onClick={retry}>{t("retry")}</Button>
    </div>
  );
}
export function Empty({ children }: { children?: React.ReactNode }) {
  const { t } = useLocale();
  return (
    <div className="empty-state">
      <span className="rounded-2xl bg-primary/10 p-4 text-primary">
        <Inbox className="size-7" />
      </span>
      <h3 className="text-xl font-semibold">{t("empty")}</h3>
      <p className="text-muted-foreground">{t("emptyDescription")}</p>
      {children}
    </div>
  );
}
