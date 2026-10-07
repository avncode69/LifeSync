import { sendWebPush } from "@lifesync/integrations";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "../../../tests/helpers/api-harness";
import { deliverReminders } from "../src/jobs";

vi.mock("@lifesync/integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lifesync/integrations")>()),
  sendWebPush: vi.fn(),
}));
let harness: ApiHarness, actor: TestActor;
async function data(response: Response) {
  const body = (await response.json()) as { data: Record<string, string> };
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data;
}
beforeAll(async () => {
  harness = await createApiHarness();
  actor = harness.actor();
  const email = "push-delivery@example.test";
  await actor.register(email);
  await actor.verify(email);
  await actor.login(email);
}, 30000);
afterAll(async () => {
  await harness?.close();
});
describe("per-device push delivery", () => {
  it("retries only the failed endpoint and preserves the stable delivery ID", async () => {
    const endpoints = ["https://fcm.googleapis.com/fcm/send/device-a", "https://fcm.googleapis.com/fcm/send/device-b"];
    for (const endpoint of endpoints)
      await data(
        await actor.request("/api/v1/push/subscriptions", "POST", {
          endpoint,
          p256dh: "A".repeat(86),
          auth: "B".repeat(22),
        }),
      );
    await data(await actor.request("/api/v1/preferences", "PATCH", { webPushEnabled: true }));
    const instant = new Date("2026-10-05T12:00:00Z");
    const task = await data(
      await actor.request("/api/v1/tasks", "POST", { title: "Per-device reminder", dueAt: instant.toISOString() }),
    );
    const rule = await data(
      await actor.request("/api/v1/reminders", "POST", {
        taskId: task.id,
        triggerType: "offset",
        offsetMinutes: 0,
        channels: ["push"],
      }),
    );
    const attempts = new Map<string, number>();
    vi.mocked(sendWebPush).mockImplementation(async (subscription) => {
      const count = (attempts.get(subscription.endpoint) ?? 0) + 1;
      attempts.set(subscription.endpoint, count);
      if (subscription.endpoint === endpoints[1] && count === 1) throw new Error("TEST_TRANSIENT_503");
      return "delivered";
    });
    const config = { ...harness.config, VAPID_PUBLIC_KEY: "test-public-key", VAPID_PRIVATE_KEY: "test-private-key" };
    await deliverReminders(harness.db, config, instant);
    await deliverReminders(harness.db, config, new Date(instant.getTime() + 6 * 60000));
    await deliverReminders(harness.db, config, new Date(instant.getTime() + 12 * 60000));
    expect(attempts.get(endpoints[0])).toBe(1);
    expect(attempts.get(endpoints[1])).toBe(2);
    const retryCalls = vi
      .mocked(sendWebPush)
      .mock.calls.filter(([subscription]) => subscription.endpoint === endpoints[1]);
    expect(retryCalls[0][1].id).toBeTruthy();
    expect(retryCalls[0][1].id).toBe(retryCalls[1][1].id);
    const rows = await harness.db.$client.query(
      "select status,attempts,channel from reminder_deliveries where reminder_id=$1 order by attempts",
      [rule.id],
    );
    expect(rows.rows.map((row) => [row.status, row.attempts])).toEqual([
      ["delivered", 1],
      ["delivered", 2],
    ]);
    expect(rows.rows.every((row) => row.channel.startsWith("push:"))).toBe(true);
  });
});
