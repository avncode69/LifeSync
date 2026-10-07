import { useCallback, useEffect, useRef, useState } from "react";
export type Row = { id: string; [key: string]: unknown };
export class RequestError extends Error {
  constructor(
    public code: string,
    public requestId?: string,
    public status?: number,
  ) {
    super(code);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (typeof navigator !== "undefined" && !navigator.onLine && init?.method && init.method !== "GET")
    throw new RequestError("OFFLINE");
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = (await response.json()) as {
    data: T;
    error?: { code: string; requestId: string };
    nextCursor?: string;
  };
  if (!response.ok)
    throw new RequestError(result.error?.code ?? "REQUEST_FAILED", result.error?.requestId, response.status);
  if (
    (!init?.method || init.method === "GET") &&
    Array.isArray(result.data) &&
    result.nextCursor &&
    !new URL(path, "https://local.invalid").searchParams.has("cursor")
  ) {
    const rows = [...result.data];
    let cursor: string | undefined = result.nextCursor;
    const seen = new Set<string>();
    while (cursor) {
      if (seen.has(cursor) || seen.size >= 1000) throw new RequestError("PAGINATION_LIMIT");
      seen.add(cursor);
      const url = new URL(`/api/v1${path}`, "https://local.invalid");
      url.searchParams.set("cursor", cursor);
      const page = await fetch(`${url.pathname}${url.search}`, { credentials: "same-origin", cache: "no-store" });
      const payload = await page.json();
      if (!page.ok)
        throw new RequestError(payload.error?.code ?? "REQUEST_FAILED", payload.error?.requestId, page.status);
      if (!Array.isArray(payload.data)) throw new RequestError("INVALID_PAGE");
      rows.push(...payload.data);
      cursor = payload.nextCursor;
    }
    return rows as T;
  }
  return result.data;
}
export async function auth<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.code ?? "AUTH_ERROR", undefined, response.status);
  return result as T;
}
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const version = useRef(0);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const current = ++version.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (current === version.current) {
        setData(result);
        setError(undefined);
      }
    } catch (reason) {
      if (current === version.current) setError(reason);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
    return () => {
      version.current++;
    };
  }, [reload]);
  return { data, error, loading, reload, setData };
}
export function errorKey(error: unknown) {
  if (error instanceof RequestError) {
    if (error.code === "RATES_UNAVAILABLE" || error.code === "RATE_UNAVAILABLE") return "ratesUnavailable";
    if (error.code === "OFFLINE") return "offline";
    if (error.code === "EMAIL_NOT_VERIFIED") return "verify";
    if (error.code === "VALIDATION_ERROR") return "invalid";
    if (error.code.includes("LIMIT")) return "limitReached";
    if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "invalidCredentials";
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
    if (error.code.includes("QUOTA")) return "quota";
    if (error.status === 503) return "unavailable";
  }
  return "error";
}
export function label(row: Row) {
  return String(row.title ?? row.name ?? row.note ?? row.content ?? row.email ?? row.type ?? row.id);
}
