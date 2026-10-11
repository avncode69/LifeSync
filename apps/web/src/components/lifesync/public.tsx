"use client";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Heart,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthForm } from "./auth-form";
import { AppearanceControls, useLocale } from "./providers";

const modules = [
  { key: "tasks", icon: CheckCheck },
  { key: "calendar", icon: CalendarDays },
  { key: "habits", icon: Sprout },
  { key: "finance", icon: CircleDollarSign },
  { key: "health", icon: Heart },
  { key: "ai", icon: Sparkles },
];
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="/"
      aria-label="LifeSync"
      className="lifesync-brand flex items-center gap-2.5 text-lg font-semibold tracking-tight"
    >
      <img
        src="/icons/lifesync-logo.png"
        alt=""
        width={44}
        height={44}
        className="size-11 shrink-0 rounded-xl object-contain"
      />
      <span className={compact ? "hidden sm:inline" : ""}>LifeSync</span>
    </a>
  );
}
export function PublicHeader() {
  const { t } = useLocale();
  return (
    <header className="mx-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center justify-between gap-4 px-5 py-5">
      <Logo />
      <nav className="hidden items-center gap-7 text-sm md:flex">
        <a href="/#features">{t("features")}</a>
        <a href="/#integrations">{t("integrations")}</a>
        <a href="/pricing">{t("pricing")}</a>
      </nav>
      <div className="flex items-center gap-2">
        <AppearanceControls />
        <Button variant="ghost" asChild>
          <a href="/login">{t("login")}</a>
        </Button>
        <Button asChild className="hidden min-h-11 sm:inline-flex">
          <a href="/register">{t("register")}</a>
        </Button>
      </div>
    </header>
  );
}
export function PublicFooter() {
  const { t } = useLocale();
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-7xl shrink-0 flex-wrap items-center justify-between gap-6 border-t px-5 py-10 text-sm text-muted-foreground">
      <Logo />
      <div className="flex flex-wrap gap-5">
        {["terms", "privacy", "security"].map((key) => (
          <a key={key} href={`/${key}`}>
            {t(key)}
          </a>
        ))}
        {support && <a href={`mailto:${support}`}>{t("contact")}</a>}
      </div>
      <p>© {new Date().getFullYear()} LifeSync</p>
    </footer>
  );
}
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      {children}
      <PublicFooter />
    </div>
  );
}
export function Landing() {
  const { t } = useLocale();
  return (
    <PublicPage>
      <main className="flex-1">
        <section className="bg-gradient-to-b from-muted/65 via-background to-background px-5 py-12 md:py-16">
          <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1fr_1.08fr] lg:gap-20">
            <div className="pt-5 lg:pt-8">
              <p className="mb-5 text-sm font-medium text-muted-foreground">{t("heroTag")}</p>
              <h1 className="max-w-xl text-5xl font-medium leading-[1.1] tracking-[-0.045em] sm:text-6xl">
                {t("hero")}
              </h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground">{t("heroDescription")}</p>
              <div className="mt-12">
                <h2 className="text-sm font-medium text-muted-foreground">{t("features")}</h2>
                <ul className="mt-5 space-y-5">
                  {modules
                    .filter(({ key }) => key !== "ai")
                    .map(({ key, icon: Icon }) => (
                      <li key={key} className="flex items-center gap-4 text-sm">
                        <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
                        <span>{t(key)}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <a
                href="/security"
                className="mt-12 inline-flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <ShieldCheck aria-hidden="true" className="size-5" />
                {t("security")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            </div>
            <section
              aria-label={t("register")}
              className="rounded-3xl border bg-card p-6 shadow-sm dark:bg-black sm:p-8"
            >
              <AuthForm mode="register" embedded />
            </section>
          </div>
        </section>
        <section id="features" className="mx-auto max-w-7xl px-5 py-20">
          <p className="text-sm font-medium text-primary">LifeSync</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">{t("publicModules")}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {modules.map(({ key, icon: Icon }) => (
              <article key={key} className="surface">
                <Icon className="mb-8 size-6 text-primary" />
                <h3 className="text-xl font-semibold">{t(key)}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{t("moduleDescription")}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="integrations" className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-2">
          <article className="surface p-8">
            <CalendarDays className="mb-6 size-8 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight">{t("integrations")}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t("integrationHelp")}</p>
          </article>
          <article className="surface p-8">
            <ShieldCheck className="mb-6 size-8 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight">{t("privacy")}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t("privacyDescription")}</p>
            <a href="/security" className="mt-5 inline-flex text-primary">
              {t("security")} →
            </a>
          </article>
        </section>
        <PricingContent />
        <section className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="text-3xl font-semibold tracking-tight">{t("faq")}</h2>
          <details className="mt-7 rounded-2xl border p-5">
            <summary className="cursor-pointer font-medium">{t("faqQuestion")}</summary>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t("faqAnswer")}</p>
          </details>
        </section>
      </main>
    </PublicPage>
  );
}
export function PricingContent() {
  const { t } = useLocale();
  const sharedFeatures = [
    { key: "pricingPlanning", icon: CheckCheck },
    { key: "pricingWellbeing", icon: Heart },
    { key: "pricingFinance", icon: CircleDollarSign },
    { key: "pricingPrivacy", icon: ShieldCheck },
  ];
  return (
    <section className="mx-auto max-w-5xl px-5 py-20 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("pricing")}</h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{t("pricingDescription")}</p>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2 md:gap-6">
        {["free", "pro"].map((plan) => (
          <article
            key={plan}
            className={`flex h-full flex-col rounded-3xl border p-7 sm:p-9 ${
              plan === "pro"
                ? "border-primary/35 bg-gradient-to-b from-primary/10 via-card to-card shadow-xl shadow-primary/5"
                : "border-border bg-card shadow-sm"
            }`}
          >
            <div className="flex min-h-8 items-center justify-between gap-3">
              <h3 className="text-2xl font-semibold tracking-tight">{t(plan)}</h3>
              {plan === "pro" && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {t("pricingExpanded")}
                </span>
              )}
            </div>
            <div className="mt-6 min-h-32">
              <p className="text-xl font-medium tracking-tight">{t(`${plan}Headline`)}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(`${plan}Description`)}</p>
            </div>
            <div className="mt-5 flex min-h-28 flex-col justify-start">
              <p
                className={
                  plan === "free" ? "text-5xl font-semibold tracking-tight" : "text-3xl font-semibold tracking-tight"
                }
              >
                {plan === "free" ? "$0" : t("proAccessPrice")}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{t(`${plan}PriceNote`)}</p>
            </div>
            <div className="mt-2">
              {plan === "free" ? (
                <Button variant="outline" asChild className="min-h-12 w-full rounded-xl text-sm">
                  <a href="/register">
                    {t("register")}
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </a>
                </Button>
              ) : (
                <Button disabled className="min-h-12 w-full rounded-xl text-sm" aria-describedby="pricing-pro-status">
                  <LockKeyhole aria-hidden="true" className="mr-2 size-4" />
                  {t("pricingCheckoutUnavailable")}
                </Button>
              )}
            </div>
            <div className="mt-8 flex-1 border-t border-border/70 pt-7">
              <p className="mb-5 text-sm font-medium">{t("pricingIncluded")}</p>
              <ul className="space-y-5">
                {[
                  { key: `${plan}Collections`, icon: Layers3 },
                  { key: `${plan}AiAllowance`, icon: Sparkles },
                  ...sharedFeatures,
                ].map(({ key, icon: Icon }) => (
                  <li key={key} className="flex items-start gap-3 text-sm leading-6">
                    <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p
              id={plan === "pro" ? "pricing-pro-status" : undefined}
              className="mt-8 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground"
            >
              {t(plan === "free" ? "freeAccessNote" : "checkoutDisabled")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
export { Legal } from "./legal";
