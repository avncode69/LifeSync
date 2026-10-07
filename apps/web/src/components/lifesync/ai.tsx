"use client";
import { Copy, Plus, Send, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorKey, RequestError, type Row, useApi } from "@/lib/api";
import { useLocale } from "./providers";
import { ErrorState, Loading } from "./states";

type Message = { id: string; role: string; content: string };
type Action = {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  targetId?: string;
  confirmationToken: string;
  requiresConfirmation: true;
};
export function AI() {
  const { t } = useLocale();
  const conversations = useApi<Row[]>("/ai/conversations?limit=100");
  const quota = useApi<{ remaining: number; limit: number; configured: boolean }>("/ai/quota");
  const permissions = useApi<Record<string, boolean>>("/ai/permissions");
  const [active, setActive] = useState<string>();
  const history = useApi<Message[]>(active ? `/ai/conversations/${active}/messages` : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const controller = useRef<AbortController | undefined>(undefined);
  const last = useRef<{ text: string; key: string } | undefined>(undefined);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMessages(history.data ?? []);
    setActions([]);
  }, [history.data]);
  useEffect(() => {
    if (scroll.current && messages.length) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages]);
  useEffect(() => {
    const prompt = new URLSearchParams(location.search).get("prompt");
    if (prompt) setText(prompt);
    return () => controller.current?.abort();
  }, []);
  async function create() {
    try {
      const conversation = await api<Row>("/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ title: t("newChat") }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setActive(conversation.id);
      setMessages([]);
      await conversations.reload();
      return conversation.id;
    } catch (error) {
      toast.error(t(errorKey(error)));
      return undefined;
    }
  }
  async function remove(id: string) {
    try {
      await api(`/ai/conversations/${id}`, { method: "DELETE" });
      await conversations.reload();
      if (id === active) {
        setActive(undefined);
        setMessages([]);
      }
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  async function send(retry = false) {
    const prompt = retry ? last.current?.text : text.trim();
    if (!prompt || prompt.length > 5000 || pending) return;
    let conversationId = active;
    if (!conversationId) conversationId = await create();
    if (!conversationId) return;
    const key = retry && last.current ? last.current.key : crypto.randomUUID();
    last.current = { text: prompt, key };
    setText("");
    setFailure(undefined);
    setPending(true);
    setActions([]);
    controller.current = new AbortController();
    const answerId = crypto.randomUUID();
    if (!retry) setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "user", content: prompt }]);
    setMessages((previous) => [...previous, { id: answerId, role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        credentials: "same-origin",
        body: JSON.stringify({ conversationId, message: prompt }),
        signal: controller.current.signal,
      });
      if (!response.ok) {
        const result = await response.json();
        throw new RequestError(result.error?.code ?? "AI_ERROR", result.error?.requestId, response.status);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("NO_STREAM");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let separator = buffer.indexOf("\n\n");
        while (separator >= 0) {
          const frame = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          const event = frame
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.slice(6)
            .trim();
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("\n");
          if (data) {
            const result = JSON.parse(data);
            if (event === "text")
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === answerId
                    ? { ...message, content: message.content + String(result.text ?? "") }
                    : message,
                ),
              );
            if (event === "action") setActions((previous) => [...previous, result as Action]);
            if (event === "error") throw new RequestError(result.error?.code ?? "AI_ERROR", result.error?.requestId);
            if (event === "done") void conversations.reload();
          }
          separator = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setFailure(error);
    } finally {
      setPending(false);
      void quota.reload();
    }
  }
  async function confirm(action: Action) {
    try {
      const result = await api<{ actionId: string; undoAvailable: boolean }>(`/ai/actions/${action.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmationToken: action.confirmationToken }),
      });
      setActions((previous) => previous.filter((item) => item.id !== action.id));
      toast.success(
        t("saved"),
        result.undoAvailable
          ? {
              action: {
                label: t("undo"),
                onClick: () => {
                  void api(`/ai/actions/${result.actionId}/undo`, { method: "POST", body: "{}" })
                    .then(() => toast.success(t("saved")))
                    .catch((error) => toast.error(t(errorKey(error))));
                },
              },
            }
          : undefined,
      );
    } catch (error) {
      toast.error(t(errorKey(error)));
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-heading">{t("ai")}</h1>
        <Button className="min-h-11 gap-2" onClick={() => void create()}>
          <Plus />
          {t("newChat")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("aiRetention")}</p>
      <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
        <aside className="surface max-h-72 overflow-y-auto xl:max-h-[70dvh]">
          <p className="mb-4 text-xs text-muted-foreground">
            {t("remaining")}: {quota.data?.remaining ?? "—"}
          </p>
          {conversations.error ? (
            <ErrorState error={conversations.error} retry={() => void conversations.reload()} />
          ) : (
            conversations.data?.map((conversation) => (
              <div
                key={conversation.id}
                className={`mb-2 flex items-center rounded-xl ${active === conversation.id ? "bg-primary/10" : "hover:bg-muted"}`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate p-3 text-left text-sm"
                  onClick={() => {
                    controller.current?.abort();
                    setActive(conversation.id);
                    setFailure(undefined);
                  }}
                >
                  {String(conversation.title)}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("delete")}
                  onClick={() => void remove(conversation.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
          <div className="mt-5 border-t pt-4">
            <p className="text-xs font-medium">{t("permissions")}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(permissions.data ?? {})
                .filter(([, value]) => value)
                .map(([key]) => (
                  <span key={key} className="rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {t(key)}
                  </span>
                ))}
            </div>
            <a href="/settings" className="mt-3 inline-block text-xs text-primary">
              {t("edit")} →
            </a>
          </div>
        </aside>
        <section className="surface flex min-h-[65dvh] flex-col">
          <div ref={scroll} className="max-h-[55dvh] flex-1 space-y-5 overflow-y-auto pr-1">
            {history.loading && active ? (
              <Loading />
            ) : !messages.length ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <h2 className="text-2xl font-semibold tracking-tight">{t("aiHelp")}</h2>
                <p className="mt-4 max-w-md text-sm text-muted-foreground">{t("permissionHelp")}</p>
              </div>
            ) : (
              messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[92%] rounded-2xl p-4 ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "border bg-muted/30"}`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
                  {message.role === "assistant" && message.content && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("copy")}
                      className="mt-2"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(message.content)
                          .then(() => toast.success(t("success")))
                          .catch(() => toast.error(t("error")))
                      }
                    >
                      <Copy className="size-4" />
                    </Button>
                  )}
                </article>
              ))
            )}
            {actions.map((action) => (
              <article key={action.id} className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <h3 className="font-semibold">
                  {t("aiAction")} · {t(action.tool)}
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(action.input).map(([key, value]) => (
                    <div key={key}>
                      <dt className="inline text-muted-foreground">{t(key)}: </dt>
                      <dd className="inline break-words">
                        {typeof value === "object" ? t("selected") : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => void confirm(action)}>{t("confirm")}</Button>
                  <Button
                    variant="outline"
                    onClick={() => setActions((previous) => previous.filter((item) => item.id !== action.id))}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </article>
            ))}
            {!!failure && <ErrorState error={failure} retry={() => void send(true)} />}
          </div>
          {!quota.data?.configured && quota.data && (
            <p className="my-3 rounded-xl bg-muted p-3 text-sm">{t("unavailable")}</p>
          )}
          <form
            className="mt-5 flex gap-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              className="control min-h-12 flex-1 resize-none"
              aria-label={t("ai")}
              placeholder={t("captureHint")}
              maxLength={5000}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            {pending ? (
              <Button
                type="button"
                className="min-h-12 min-w-12"
                aria-label={t("stop")}
                onClick={() => controller.current?.abort()}
              >
                <Square className="size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="min-h-12 min-w-12"
                aria-label={t("send")}
                disabled={!text.trim() || quota.data?.remaining === 0 || !quota.data?.configured}
              >
                <Send className="size-4" />
              </Button>
            )}
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{t("healthNotice")}</p>
        </section>
      </div>
    </div>
  );
}
