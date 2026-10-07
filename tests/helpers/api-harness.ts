import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createApp } from "../../apps/api/src/app";
import { createAuth } from "../../packages/auth/src/index";
import { readConfig } from "../../packages/config/src/index";
import { createDatabase } from "../../packages/db/src/index";
import type { AIProvider } from "../../packages/integrations/src/index";

export async function createApiHarness(aiProvider?: AIProvider) {
  const nativeUrl = process.env.TEST_DATABASE_URL;
  const databaseName = `lifesync_test_${randomUUID().replaceAll("-", "")}`;
  const admin = nativeUrl ? createDatabase(nativeUrl) : undefined;
  const engine = nativeUrl ? undefined : await PGlite.create();
  let connectionString: string;
  if (admin && nativeUrl) {
    // A fresh database preserves the migrations' public-qualified foreign keys.
    // The name is generated internally; no caller-provided SQL identifier is used.
    await admin.$client.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(nativeUrl);
    url.pathname = `/${databaseName}`;
    connectionString = url.toString();
  } else {
    connectionString = "";
  }
  const folder = new URL("../../packages/db/migrations/", import.meta.url);
  if (engine)
    for (const name of (await readdir(folder)).filter((v) => v.endsWith(".sql")).sort())
      await engine.exec(await readFile(new URL(name, folder), "utf8"));
  const socket = engine
    ? new PGLiteSocketServer({ db: engine, port: 0, host: "127.0.0.1", maxConnections: 5 })
    : undefined;
  if (socket) {
    await socket.start();
    connectionString = `postgresql://postgres@${socket.getServerConn()}/postgres?sslmode=disable`;
  }
  const db = createDatabase(connectionString);
  if (nativeUrl)
    for (const name of (await readdir(folder)).filter((v) => v.endsWith(".sql")).sort())
      await db.$client.query(await readFile(new URL(name, folder), "utf8"));
  // PGlite has one PostgreSQL backend session. Multiplexing unnamed prepared
  // statement portals across pg clients is unsupported; API callers remain concurrent.
  if (engine) db.$client.options.max = 1;
  const base = "http://lifesync.test";
  const config = readConfig({
    APP_ENV: "test",
    APP_URL: base,
    BETTER_AUTH_URL: base,
    DATABASE_URL: connectionString,
    BETTER_AUTH_SECRET: "test-only-secret-with-more-than-32-characters",
    EMAIL_PROVIDER: "mailpit",
  });
  const mail: Array<{ to: string; subject: string; text: string }> = [];
  const auth = createAuth(db, config, {
    async send(to, subject, text) {
      mail.push({ to, subject, text });
    },
  });
  const app = createApp({ db, auth, config, aiProvider });
  const errors: Error[] = [];
  const handleError = Reflect.get(app, "errorHandler") as Parameters<typeof app.onError>[0];
  app.onError((error, context) => {
    errors.push(error);
    return handleError(error, context);
  });
  let actorNumber = 0;
  function actor() {
    const clientIp = `192.0.2.${++actorNumber}`;
    const cookies = new Map<string, string>();
    return {
      async request(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
        const response = await app.request(
          new Request(`${base}${path}`, {
            method,
            headers: {
              Origin: base,
              "X-Forwarded-For": clientIp,
              "CF-Connecting-IP": clientIp,
              ...(body === undefined ? {} : { "Content-Type": "application/json" }),
              Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
              ...headers,
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          }),
        );
        for (const cookie of response.headers.getSetCookie()) {
          const first = cookie.split(";")[0] ?? "";
          const index = first.indexOf("=");
          if (index > 0) {
            const name = first.slice(0, index);
            const value = first.slice(index + 1);
            if (value) cookies.set(name, value);
            else cookies.delete(name);
          }
        }
        return response;
      },
      async register(email: string, password = "Test-password-with-24chars") {
        return this.request("/api/auth/sign-up/email", "POST", {
          name: email.split("@")[0],
          email,
          password,
          termsAccepted: true,
        });
      },
      async login(email: string, password = "Test-password-with-24chars") {
        return this.request("/api/auth/sign-in/email", "POST", { email, password });
      },
      async verify(email: string) {
        const message = [...mail].reverse().find((v) => v.to === email && v.subject.includes("Verify"));
        if (!message) throw new Error("No captured verification message");
        const url = message.text.match(/https?:\/\/\S+/)?.[0];
        if (!url) throw new Error("Verification URL missing");
        const parsed = new URL(url);
        return this.request(`${parsed.pathname}${parsed.search}`);
      },
    };
  }
  return {
    db,
    config,
    auth,
    app,
    mail,
    errors,
    actor,
    async close() {
      await db.$client.end();
      await socket?.stop();
      await engine?.close();
      if (admin) {
        await admin.$client.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
        await admin.$client.end();
      }
    },
  };
}
export type ApiHarness = Awaited<ReturnType<typeof createApiHarness>>;
export type TestActor = ReturnType<ApiHarness["actor"]>;
