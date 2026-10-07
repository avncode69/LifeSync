import { mkdir, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

// Local PostgreSQL engine only; production uses PostgreSQL over pg/Hyperdrive.
const dataDirectory = resolve(".local/postgres");
await mkdir(dataDirectory, { recursive: true });
const database = await PGlite.create(dataDirectory);
await database.exec(
  "CREATE TABLE IF NOT EXISTS lifesync_local_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
);
const migrationsDirectory = resolve("packages/db/migrations");
const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();
for (const file of migrationFiles) {
  const applied = await database.query("SELECT name FROM lifesync_local_migrations WHERE name=$1", [file]);
  if (applied.rows.length) continue;
  await database.transaction(async (transaction) => {
    await transaction.exec(await readFile(resolve(migrationsDirectory, file), "utf8"));
    await transaction.query("INSERT INTO lifesync_local_migrations(name) VALUES ($1)", [file]);
  });
  console.info(`Applied local migration: ${file}`);
}
const server = new PGLiteSocketServer({ db: database, port: 5433, host: "127.0.0.1" });
await server.start();
console.info("Local PostgreSQL development engine listening on 127.0.0.1:5433. No production data seeded.");
const shutdown = async () => {
  await server.stop();
  await database.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
