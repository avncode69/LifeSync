import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./index";

const db = createDatabase(process.env.DATABASE_URL ?? "");
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
} finally {
  await db.$client.end();
}
