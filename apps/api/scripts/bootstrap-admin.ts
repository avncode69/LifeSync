import { resolve } from "node:path";
import { auditLogs, createDatabase, user } from "@lifesync/db";
import { config as loadEnv } from "dotenv";
import { and, eq, sql } from "drizzle-orm";

loadEnv({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
if (!email || !process.env.DATABASE_URL)
  throw new Error("ADMIN_BOOTSTRAP_EMAIL and explicit DATABASE_URL are required");
const db = createDatabase(process.env.DATABASE_URL);
try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('lifesync-admin-bootstrap',0))`);
    const [admin] = await tx.select({ id: user.id }).from(user).where(eq(user.role, "admin")).limit(1);
    if (admin) throw new Error("An administrator already exists; use normal administrative role management");
    const [target] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), eq(user.emailVerified, true), eq(user.disabled, false)))
      .limit(1);
    if (!target) throw new Error("Bootstrap requires an existing verified enabled user");
    await tx.update(user).set({ role: "admin", updatedAt: new Date() }).where(eq(user.id, target.id));
    await tx.insert(auditLogs).values({
      actorUserId: target.id,
      action: "admin.bootstrapped",
      targetType: "user",
      targetId: target.id,
      requestId: crypto.randomUUID(),
    });
  });
  console.log("Administrator bootstrap completed");
} finally {
  await db.$client.end();
}
