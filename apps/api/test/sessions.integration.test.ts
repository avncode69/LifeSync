import * as schema from "@lifesync/db";
import { afterAll, beforeAll, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "../../../tests/helpers/api-harness";

let harness: ApiHarness, actor: TestActor;
beforeAll(async () => {
  harness = await createApiHarness();
  actor = harness.actor();
  await actor.register("sessions@example.test");
  await actor.verify("sessions@example.test");
  await actor.login("sessions@example.test");
}, 30000);
afterAll(async () => {
  await harness?.close();
});

it("lists current and other valid sessions while omitting expired sessions without deleting them", async () => {
  const me = (await (await actor.request("/api/v1/me")).json()) as { data: { id: string } };
  const expiredId = crypto.randomUUID();
  const validId = crypto.randomUUID();
  await harness.db.insert(schema.session).values([
    { id: expiredId, userId: me.data.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() - 60000) },
    { id: validId, userId: me.data.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86400000) },
  ]);
  const response = await actor.request("/api/v1/sessions");
  expect(response.status).toBe(200);
  const body = (await response.json()) as { data: { id: string; current: boolean }[] };
  expect(body.data.some((row) => row.current)).toBe(true);
  expect(body.data.map((row) => row.id)).toContain(validId);
  expect(body.data.map((row) => row.id)).not.toContain(expiredId);
  const stored = await harness.db.select({ id: schema.session.id }).from(schema.session);
  expect(stored.map((row) => row.id)).toEqual(expect.arrayContaining([validId, expiredId]));
});
