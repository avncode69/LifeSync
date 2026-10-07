import type { AppConfig } from "@lifesync/config";

export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}
export function createEmailProvider(config: AppConfig): EmailProvider {
  return {
    async send(to, subject, text) {
      if (config.EMAIL_PROVIDER === "smtp") {
        try {
          const { default: nodemailer } = await import("nodemailer");
          const transport = nodemailer.createTransport({
            host: config.SMTP_HOST,
            port: config.SMTP_PORT,
            secure: config.SMTP_SECURE,
            requireTLS: !config.SMTP_SECURE,
            auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 15000,
            dnsTimeout: 15000,
            disableFileAccess: true,
            disableUrlAccess: true,
            logger: false,
            debug: false,
          });
          const result = await transport.sendMail({ from: config.EMAIL_FROM, to, subject, text });
          if (!result.accepted?.length || result.rejected?.length) throw new Error("Recipient rejected");
        } catch {
          throw new Error("Email delivery failed");
        }
        return;
      }
      if (config.EMAIL_PROVIDER === "development") {
        if (config.APP_ENV !== "development") throw new Error("Development mail prohibited");
        console.log(JSON.stringify({ devMail: true, to, subject, text }));
        return;
      }
      const dev = config.EMAIL_PROVIDER === "mailpit";
      if (dev && !["development", "test"].includes(config.APP_ENV)) throw new Error("Development email prohibited");
      const endpoint = dev
        ? `${config.MAILPIT_URL ?? "http://127.0.0.1:8025"}/api/v1/send`
        : "https://api.resend.com/emails";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(dev ? {} : { Authorization: `Bearer ${config.RESEND_API_KEY}` }),
        },
        body: JSON.stringify(
          dev
            ? {
                From: { Email: "noreply@lifesync.local", Name: "LifeSync" },
                To: [{ Email: to }],
                Subject: subject,
                Text: text,
              }
            : { from: config.EMAIL_FROM, to: [to], subject, text },
        ),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Email delivery failed");
    },
  };
}
