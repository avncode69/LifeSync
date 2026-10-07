import { readConfig } from "@lifesync/config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailProvider } from "./email";

const smtp = vi.hoisted(() => ({ createTransport: vi.fn(), sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: smtp.createTransport } }));
const environment = {
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  DATABASE_URL: "postgresql://localhost/lifesync_test",
  EMAIL_PROVIDER: "smtp",
  EMAIL_FROM: "LifeSync <lifesync.example@gmail.com>",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "lifesync.example@gmail.com",
  SMTP_PASSWORD: "test-only-app-password",
};
beforeEach(() => {
  vi.clearAllMocks();
  smtp.createTransport.mockReturnValue({ sendMail: smtp.sendMail });
  smtp.sendMail.mockResolvedValue({ accepted: ["recipient@example.test"], rejected: [] });
});
describe("SMTP email delivery", () => {
  it("sends only the configured sender and auth message through authenticated TLS transport", async () => {
    const mail = createEmailProvider(readConfig(environment));
    await mail.send("recipient@example.test", "Verify LifeSync", "Verification link");
    expect(smtp.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "lifesync.example@gmail.com", pass: "test-only-app-password" },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true,
        logger: false,
        debug: false,
      }),
    );
    expect(smtp.sendMail).toHaveBeenCalledWith({
      from: environment.EMAIL_FROM,
      to: "recipient@example.test",
      subject: "Verify LifeSync",
      text: "Verification link",
    });
  });
  it("requires STARTTLS when implicit TLS is disabled", async () => {
    const mail = createEmailProvider(readConfig({ ...environment, SMTP_PORT: "587", SMTP_SECURE: "false" }));
    await mail.send("recipient@example.test", "Reset", "Reset link");
    expect(smtp.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  });
  it("returns a safe failure without exposing provider errors, passwords or verification links", async () => {
    smtp.sendMail.mockRejectedValue(new Error("provider-details test-only-app-password secret-link"));
    await expect(
      createEmailProvider(readConfig(environment)).send("recipient@example.test", "Reset", "secret-link"),
    ).rejects.toThrow(/^Email delivery failed$/);
    expect(smtp.sendMail).toHaveBeenCalledTimes(1);
  });
  it("rejects SMTP responses that did not accept the recipient", async () => {
    smtp.sendMail.mockResolvedValue({ accepted: [], rejected: ["recipient@example.test"] });
    await expect(
      createEmailProvider(readConfig(environment)).send("recipient@example.test", "Reset", "Reset link"),
    ).rejects.toThrow(/^Email delivery failed$/);
  });
});
