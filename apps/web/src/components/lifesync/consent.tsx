"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey } from "@/lib/api";
import { useLocale } from "./providers";
import { useAccount } from "./shell";
export function Consent({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  const { t } = useLocale();
  const [accepted, setAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    try {
      await api("/consent", { method: "POST", body: JSON.stringify({ accepted: true }) });
      account.refresh();
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  if (account.user && !account.user.termsAcceptedAt)
    return (
      <section className="surface mx-auto max-w-xl space-y-5">
        <h1 className="page-heading">{t("welcome")}</h1>
        <div className="flex gap-4 text-sm text-primary">
          <a href="/terms">{t("terms")}</a>
          <a href="/privacy">{t("privacy")}</a>
        </div>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 size-5 accent-violet-600"
          />
          {t("acceptance")}
        </label>
        <Button disabled={!accepted || pending} onClick={() => void save()}>
          {t("confirm")}
        </Button>
      </section>
    );
  return children;
}
