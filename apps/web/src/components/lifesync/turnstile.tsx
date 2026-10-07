"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./providers";
export type PublicConfig = {
  turnstileSiteKey: string | null;
  googleIdentityEnabled: boolean;
  supportEmail: string;
  vapidPublicKey: string | null;
  googlePickerApiKey?: string | null;
  googlePickerAppId?: string | null;
  googleWorkspaceClientId?: string | null;
};
export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig>();
  useEffect(() => {
    let active = true;
    void fetch("/api/public/config")
      .then((response) => response.json())
      .then((result: { data: PublicConfig }) => {
        if (active) setConfig(result.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return config;
}
type Turnstile = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void },
  ) => string;
  remove: (id: string) => void;
};
export function TurnstileField({ sitekey, onToken }: { sitekey: string; onToken: (token: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const onValue = useRef(onToken);
  onValue.current = onToken;
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let id: string | undefined;
    let disposed = false;
    const provider = () => (window as Window & { turnstile?: Turnstile }).turnstile;
    function mount() {
      if (disposed || !element.current || !provider()) return;
      id = provider()!.render(element.current, {
        sitekey,
        callback: (token) => onValue.current(token),
        "expired-callback": () => onValue.current(""),
      });
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (provider()) mount();
    else if (existing) existing.addEventListener("load", mount);
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.dataset.turnstile = "true";
      script.async = true;
      script.addEventListener("load", mount);
      script.addEventListener("error", () => setFailed(true));
      document.head.append(script);
    }
    return () => {
      disposed = true;
      existing?.removeEventListener("load", mount);
      if (id) provider()?.remove(id);
    };
  }, [sitekey]);
  return (
    <div>
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      )}
      <div ref={element} />
    </div>
  );
}
