"use client";
import { type Locale, translate } from "@lifesync/i18n";
import { ThemeProvider, useTheme } from "next-themes";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";

const LocaleContext = createContext({
  locale: "uk" as Locale,
  setLocale: (_value: Locale) => {},
  t: (key: string) => key,
});
export function useLocale() {
  return useContext(LocaleContext);
}
export function Providers({ children }: { children: ReactNode }) {
  const [locale, setValue] = useState<Locale>("uk");
  useEffect(() => {
    const saved = localStorage.getItem("lifesync.locale");
    setValue(saved === "en" ? "en" : navigator.language.startsWith("uk") ? "uk" : saved === "uk" ? "uk" : "en");
  }, []);
  const setLocale = useCallback((value: Locale) => {
    setValue(value);
    localStorage.setItem("lifesync.locale", value);
    document.documentElement.lang = value;
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: (key) => translate(locale, key) }}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster richColors position="top-center" />
      </ThemeProvider>
    </LocaleContext.Provider>
  );
}
export function AppearanceControls() {
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        aria-label={t("locale")}
        onClick={() => {
          sessionStorage.setItem("lifesync.locale-choice", "1");
          setLocale(locale === "uk" ? "en" : "uk");
        }}
      >
        {locale.toUpperCase()}
      </Button>
      <select
        className="control w-auto text-xs"
        aria-label={t("theme")}
        value={theme ?? "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        {["light", "dark", "system"].map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
    </div>
  );
}
