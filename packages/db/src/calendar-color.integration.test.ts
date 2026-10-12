import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds nullable calendar colors without changing existing events", async () => {
  const db = new PGlite();
  try {
    const directory = new URL("../migrations/", import.meta.url);
    const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    const colorMigration = "0003_loose_smasher.sql";
    for (const name of migrations.filter((name) => name < colorMigration))
      await db.exec(await readFile(new URL(name, directory), "utf8"));
    await db.exec(
      "INSERT INTO users(id,name,email) VALUES('11111111-1111-4111-8111-111111111111','User','color@example.test')",
    );
    await db.exec(
      "INSERT INTO calendar_events(user_id,title,all_day,start_date,end_date) VALUES('11111111-1111-4111-8111-111111111111','Existing event',true,'2026-10-12','2026-10-13')",
    );
    const before = await db.query<Record<string, unknown>>("SELECT * FROM calendar_events");
    await db.exec(await readFile(new URL(colorMigration, directory), "utf8"));
    const after = await db.query("SELECT * FROM calendar_events");
    expect(after.rows).toEqual(before.rows.map((row) => ({ ...row, color: null })));
    const colored = await db.query<{ color: string }>("UPDATE calendar_events SET color='#aAbB09' RETURNING color");
    expect(colored.rows[0]?.color).toBe("#aAbB09");
  } finally {
    await db.close();
  }
});
