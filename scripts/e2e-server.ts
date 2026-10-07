import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createApp } from "../apps/api/src/app";
import { createAuth } from "../packages/auth/src/index";
import { readConfig } from "../packages/config/src/index";
import { createDatabase } from "../packages/db/src/index";

// This harness is not bundled into either deployed Worker. Bind loopback only.
const postgres = await PGlite.create();
for (const file of (await readdir("packages/db/migrations")).filter((file) => file.endsWith(".sql")).sort()) {
  await postgres.exec(await readFile(resolve("packages/db/migrations", file), "utf8"));
}
const socket = new PGLiteSocketServer({ db: postgres, port: 5434, host: "127.0.0.1" });
await socket.start();
const config = readConfig({
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5434/postgres",
  BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  EMAIL_PROVIDER: "development",
});
const db = createDatabase(config.DATABASE_URL);
// Embedded PostgreSQL supports one real engine connection; native PG concurrency is tested separately.
db.$client.options.max = 1;
const mailbox: { to: string; subject: string; text: string }[] = [];
const app = createApp({
  db,
  auth: createAuth(db, config, {
    send: async (to, subject, text) => {
      mailbox.push({ to, subject, text });
    },
  }),
  config,
});
const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/__test/mailbox") && req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(mailbox));
      return;
    }
    // Each viewport is a separate burst, not 84 navigations by a real user in one minute.
    // This loopback-only test control never exists in the production application.
    if (req.url === "/__test/reset-layout-rate-window" && req.method === "POST") {
      await db.$client.query("DELETE FROM rate_limit WHERE key LIKE 'api:%:general'");
      res.statusCode = 204;
      res.end();
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    headers.set("CF-Connecting-IP", req.socket.remoteAddress ?? "127.0.0.1");
    const init: RequestInit & { duplex?: "half" } = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req) as ReadableStream;
      init.duplex = "half";
    }
    const response = await app.fetch(new Request(`http://localhost:3000${req.url}`, init));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    if (response.body) Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    else res.end();
  } catch {
    res.statusCode = 500;
    res.end("Test harness request failed");
  }
});
server.listen(8787, "127.0.0.1", () => console.info("LifeSync isolated E2E API ready"));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => {
      void db.$client
        .end()
        .then(() => socket.stop())
        .then(() => postgres.close())
        .then(() => process.exit(0));
    });
  });
