"use client";
import { financeTransactionCreateSchema } from "@lifesync/contracts";
import { formatDecimal } from "@lifesync/i18n";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api, errorKey, useApi } from "@/lib/api";
import { localDate } from "@/lib/time";
import { useLocale } from "./providers";
import { useAccount } from "./shell";
import { Empty, ErrorState, Loading } from "./states";

type Account = { id: string; name: string; currency: string };
export function Transfer({ accounts, refresh }: { accounts: Account[]; refresh: () => void }) {
  const { t } = useLocale();
  const { preferences } = useAccount();
  const [open, setOpen] = useState(false);
  const attempt = useRef<{ body: string; key: string } | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [date, setDate] = useState(() => localDate(preferences?.timezone ?? "Europe/Kyiv"));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const from = accounts.find((a) => a.id === source);
  const to = accounts.find((a) => a.id === destination);
  const sameCurrency = !!from && from.currency === to?.currency;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = financeTransactionCreateSchema.safeParse({
      type: "transfer",
      accountId: source,
      destinationAccountId: destination,
      amount,
      destinationAmount: sameCurrency ? amount : received,
      currency: from?.currency,
      transactionDate: date,
      note,
    });
    if (!result.success) {
      setError(t("invalid"));
      return;
    }
    const body = JSON.stringify(result.data);
    if (attempt.current?.body !== body) attempt.current = { body, key: crypto.randomUUID() };
    const key = attempt.current.key;
    setPending(true);
    setError("");
    try {
      await api("/finance/transactions", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": key },
      });
      attempt.current = undefined;
      setOpen(false);
      setAmount("");
      setReceived("");
      setNote("");
      refresh();
      window.dispatchEvent(new Event("lifesync:finance"));
      toast.success(t("saved"));
    } catch (reason) {
      setError(t(errorKey(reason)));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button disabled={accounts.length < 2} onClick={() => setOpen(true)}>
        {t("transferFunds")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle>{t("transferFunds")}</DialogTitle>
          <DialogDescription>{t("transactions")}</DialogDescription>
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-2">
              <span>{t("sourceAccount")}</span>
              <select required className="control" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">{t("noSelection")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span>{t("receivingAccount")}</span>
              <select required className="control" value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="">{t("noSelection")}</option>
                {accounts
                  .filter((a) => a.id !== source)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span>
                {t("sentAmount")} {from?.currency}
              </span>
              <input
                className="control"
                required
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,4})?"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span>
                {t("receivedAmount")} {to?.currency}
              </span>
              <input
                className="control"
                required
                inputMode="decimal"
                readOnly={sameCurrency}
                value={sameCurrency ? amount : received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span>{t("date")}</span>
              <input className="control" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block space-y-2">
              <span>{t("note")}</span>
              <textarea className="control" maxLength={20000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button disabled={pending} type="submit">
              {t(pending ? "loading" : "save")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
type Totals = { income: string; expense: string; balance: string };
type Report = Totals & {
  currency: string;
  trends: (Totals & { date: string })[];
  distribution: { categoryId: string | null; amount: string }[];
  rateSnapshots: { transactionId: string; rateDate: string; currency: string; source: string; stale: boolean }[];
  staleRates: { requestedDate: string; rateDate: string; source: string }[];
};
export function FinanceReport({
  month,
  currency,
  categories,
}: {
  month: string;
  currency: string;
  categories: { category_id: string; name: string }[];
}) {
  const { t, locale } = useLocale();
  const [year, number] = month.split("-").map(Number);
  const end = `${month}-${new Date(year, number, 0).getDate()}`;
  const report = useApi<Report>(`/finance/report?from=${month}-01&to=${end}&currency=${currency}`);
  useEffect(() => {
    const refresh = () => void report.reload();
    window.addEventListener("lifesync:finance", refresh);
    return () => window.removeEventListener("lifesync:finance", refresh);
  }, [report.reload]);
  const data = report.data;
  return (
    <section className="surface space-y-5">
      <h2 className="text-lg font-semibold">
        {t("convertedReport")} · {currency}
      </h2>
      {report.loading ? (
        <Loading />
      ) : report.error ? (
        <ErrorState error={report.error} retry={() => void report.reload()} />
      ) : (
        data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["income", "expense", "balance"] as const).map((key) => (
                <div key={key}>
                  <p className="text-sm text-muted-foreground">{t(key)}</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {formatDecimal(data[key], locale)} {currency}
                  </p>
                </div>
              ))}
            </div>
            {!!data.staleRates.length && (
              <p role="status" className="text-sm text-muted-foreground">
                {t("stale")} {data.staleRates.map((rate) => `${rate.requestedDate} → ${rate.rateDate}`).join(", ")}
              </p>
            )}
            <h3 className="font-medium">{t("dailyTrends")}</h3>
            {data.trends.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">{t("date")}</th>
                      <th className="text-right">{t("income")}</th>
                      <th className="text-right">{t("expense")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trends.map((day) => (
                      <tr key={day.date} className="border-t">
                        <td className="py-2">{day.date}</td>
                        <td className="text-right tabular-nums">{formatDecimal(day.income, locale)}</td>
                        <td className="text-right tabular-nums">{formatDecimal(day.expense, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
            <h3 className="font-medium">{t("categories")}</h3>
            {data.distribution.map((item) => (
              <div key={item.categoryId ?? "none"} className="flex justify-between gap-3 text-sm">
                <span>{categories.find((c) => c.category_id === item.categoryId)?.name ?? t("noSelection")}</span>
                <span>
                  {formatDecimal(item.amount, locale)} {currency}
                </span>
              </div>
            ))}
            {!!data.rateSnapshots.length && (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{t("rateReferences")}</summary>
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {data.rateSnapshots.map((rate) => (
                    <li key={`${rate.transactionId}-${rate.currency}`}>
                      {rate.currency} · {rate.rateDate} · {rate.source}
                      {rate.stale ? ` · ${t("stale")}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}
