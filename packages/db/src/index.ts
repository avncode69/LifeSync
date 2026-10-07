import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export function createDatabase(connectionString: string) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
  return drizzle(pool, { schema });
}
export type Database = ReturnType<typeof createDatabase>;
