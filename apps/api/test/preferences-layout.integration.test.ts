import { afterAll, beforeAll, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "../../../tests/helpers/api-harness";
let harness: ApiHarness, actor: TestActor;
beforeAll(async () => {
  harness = await createApiHarness();
  actor = harness.actor();
  await actor.register("layout@example.test");
  await actor.verify("layout@example.test");
  await actor.login("layout@example.test");
}, 30000);
afterAll(async () => {
  await harness?.close();
});
it("allows personalization to save before a dashboard layout is customized", async () => {
  const response = await actor.request("/api/v1/preferences");
  const { data } = (await response.json()) as { data: { dashboardLayout?: unknown } };
  expect(data.dashboardLayout).toBeUndefined();
  const saved = await actor.request("/api/v1/preferences", "PATCH", {
    locale: "en",
    dashboardLayout: data.dashboardLayout,
  });
  expect(saved.status).toBe(200);
});
