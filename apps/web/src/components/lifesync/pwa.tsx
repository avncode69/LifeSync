"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "./providers";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function PwaControls() {
  const { t } = useLocale();
  const [install, setInstall] = useState<InstallEvent>();
  const [update, setUpdate] = useState<ServiceWorker>();
  useEffect(() => {
    const installHandler = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", installHandler);
    let active = true;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration || !active) return;
        if (registration.waiting) setUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (active && worker.state === "installed" && navigator.serviceWorker.controller) setUpdate(worker);
          });
        });
      });
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);
  return (
    <>
      {install && (
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() =>
            void install
              .prompt()
              .then(() => install.userChoice)
              .then(() => setInstall(undefined))
          }
        >
          {t("install")}
        </Button>
      )}
      {update && (
        <Button
          variant="outline"
          className="min-h-11"
          title={t("updateAvailable")}
          onClick={() => {
            navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
            update.postMessage("SKIP_WAITING");
          }}
        >
          {t("refresh")}
        </Button>
      )}
    </>
  );
}
