import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const project = "33333333-3333-4333-8333-333333333333";
const account = "44444444-4444-4444-8444-444444444444";
beforeAll(async () => {
  const dir = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(name, dir), "utf8"));
  await db.query("INSERT INTO users (id,name,email) VALUES ($1,'A','a@example.test'),($2,'B','b@example.test')", [
    ownerA,
    ownerB,
  ]);
  await db.query("INSERT INTO projects(id,user_id,name) VALUES($1,$2,'Private')", [project, ownerB]);
  await db.query("INSERT INTO financial_accounts(id,user_id,name,currency) VALUES($1,$2,'Cash','UAH')", [
    account,
    ownerB,
  ]);
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL ownership and value constraints", () => {
  it("preserves active financial history when a parent is purged", async () => {
    const extraAccount = "55555555-5555-4555-8555-555555555555";
    await db.query("INSERT INTO financial_accounts(id,user_id,name,currency) VALUES($1,$2,'History','UAH')", [
      extraAccount,
      ownerB,
    ]);
    await db.query(
      "INSERT INTO finance_transactions(user_id,account_id,type,amount,currency,transaction_date) VALUES($1,$2,'expense',10,'UAH','2026-10-05')",
      [ownerB, extraAccount],
    );
    await expect(db.query("DELETE FROM financial_accounts WHERE id=$1", [extraAccount])).rejects.toMatchObject({
      code: "23503",
    });
  });
  it("creates all 58 typed domain tables from committed migration", async () => {
    const r = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'",
    );
    expect(r.rows[0]?.count).toBe(58);
  });
  it("rejects association to another user's project", async () => {
    await expect(
      db.query("INSERT INTO tasks(user_id,title,project_id) VALUES($1,'Cross-owner',$2)", [ownerA, project]),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("rejects another user's financial account", async () => {
    await expect(
      db.query(
        "INSERT INTO finance_transactions(user_id,account_id,type,amount,currency,transaction_date) VALUES($1,$2,'expense',10,'UAH','2026-10-05')",
        [ownerA, account],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("preserves exact money decimals", async () => {
    const result = await db.query<{ opening_balance: string }>(
      "UPDATE financial_accounts SET opening_balance=0.1000 WHERE id=$1 RETURNING opening_balance::text",
      [account],
    );
    expect(result.rows[0]?.opening_balance).toBe("0.1000");
  });
  it("rejects a transfer without destination amount", async () => {
    await expect(
      db.query(
        "INSERT INTO finance_transactions(user_id,account_id,type,amount,currency,transaction_date,destination_account_id) VALUES($1,$2,'transfer',10,'UAH','2026-10-05',$3)",
        [ownerB, account, project],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects an all-day event without end date", async () => {
    await expect(
      db.query("INSERT INTO calendar_events(user_id,title,all_day,start_date) VALUES($1,'Invalid',true,'2026-10-05')", [
        ownerA,
      ]),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("rejects invalid macro values", async () => {
    await expect(
      db.query(
        "INSERT INTO custom_foods(user_id,name,calories,protein,fat,carbohydrates) VALUES($1,'Invalid',-1,0,0,0)",
        [ownerA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("allows an owned association", async () => {
    const result = await db.query("INSERT INTO tasks(user_id,title,project_id) VALUES($1,'Own',$2) RETURNING id", [
      ownerB,
      project,
    ]);
    expect(result.rows).toHaveLength(1);
  });
});
