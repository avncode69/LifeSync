"use client";
import { useEffect, useState } from "react";
import { RequestError, type Row } from "./api";

export async function readSavedAccount(signal?: AbortSignal): Promise<Row | null> {
  const response = await fetch("/api/v1/me", { credentials: "same-origin", cache: "no-store", signal });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new RequestError("REQUEST_FAILED", undefined, response.status);
  const result = (await response.json()) as { data?: Row };
  return typeof result.data?.id === "string" ? result.data : null;
}

export function useSavedAccount(enabled = true) {
  const [account, setAccount] = useState<Row | null>(null);
  const [checking, setChecking] = useState(enabled);
  useEffect(() => {
    if (!enabled) {
      setChecking(false);
      return;
    }
    const controller = new AbortController();
    setChecking(true);
    void readSavedAccount(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setAccount(value);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [enabled]);
  return { account, checking };
}
