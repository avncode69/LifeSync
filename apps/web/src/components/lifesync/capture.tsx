"use client";
import type { ResourceName } from "@lifesync/contracts";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey } from "@/lib/api";
import { localDate } from "@/lib/time";
import { useLocale } from "./providers";
import { ResourceEditor } from "./resource";
import { useAccount } from "./shell";
export function Capture({ onDone }: { onDone?: () => void }) {
  const { t } = useLocale();
  const { preferences } = useAccount();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<{ resource: ResourceName; input: Record<string, unknown> }>();
  async function parse(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || text.length > 2000 || pending) return;
    setPending(true);
    try {
      const result = await api<{
        kind: string;
        title: string;
        startsAt?: string;
        amount?: string;
        currency?: string;
        recurrenceRule?: string;
      }>("/capture/preview", { method: "POST", body: JSON.stringify({ text }) });
      const resources: Record<string, ResourceName> = {
        task: "tasks",
        event: "calendarEvents",
        habit: "habits",
        transaction: "financeTransactions",
        finance: "financeTransactions",
        inbox: "inboxItems",
      };
      const resource = resources[result.kind] ?? "inboxItems";
      const input: Record<string, unknown> =
        resource === "habits"
          ? { name: result.title, startDate: localDate(preferences?.timezone ?? "Europe/Kyiv") }
          : { title: result.title };
      if (result.startsAt) {
        input[resource === "tasks" ? "dueAt" : "startsAt"] = result.startsAt;
        if (resource === "calendarEvents")
          input.endsAt = new Date(new Date(result.startsAt).getTime() + 3600000).toISOString();
      }
      if (resource === "financeTransactions") {
        delete input.title;
        input.note = result.title;
        input.amount = result.amount;
        input.currency = result.currency;
        input.type = "expense";
        input.transactionDate = localDate(preferences?.timezone ?? "Europe/Kyiv");
      }
      if (result.recurrenceRule) input.recurrenceRule = result.recurrenceRule;
      setPreview({ resource, input });
    } catch (error) {
      toast.error(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form onSubmit={parse} className="space-y-3">
        <textarea
          className="control min-h-24 resize-none"
          required
          maxLength={2000}
          placeholder={t("captureHint")}
          aria-label={t("capture")}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex justify-end gap-2">
          {onDone && (
            <Button type="button" variant="ghost" onClick={onDone}>
              {t("cancel")}
            </Button>
          )}
          <Button type="submit" disabled={pending || !text.trim()} className="min-h-11">
            {t(pending ? "loading" : "preview")}
          </Button>
        </div>
      </form>
      {preview && (
        <ResourceEditor
          resource={preview.resource}
          initial={preview.input}
          onClose={() => setPreview(undefined)}
          onSaved={() => {
            setText("");
            setPreview(undefined);
            onDone?.();
          }}
        />
      )}
    </>
  );
}
