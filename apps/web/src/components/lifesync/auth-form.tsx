"use client";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { auth, errorKey } from "@/lib/api";
import { AppearanceControls, useLocale } from "./providers";
import { Logo } from "./public";
import { TurnstileField, usePublicConfig } from "./turnstile";

type Mode = "login" | "register" | "forgot" | "reset" | "verify";
export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useLocale();
  const config = usePublicConfig();
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const shape =
      mode === "reset"
        ? z.object({ password: z.string().min(12).max(128) })
        : mode === "register"
          ? z.object({
              name: z.string().trim().min(1).max(240),
              email: z.email(),
              password: z.string().min(12).max(128),
              acceptance: z.literal("on"),
            })
          : mode === "login"
            ? z.object({ email: z.email(), password: z.string().min(1).max(128) })
            : z.object({ email: z.email() });
    const checked = shape.safeParse(values);
    if (!checked.success) {
      setErrors(Object.fromEntries(checked.error.issues.map((issue) => [String(issue.path[0]), t("invalid")])));
      return;
    }
    setErrors({});
    setPending(true);
    setMessage("");
    try {
      const callbackURL = `${location.origin}/onboarding`;
      if (mode === "login") {
        await auth("/sign-in/email", { email: values.email, password: values.password, callbackURL });
        location.assign("/dashboard");
      } else if (mode === "register") {
        await auth(
          "/sign-up/email",
          { name: values.name, email: values.email, password: values.password, termsAccepted: true, callbackURL },
          token ? { "X-Turnstile-Token": token } : undefined,
        );
        setMessage(t("emailSent"));
      } else if (mode === "forgot") {
        await auth(
          "/request-password-reset",
          { email: values.email, redirectTo: `${location.origin}/reset-password` },
          token ? { "X-Turnstile-Token": token } : undefined,
        );
        setMessage(t("emailSent"));
      } else if (mode === "reset") {
        const token = new URLSearchParams(location.search).get("token");
        await auth("/reset-password", { newPassword: values.password, token });
        setMessage(t("saved"));
      } else {
        await auth("/send-verification-email", { email: values.email, callbackURL });
        setMessage(t("emailSent"));
      }
    } catch (error) {
      setMessage(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  async function google() {
    setPending(true);
    try {
      const result = await auth<{ url?: string }>("/sign-in/social", {
        provider: "google",
        callbackURL: `${location.origin}/onboarding`,
        disableRedirect: true,
      });
      if (result.url) location.assign(result.url);
      else setMessage(t("error"));
    } catch (error) {
      setMessage(t(errorKey(error)));
    } finally {
      setPending(false);
    }
  }
  const fields =
    mode === "register"
      ? ["name", "email", "password"]
      : mode === "login"
        ? ["email", "password"]
        : mode === "reset"
          ? ["password"]
          : ["email"];
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-violet-950 p-12 text-white lg:flex">
        <Logo />
        <div>
          <p className="mb-6 text-sm text-violet-300">{t("heroTag")}</p>
          <h1 className="max-w-md text-6xl font-semibold leading-tight tracking-tight">{t("hero")}</h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-violet-200">{t("heroDescription")}</p>
        </div>
        <p className="text-sm text-violet-300">© LifeSync</p>
      </div>
      <div className="flex flex-col p-5 sm:p-10">
        <div className="flex items-center justify-between">
          <div className="lg:invisible">
            <Logo />
          </div>
          <AppearanceControls />
        </div>
        <div className="m-auto w-full max-w-sm py-16">
          <h2 className="text-3xl font-bold tracking-tight">
            {t(mode === "forgot" || mode === "reset" ? "reset" : mode)}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("authSubtitle")}</p>
          {(mode === "login" || mode === "register") && config?.googleIdentityEnabled && (
            <Button variant="outline" className="mt-8 min-h-12 w-full" disabled={pending} onClick={() => void google()}>
              {t("google")}
            </Button>
          )}
          <form className="mt-7 space-y-5" noValidate onSubmit={submit}>
            {fields.map((key) => (
              <div key={key}>
                <label className="mb-2 block text-sm font-medium" htmlFor={key}>
                  {t(key)}
                </label>
                <input
                  id={key}
                  name={key}
                  className="control"
                  type={key === "password" ? "password" : key === "email" ? "email" : "text"}
                  autoComplete={key === "password" ? (mode === "login" ? "current-password" : "new-password") : key}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  disabled={pending}
                />
                {errors[key] && (
                  <p id={`${key}-error`} className="mt-1 text-xs text-destructive">
                    {errors[key]}
                  </p>
                )}
              </div>
            ))}
            {mode === "register" && (
              <label className="flex items-start gap-3 text-sm">
                <input name="acceptance" type="checkbox" className="mt-1 size-4 accent-violet-600" />
                <span>
                  {t("acceptance")} ·{" "}
                  <a className="text-primary underline" href="/terms">
                    {t("terms")}
                  </a>{" "}
                  ·{" "}
                  <a className="text-primary underline" href="/privacy">
                    {t("privacy")}
                  </a>
                  {errors.acceptance && <span className="block text-destructive">{errors.acceptance}</span>}
                </span>
              </label>
            )}
            {config?.turnstileSiteKey && (mode === "register" || mode === "forgot") && (
              <TurnstileField sitekey={config.turnstileSiteKey} onToken={setToken} />
            )}
            {message && (
              <p role="status" className="rounded-xl bg-muted p-3 text-sm">
                {message}
              </p>
            )}
            <Button
              disabled={pending || (!!config?.turnstileSiteKey && (mode === "register" || mode === "forgot") && !token)}
              type="submit"
              className="min-h-12 w-full"
            >
              {t(
                pending
                  ? "loading"
                  : mode === "forgot" || mode === "reset"
                    ? "reset"
                    : mode === "verify"
                      ? "resend"
                      : mode,
              )}
            </Button>
          </form>
          <div className="mt-7 flex flex-wrap justify-between gap-3 text-sm text-primary">
            <a href={mode === "login" ? "/register" : "/login"}>{t(mode === "login" ? "register" : "login")}</a>
            {mode === "login" && (
              <>
                <a href="/forgot-password">{t("forgot")}</a>
                <a href="/verify-email">{t("verify")}</a>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
