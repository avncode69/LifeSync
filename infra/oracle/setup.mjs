import { createECDH, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const target = resolve("infra/oracle/.env");
if (existsSync(target))
  throw new Error("infra/oracle/.env already exists. Edit it with sudo nano; setup never overwrites existing keys.");
let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
async function ask(label, validate, secret = false) {
  for (;;) {
    process.stdout.write(`${label}: `);
    muted = secret;
    const value = (await rl.question("")).trim();
    muted = false;
    if (secret) process.stdout.write("\n");
    if (validate(value)) return value;
    console.log("Invalid value. Try again.");
  }
}
try {
  const host = await ask("Domain, e.g. lifesync-name.duckdns.org (no https://)", (v) =>
    /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(v),
  );
  const email = await ask("Gmail sender address", (v) => /^[a-zA-Z0-9._+-]+@gmail\.com$/.test(v));
  const smtp = await ask(
    "Gmail 16-letter APP password (not account password)",
    (v) => /^[a-zA-Z]{16}$/.test(v.replace(/\s/g, "")),
    true,
  );
  const site = await ask("Turnstile SITE key", (v) => /^[a-zA-Z0-9_-]{10,200}$/.test(v));
  const secret = await ask("Turnstile SECRET key", (v) => /^[a-zA-Z0-9_-]{10,200}$/.test(v), true);
  const vapid = createECDH("prime256v1");
  vapid.generateKeys();
  const values = {
    APP_ENV: "production",
    APP_HOST: host,
    APP_URL: `https://${host}`,
    BETTER_AUTH_URL: `https://${host}`,
    API_URL: "http://api:8787",
    POSTGRES_PASSWORD: randomBytes(32).toString("hex"),
    BETTER_AUTH_SECRET: randomBytes(48).toString("base64"),
    GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    BACKUP_PASSPHRASE: randomBytes(32).toString("hex"),
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: `LifeSync <${email}>`,
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: email,
    SMTP_PASSWORD: smtp.replace(/\s/g, ""),
    SUPPORT_EMAIL: email,
    TURNSTILE_SITE_KEY: site,
    TURNSTILE_SECRET_KEY: secret,
    VAPID_PUBLIC_KEY: vapid.getPublicKey().toString("base64url"),
    VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString("base64url"),
    VAPID_SUBJECT: `mailto:${email}`,
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    GOOGLE_WORKSPACE_CLIENT_ID: "",
    GOOGLE_WORKSPACE_CLIENT_SECRET: "",
    GOOGLE_PICKER_API_KEY: "",
    GOOGLE_PICKER_APP_ID: "",
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "gemini-2.5-flash",
  };
  writeFileSync(
    target,
    `${Object.entries(values)
      .map(([key, value]) => `${key}='${value}'`)
      .join("\n")}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Created infra/oracle/.env with private mode 600. Keys were not printed. Keep BACKUP_PASSPHRASE and encrypted backups outside this VM.",
  );
} finally {
  rl.close();
}
