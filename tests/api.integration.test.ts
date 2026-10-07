import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
let a: TestActor, b: TestActor;
let taskId: string, projectId: string, accountId: string, transactionId: string, healthId: string;
const emailA = "alice@example.test",
  emailB = "bob@example.test";
async function data(response: Response) {
  const body = (await response.json()) as { data: Record<string, unknown>; error?: unknown };
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data;
}
beforeAll(async () => {
  harness = await createApiHarness();
  a = harness.actor();
  b = harness.actor();
  expect((await a.register(emailA)).status).toBe(200);
  expect((await a.verify(emailA)).status).toBeLessThan(400);
  expect((await a.login(emailA)).status).toBe(200);
  expect((await b.register(emailB)).status).toBe(200);
  expect((await b.verify(emailB)).status).toBeLessThan(400);
  expect((await b.login(emailB)).status).toBe(200);
}, 30000);
afterAll(async () => {
  await harness?.close();
});
describe("real Better Auth + Hono + PostgreSQL security boundary", () => {
  it("requires terms acceptance before registration", async () => {
    const r = await harness.actor().request("/api/auth/sign-up/email", "POST", {
      name: "No terms",
      email: "terms@example.test",
      password: "Test-password-with-24chars",
    });
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("TERMS_REQUIRED");
  });
  it("blocks an unverified account", async () => {
    const actor = harness.actor();
    expect((await actor.register("unverified@example.test")).status).toBe(200);
    expect((await actor.login("unverified@example.test")).status).toBe(403);
    expect((await actor.request("/api/v1/me")).status).toBe(401);
  });
  it("returns a verified authenticated profile", async () => {
    expect((await data(await a.request("/api/v1/me"))).email).toBe(emailA);
  });
  it("rejects requests from an unrelated Origin", async () => {
    const response = await a.request(
      "/api/v1/projects",
      "POST",
      { name: "Blocked" },
      { Origin: "https://evil.example" },
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("ORIGIN_REJECTED");
  });
  it("denies normal users access to administrative data", async () =>
    expect((await a.request("/api/v1/admin/users")).status).toBe(403));
  it("persists projects/tasks/finance/health through real database", async () => {
    projectId = String((await data(await a.request("/api/v1/projects", "POST", { name: "Private project" }))).id);
    taskId = String((await data(await a.request("/api/v1/tasks", "POST", { title: "Private task", projectId }))).id);
    accountId = String(
      (await data(await a.request("/api/v1/finance/accounts", "POST", { name: "Private cash", currency: "UAH" }))).id,
    );
    transactionId = String(
      (
        await data(
          await a.request(
            "/api/v1/finance/transactions",
            "POST",
            { accountId, type: "expense", amount: "95.0000", currency: "UAH", transactionDate: "2026-10-05" },
            { "Idempotency-Key": "private-expense" },
          ),
        )
      ).id,
    );
    healthId = String(
      (await data(await a.request("/api/v1/health/water", "POST", { date: "2026-10-05", amountMl: 250 }))).id,
    );
    const stored = await harness.db.$client.query("SELECT title FROM tasks WHERE id=$1", [taskId]);
    expect(stored.rows[0]?.title).toBe("Private task");
  });
  it("denies other users read/update access across private domains", async () => {
    for (const path of [`/tasks/${taskId}`, `/finance/transactions/${transactionId}`, `/health/water/${healthId}`])
      expect((await b.request(`/api/v1${path}`)).status, path).toBe(404);
    expect((await b.request(`/api/v1/tasks/${taskId}`, "PATCH", { title: "Stolen" })).status).toBe(404);
    expect((await b.request(`/api/v1/finance/transactions/${transactionId}`, "PATCH", { amount: "1" })).status).toBe(
      404,
    );
    expect((await b.request(`/api/v1/health/water/${healthId}`, "PATCH", { amountMl: 1 })).status).toBe(404);
    expect((await b.request("/api/v1/tasks", "POST", { title: "Foreign parent", projectId })).status).toBe(404);
  });
  it("preserves task status on a title-only patch", async () => {
    await data(await a.request(`/api/v1/tasks/${taskId}`, "PATCH", { status: "in_progress" }));
    const updated = await data(await a.request(`/api/v1/tasks/${taskId}`, "PATCH", { title: "Renamed" }));
    expect(updated.status).toBe("in_progress");
  });
  it("preserves preferences on a theme-only patch", async () => {
    await data(
      await a.request("/api/v1/preferences", "PATCH", {
        locale: "en",
        timezone: "America/New_York",
        baseCurrency: "USD",
      }),
    );
    const updated = await data(await a.request("/api/v1/preferences", "PATCH", { theme: "dark" }));
    expect(updated.locale).toBe("en");
    expect(updated.timezone).toBe("America/New_York");
    expect(updated.baseCurrency).toBe("USD");
  });
  it("enforces the free Inbox limit under concurrent creation", async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => a.request("/api/v1/inbox/boxes", "POST", { name: `Box ${i}` })),
    );
    expect(results.filter((v) => v.status === 201)).toHaveLength(2);
    expect(
      results.filter((v) => v.status === 403 || v.status === 409),
      harness.errors.map((e) => `${e.message}\n${String(e.cause)}`).join("\n"),
    ).toHaveLength(2);
    const stored = await harness.db.$client.query(
      "SELECT count(*)::int AS count FROM inbox_boxes WHERE deleted_at IS NULL",
    );
    expect(stored.rows[0]?.count).toBe(2);
  });
  it("replays a finance write without duplicating or changing its original response", async () => {
    await data(await a.request(`/api/v1/finance/transactions/${transactionId}`, "PATCH", { merchant: "Edited later" }));
    const replay = await data(
      await a.request(
        "/api/v1/finance/transactions",
        "POST",
        { accountId, type: "expense", amount: "95.0000", currency: "UAH", transactionDate: "2026-10-05" },
        { "Idempotency-Key": "private-expense" },
      ),
    );
    expect(replay.id).toBe(transactionId);
    expect(replay.merchant).toBeNull();
    const stored = await harness.db.$client.query("SELECT count(*)::int AS count FROM finance_transactions");
    expect(stored.rows[0]?.count).toBe(1);
  });
  it("soft-deletes and restores a task", async () => {
    expect((await a.request(`/api/v1/tasks/${taskId}`, "DELETE")).status).toBe(200);
    expect((await a.request(`/api/v1/tasks/${taskId}`)).status).toBe(404);
    const trash = await a.request("/api/v1/trash");
    expect(await trash.text()).toContain(taskId);
    expect((await a.request(`/api/v1/tasks/${taskId}/restore`, "POST", {})).status).toBe(200);
    expect((await a.request(`/api/v1/tasks/${taskId}`)).status).toBe(200);
  });
  it("balances a same-currency transfer using exact decimal equivalence", async () => {
    const destination = String(
      (await data(await a.request("/api/v1/finance/accounts", "POST", { name: "Savings", currency: "UAH" }))).id,
    );
    const transfer = await a.request(
      "/api/v1/finance/transactions",
      "POST",
      {
        accountId,
        type: "transfer",
        amount: "10",
        currency: "UAH",
        transactionDate: "2026-10-05",
        destinationAccountId: destination,
        destinationAmount: "10.0000",
      },
      { "Idempotency-Key": "balanced-transfer" },
    );
    expect(transfer.status, await transfer.clone().text()).toBe(201);
    const summary = await data(await a.request("/api/v1/finance/summary?month=2026-10-01"));
    const accounts = summary.accounts as Array<{ id: string; balance: string }>;
    expect(accounts.find((v) => v.id === accountId)?.balance).toBe("-105.0000");
    expect(accounts.find((v) => v.id === destination)?.balance).toBe("10.0000");
  });
  it("preserves opt-in AI permissions on a partial permission update", async () => {
    await data(await a.request("/api/v1/ai/permissions", "PATCH", { tasks: true }));
    const permission = await data(await a.request("/api/v1/ai/permissions", "PATCH", { finance: true }));
    expect(permission.tasks).toBe(true);
    expect(permission.finance).toBe(true);
    expect(permission.health).toBe(false);
  });
  it("omits authentication, OAuth and push keys from account export", async () => {
    await data(
      await a.request("/api/v1/push/subscriptions", "POST", {
        endpoint: "https://fcm.googleapis.com/fcm/send/test-device",
        p256dh: "secret-push-p256dh-12345678901234567890",
        auth: "secret-push-auth-12345",
      }),
    );
    const response = await a.request("/api/v1/export");
    expect(response.status).toBe(200);
    const content = await response.text();
    expect(content).toContain(taskId);
    expect(content).not.toContain("secret-push-auth");
    expect(content).not.toContain("secret-push-p256dh");
    expect(content).not.toContain("password");
    expect(content).not.toContain("encryptedRefreshToken");
    expect(content).not.toContain("session_token");
  });
  it("revokes a current session immediately", async () => {
    const actor = harness.actor();
    expect((await actor.login(emailB)).status).toBe(200);
    const response = await actor.request("/api/v1/sessions");
    const { data: sessions } = (await response.json()) as { data: Array<{ id: string; current: boolean }> };
    const current = sessions.find((v) => v.current);
    expect(current).toBeDefined();
    expect((await actor.request(`/api/v1/sessions/${current?.id}`, "DELETE")).status).toBe(200);
    expect((await actor.request("/api/v1/me")).status).toBe(401);
  });
  it("does not reveal account existence in reset-password responses", async () => {
    const actor = harness.actor();
    const known = await actor.request("/api/auth/request-password-reset", "POST", {
      email: emailB,
      redirectTo: "http://lifesync.test/reset-password",
    });
    const missing = await actor.request("/api/auth/request-password-reset", "POST", {
      email: "missing@example.test",
      redirectTo: "http://lifesync.test/reset-password",
    });
    expect(known.status).toBe(missing.status);
    expect(await known.json()).toEqual(await missing.json());
  });
  it("uses a password reset token once and revokes previous sessions", async () => {
    const actor = harness.actor();
    expect(
      (
        await actor.request("/api/auth/request-password-reset", "POST", {
          email: emailB,
          redirectTo: "http://lifesync.test/reset-password",
        })
      ).status,
    ).toBe(200);
    const message = [...harness.mail].reverse().find((v) => v.to === emailB && v.subject.includes("Reset"));
    const url = message?.text.match(/https?:\/\/\S+/)?.[0];
    expect(url).toBeDefined();
    if (!url) throw new Error("Password reset mail lacks URL");
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token") ?? parsed.pathname.split("/").at(-1);
    const body = { token, newPassword: "New-password-with-24chars" };
    expect((await actor.request("/api/auth/reset-password", "POST", body)).status).toBe(200);
    expect((await b.request("/api/v1/me")).status).toBe(401);
    expect((await actor.request("/api/auth/reset-password", "POST", body)).status).toBeGreaterThanOrEqual(400);
    expect((await actor.login(emailB, "New-password-with-24chars")).status).toBe(200);
  });
  it("deletes an account with all of its owned data after password confirmation", async () => {
    const response = await a.request("/api/v1/account", "DELETE", {
      confirmation: "DELETE",
      password: "Test-password-with-24chars",
    });
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await a.request("/api/v1/me")).status).toBe(401);
    const rows = await harness.db.$client.query("SELECT id FROM tasks WHERE id=$1", [taskId]);
    expect(rows.rows).toHaveLength(0);
  });
});
