import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { createAuth } from "@lifesync/auth";
import { readConfig } from "@lifesync/config";
import { createDatabase } from "@lifesync/db";
import { config as loadEnv } from "dotenv";
import { createApp } from "./app";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const config = readConfig(process.env);
const db = createDatabase(config.DATABASE_URL);
const app = createApp({ db, auth: createAuth(db, config), config });
const port = Number(process.env.PORT ?? 8787);
const server = createServer(async (req, res) => {
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers))
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    const init: RequestInit & { duplex?: "half" } = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = Readable.toWeb(req) as ReadableStream;
      init.duplex = "half";
    }
    const response = await app.fetch(new Request(`http://127.0.0.1:${port}${req.url}`, init));
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key !== "set-cookie") res.setHeader(key, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
    if (response.body) Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    else res.end();
  } catch {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Unable to process request", requestId: crypto.randomUUID() },
      }),
    );
  }
});
server.listen(port, "127.0.0.1", () => console.log(`LifeSync API listening on http://127.0.0.1:${port}`));
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () =>
    server.close(() => {
      void db.$client.end().then(() => process.exit(0));
    }),
  );
