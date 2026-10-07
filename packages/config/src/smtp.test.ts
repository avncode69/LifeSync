import { describe, expect, it } from "vitest";
import { readConfig } from "./index";

const smtpEnvironment = {
  APP_ENV: "production",
  APP_URL: "https://lifesync.example.test",
  BETTER_AUTH_URL: "https://lifesync.example.test",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  DATABASE_URL: "postgresql://localhost/lifesync_test",
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "LifeSync <lifesync.example@gmail.com>",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "lifesync.example@gmail.com",
  SMTP_PASSWORD: "test-only-app-password",
  TURNSTILE_SECRET_KEY: "test-only-turnstile-key",
};

describe("authenticated SMTP configuration", () => {
  it.each(["production", "staging"])("accepts SMTP without a Resend key in %s", (APP_ENV) => {
    const config = readConfig({ ...smtpEnvironment, APP_ENV });
    expect(config.SMTP_PORT).toBe(465);
    expect(config.SMTP_SECURE).toBe(true);
    expect(config.RESEND_API_KEY).toBeUndefined();
  });
  it("parses false as false for STARTTLS instead of coercing the nonempty string to true", () => {
    expect(readConfig({ ...smtpEnvironment, SMTP_PORT: "587", SMTP_SECURE: "false" }).SMTP_SECURE).toBe(false);
  });
  it.each(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "TURNSTILE_SECRET_KEY"])("rejects missing %s", (name) => {
    expect(() => readConfig({ ...smtpEnvironment, [name]: "" })).toThrow();
  });
  it("rejects Gmail sender impersonation and inconsistent implicit TLS", () => {
    expect(() => readConfig({ ...smtpEnvironment, EMAIL_FROM: "LifeSync <someone-else@gmail.com>" })).toThrow();
    expect(() => readConfig({ ...smtpEnvironment, SMTP_SECURE: "false" })).toThrow();
  });
  it("rejects incomplete sender brackets and header injection", () => {
    expect(() => readConfig({ ...smtpEnvironment, EMAIL_FROM: "LifeSync <lifesync.example@gmail.com" })).toThrow();
    expect(() =>
      readConfig({ ...smtpEnvironment, EMAIL_FROM: "LifeSync\r\nInjected <lifesync.example@gmail.com>" }),
    ).toThrow();
  });
  it("still rejects local email providers on production", () => {
    expect(() => readConfig({ ...smtpEnvironment, EMAIL_PROVIDER: "development" })).toThrow();
  });
});
