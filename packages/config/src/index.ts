import { z } from "zod";

const optionalSecret = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
export const environmentSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    APP_URL: z.url(),
    API_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    GOOGLE_WORKSPACE_CLIENT_ID: optionalSecret,
    GOOGLE_WORKSPACE_CLIENT_SECRET: optionalSecret,
    GOOGLE_PICKER_API_KEY: optionalSecret,
    GOOGLE_PICKER_APP_ID: optionalSecret,
    GOOGLE_TOKEN_ENCRYPTION_KEY: optionalSecret,
    GOOGLE_TOKEN_PREVIOUS_ENCRYPTION_KEY: optionalSecret,
    EMAIL_PROVIDER: z.enum(["resend", "smtp", "mailpit", "development"]).default("mailpit"),
    EMAIL_FROM: z.string().min(3).default("LifeSync <noreply@example.com>"),
    RESEND_API_KEY: optionalSecret,
    SMTP_HOST: optionalSecret,
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
    SMTP_SECURE: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).default(true),
    SMTP_USER: optionalSecret,
    SMTP_PASSWORD: optionalSecret,
    MAILPIT_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
    TURNSTILE_SECRET_KEY: optionalSecret,
    TURNSTILE_SITE_KEY: optionalSecret,
    VAPID_PUBLIC_KEY: optionalSecret,
    VAPID_PRIVATE_KEY: optionalSecret,
    VAPID_SUBJECT: z.string().default("mailto:security@example.com"),
    AI_PROVIDER: z.enum(["gemini"]).default("gemini"),
    SUPPORT_EMAIL: z.string().default("support@example.com"),
    GEMINI_API_KEY: optionalSecret,
    GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
    PRO_AI_DAILY_LIMIT: z.coerce.number().int().positive().max(10000).default(100),
  })
  .superRefine((value, ctx) => {
    if (value.APP_ENV === "production" || value.APP_ENV === "staging") {
      for (const name of ["APP_URL", "BETTER_AUTH_URL"] as const) {
        if (new URL(value[name]).protocol !== "https:")
          ctx.addIssue({ code: "custom", path: [name], message: "HTTPS is required" });
      }
      if (!["resend", "smtp"].includes(value.EMAIL_PROVIDER))
        ctx.addIssue({ code: "custom", path: ["EMAIL_PROVIDER"], message: "Production email provider required" });
      if (!value.TURNSTILE_SECRET_KEY)
        ctx.addIssue({
          code: "custom",
          path: ["TURNSTILE_SECRET_KEY"],
          message: "Production anti-bot protection required",
        });
    }
    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY)
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "Resend API key required" });
    if (value.EMAIL_PROVIDER === "smtp") {
      for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const) {
        if (!value[name]?.trim())
          ctx.addIssue({ code: "custom", path: [name], message: "Authenticated SMTP configuration required" });
      }
      const sender = value.EMAIL_FROM.match(/^(?:([^<>\s@]+@[^<>\s@]+)|[^<>\r\n]*<([^<>\s@]+@[^<>\s@]+)>)$/);
      const from = sender?.[1] ?? sender?.[2];
      if (!from || !z.email().safeParse(from).success)
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Valid SMTP sender required" });
      if (value.SMTP_HOST?.toLowerCase() === "smtp.gmail.com" && from?.toLowerCase() !== value.SMTP_USER?.toLowerCase())
        ctx.addIssue({ code: "custom", path: ["EMAIL_FROM"], message: "Gmail sender must match SMTP_USER" });
      if (value.SMTP_PORT === 465 && !value.SMTP_SECURE)
        ctx.addIssue({ code: "custom", path: ["SMTP_SECURE"], message: "Port 465 requires implicit TLS" });
      if (value.SMTP_PORT === 587 && value.SMTP_SECURE)
        ctx.addIssue({ code: "custom", path: ["SMTP_SECURE"], message: "Port 587 requires STARTTLS, set false" });
    }
    if (new URL(value.BETTER_AUTH_URL).origin !== new URL(value.APP_URL).origin)
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_URL"], message: "Auth must use the application origin" });
    if (!!value.GOOGLE_WORKSPACE_CLIENT_ID !== !!value.GOOGLE_WORKSPACE_CLIENT_SECRET)
      ctx.addIssue({ code: "custom", message: "Both Workspace OAuth credentials are required" });
    if (value.GOOGLE_WORKSPACE_CLIENT_ID && !value.GOOGLE_TOKEN_ENCRYPTION_KEY)
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_TOKEN_ENCRYPTION_KEY"],
        message: "Workspace encryption key required",
      });
    if (!!value.GOOGLE_CLIENT_ID !== !!value.GOOGLE_CLIENT_SECRET)
      ctx.addIssue({ code: "custom", message: "Both Google identity credentials are required" });
  });
export type AppConfig = z.infer<typeof environmentSchema>;
export function readConfig(environment: Record<string, unknown>): AppConfig {
  return environmentSchema.parse(environment);
}
export const entitlementPolicy = { FREE: { inboxBoxes: 2, aiDaily: 3 }, PRO: { inboxBoxes: 5 } } as const;

export function effectiveEntitlement(
  row:
    | {
        plan: string;
        expiresAt?: Date | null;
        deletedAt?: Date | null;
        aiDailyLimit?: number | null;
        inboxBoxLimit?: number;
      }
    | undefined,
  proAiLimit: number,
  now = new Date(),
) {
  const pro = row?.plan === "PRO" && !row.deletedAt && (!row.expiresAt || row.expiresAt > now);
  return {
    plan: pro ? "PRO" : "FREE",
    aiDailyLimit: pro ? (row.aiDailyLimit ?? proAiLimit) : entitlementPolicy.FREE.aiDaily,
    inboxLimit: pro
      ? Math.min(row.inboxBoxLimit ?? entitlementPolicy.PRO.inboxBoxes, entitlementPolicy.PRO.inboxBoxes)
      : entitlementPolicy.FREE.inboxBoxes,
  };
}
