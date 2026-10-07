"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorKey } from "@/lib/api";
import { useLocale } from "./providers";
import { usePublicConfig } from "./turnstile";

type Picker = { setVisible: (visible: boolean) => void; dispose: () => void };
type Builder = {
  addView: (view: unknown) => Builder;
  setOAuthToken: (token: string) => Builder;
  setDeveloperKey: (key: string) => Builder;
  setAppId: (id: string) => Builder;
  setOrigin: (origin: string) => Builder;
  setLocale: (locale: string) => Builder;
  setCallback: (callback: (value: { action: string; docs?: { id: string }[] }) => void) => Builder;
  build: () => Picker;
};
type GoogleWindow = Window & {
  gapi?: {
    load: (
      module: string,
      options: { callback: () => void; onerror: () => void; timeout: number; ontimeout: () => void },
    ) => void;
  };
  google?: {
    accounts?: {
      oauth2: {
        initTokenClient: (options: {
          client_id: string;
          scope: string;
          include_granted_scopes: boolean;
          hint?: string;
          callback: (value: { access_token?: string; error?: string }) => void;
          error_callback: () => void;
        }) => { requestAccessToken: (options: { prompt: string }) => void };
      };
    };
    picker: { PickerBuilder: new () => Builder; ViewId: { DOCS: string }; Action: { PICKED: string; CANCEL: string } };
  };
};
let loader: Promise<void> | undefined;
function loadPicker() {
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const fail = () => {
      loader = undefined;
      reject(new Error("Picker unavailable"));
    };
    const initialize = () =>
      (window as GoogleWindow).gapi?.load("picker", {
        callback: resolve,
        onerror: fail,
        timeout: 10000,
        ontimeout: fail,
      });
    if ((window as GoogleWindow).gapi) initialize();
    else {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.async = true;
      script.addEventListener("load", initialize, { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.append(script);
    }
  });
  return loader;
}
async function loadGis() {
  await new Promise<void>((resolve, reject) => {
    if ((window as GoogleWindow).google?.accounts) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Google authorization unavailable")), { once: true });
    document.head.append(script);
  });
}
export function DrivePicker({ onSelected, email }: { onSelected: (fileId: string) => Promise<void>; email?: string }) {
  const { t, locale } = useLocale();
  const config = usePublicConfig();
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const pickerRef = useRef<Picker | undefined>(undefined);
  useEffect(() => {
    if (!config?.googlePickerApiKey || !config.googleWorkspaceClientId) return;
    let active = true;
    void loadPicker()
      .then(loadGis)
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) toast.error(t("error"));
      });
    return () => {
      active = false;
      pickerRef.current?.dispose();
    };
  }, [config?.googlePickerApiKey, config?.googleWorkspaceClientId, t]);
  async function choose() {
    if (pending) return;
    setPending(true);
    try {
      if (!config?.googlePickerApiKey || !config.googlePickerAppId || !config.googleWorkspaceClientId)
        throw new Error("Picker unavailable");
      const google = (window as GoogleWindow).google;
      if (!google?.accounts) throw new Error("Google authorization unavailable");
      const accounts = google.accounts;
      const clientId = config.googleWorkspaceClientId;
      const accessToken = await new Promise<string>((resolve, reject) => {
        const client = accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/drive.file",
          include_granted_scopes: false,
          hint: email,
          callback: (value) =>
            value.access_token ? resolve(value.access_token) : reject(new Error(value.error ?? "Authorization failed")),
          error_callback: () => reject(new Error("Authorization cancelled")),
        });
        client.requestAccessToken({ prompt: "consent" });
      });
      const provider = google.picker;
      let picker: Picker;
      picker = new provider.PickerBuilder()
        .addView(provider.ViewId.DOCS)
        .setOAuthToken(accessToken)
        .setDeveloperKey(config.googlePickerApiKey)
        .setAppId(config.googlePickerAppId)
        .setOrigin(location.origin)
        .setLocale(locale)
        .setCallback((value) => {
          if (value.action === provider.Action.PICKED && value.docs?.[0]) {
            picker.dispose();
            void onSelected(value.docs[0].id)
              .catch((error) => toast.error(t(errorKey(error))))
              .finally(() => setPending(false));
          } else if (value.action === provider.Action.CANCEL) {
            picker.dispose();
            setPending(false);
          }
        })
        .build();
      pickerRef.current = picker;
      picker.setVisible(true);
    } catch (error) {
      toast.error(t(errorKey(error)));
      setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={
          !ready ||
          pending ||
          !config?.googlePickerApiKey ||
          !config.googlePickerAppId ||
          !config.googleWorkspaceClientId
        }
        onClick={() => void choose()}
      >
        {t(pending ? "loading" : "chooseDriveFile")}
      </Button>
      {config && (!config.googlePickerApiKey || !config.googlePickerAppId || !config.googleWorkspaceClientId) && (
        <p className="text-xs text-muted-foreground">{t("pickerNotConfigured")}</p>
      )}
    </div>
  );
}
