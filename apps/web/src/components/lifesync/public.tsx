"use client";
import {
  ArrowRight,
  CalendarDays,
  CheckCheck,
  CircleDollarSign,
  Heart,
  ShieldCheck,
  Sparkles,
  Sprout,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <span className="lifesync-brand-mark flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white">
        LS
      </span>
      <span className={compact ? "hidden sm:inline" : ""}>LifeSync</span>
    </a>
  );
}
export function PublicHeader() {
  const { t } = useLocale();
  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
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
    <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 border-t px-5 py-10 text-sm text-muted-foreground">
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
export function Landing() {
  const { t } = useLocale();
  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary">
              <Sparkles className="size-4" />
              {t("heroTag")}
            </p>
            <h1 className="max-w-xl text-6xl font-bold leading-[1.05] tracking-[-0.065em] sm:text-7xl">{t("hero")}</h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">{t("heroDescription")}</p>
            <Button asChild className="mt-8 min-h-12 gap-4 px-6">
              <a href="/register">
                {t("register")}
                <ArrowRight />
              </a>
            </Button>
          </div>
          <div className="overflow-hidden rounded-3xl border shadow-xl shadow-primary/5">
            <img
              src="/dashboard-preview.jpg"
              alt={t("dashboardPreview")}
              width={1280}
              height={720}
              className="h-auto w-full"
            />
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
      <PublicFooter />
    </>
  );
}
export function PricingContent() {
  const { t } = useLocale();
  return (
    <section className="mx-auto max-w-5xl px-5 py-16">
      <h2 className="text-center text-4xl font-bold tracking-tight">{t("pricing")}</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {["free", "pro"].map((plan) => (
          <article key={plan} className={`surface p-8 ${plan === "pro" ? "border-primary" : ""}`}>
            <h3 className="text-2xl font-bold">{t(plan)}</h3>
            <p className="mt-5 leading-relaxed text-muted-foreground">{t(`${plan}Details`)}</p>
            {plan === "free" ? (
              <Button asChild className="mt-7 min-h-11">
                <a href="/register">{t("register")}</a>
              </Button>
            ) : (
              <p className="mt-7 rounded-xl bg-muted p-4 text-sm">{t("checkoutDisabled")}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
export function Legal({ type }: { type: "privacy" | "terms" | "security" }) {
  const { t } = useLocale();
  return (
    <>
      <PublicHeader />
      <main className="mx-auto min-h-[65vh] max-w-3xl px-5 py-16">
        <h1 className="page-heading">{t(type)}</h1>
        <p className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{t("legalReview")}</p>
        <p className="mt-8 whitespace-pre-wrap text-lg leading-loose text-muted-foreground">{t(`${type}Text`)}</p>
      </main>
      <PublicFooter />
    </>
  );
}
