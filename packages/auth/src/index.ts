import type { AppConfig } from "@lifesync/config";
import { account, auditLogs, type Database, rateLimit, session, user, verification } from "@lifesync/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createEmailProvider, type EmailProvider } from "./email";

export function createAuth(db: Database, config: AppConfig, testEmailProvider?: EmailProvider) {
  if (testEmailProvider && config.APP_ENV !== "test") throw new Error("Injected mail delivery is restricted to tests");
  const email = testEmailProvider ?? createEmailProvider(config);
  return betterAuth({
    appName: "LifeSync",
    baseURL: config.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(config.APP_URL).origin],
    database: drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification, rateLimit } }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user: recipient }) => {
        await db
          .insert(auditLogs)
          .values({ actorUserId: recipient.id, action: "auth.password_reset", requestId: crypto.randomUUID() });
      },
      sendResetPassword: async ({ user: recipient, url }) =>
        email.send(
          recipient.email,
          "Reset your LifeSync password",
          `Reset your password: ${url}\nIf you did not request this, ignore this email.`,
        ),
    },
    emailVerification: {
      afterEmailVerification: async (recipient) => {
        await db
          .insert(auditLogs)
          .values({ actorUserId: recipient.id, action: "auth.email_verified", requestId: crypto.randomUUID() });
      },
      sendOnSignUp: true,
      sendOnSignIn: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user: recipient, url }) =>
        email.send(recipient.email, "Verify your LifeSync email", `Verify your email: ${url}`),
    },
    socialProviders:
      config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: config.GOOGLE_CLIENT_ID,
              clientSecret: config.GOOGLE_CLIENT_SECRET,
              scope: ["openid", "email", "profile"],
            },
          }
        : {},
    account: { encryptOAuthTokens: true },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    user: {
      deleteUser: { enabled: false },
      additionalFields: { termsAcceptedAt: { type: "date", required: false, input: false } },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (data, context) => ({
            data: {
              ...data,
              termsAcceptedAt:
                context?.path === "/sign-up/email" && context.body?.termsAccepted === true ? new Date() : null,
            },
          }),
        },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 20,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/reset-password": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      useSecureCookies: new URL(config.APP_URL).protocol === "https:",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      database: { generateId: () => crypto.randomUUID() },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
export { createEmailProvider } from "./email";
