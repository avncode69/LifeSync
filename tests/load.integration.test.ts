import { afterAll, beforeAll, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
const actors: TestActor[] = [];
beforeAll(async () => {
  harness = await createApiHarness();
  for (let index = 0; index < 10; index++) {
    const actor = harness.actor();
    const email = `load-${index}@example.test`;
    expect((await actor.register(email)).status).toBe(200);
    expect((await actor.verify(email)).status).toBeLessThan(400);
    expect((await actor.login(email)).status).toBe(200);
    expect((await actor.request("/api/v1/tasks", "POST", { title: `Owned task ${index}` })).status).toBe(201);
    actors.push(actor);
  }
}, 60000);
afterAll(async () => {
  await harness?.close();
});

it("serves ten independent users concurrently without leaking owner-scoped lists", async () => {
  const start = performance.now();
  const responses = await Promise.all(
    actors.flatMap((actor, index) =>
      Array.from({ length: 5 }, async () => {
        const response = await actor.request("/api/v1/tasks?limit=100");
        expect(response.status).toBe(200);
        const body = (await response.json()) as { data: { title: string }[] };
        expect(body.data).toHaveLength(1);
        expect(body.data[0]?.title).toBe(`Owned task ${index}`);
        return response.status;
      }),
    ),
  );
  console.info(
    JSON.stringify({
      check: "authenticated-load-smoke",
      users: actors.length,
      requests: responses.length,
      elapsedMs: Math.round(performance.now() - start),
      backend: process.env.TEST_DATABASE_URL ? "native-postgresql" : "pglite-single-session",
    }),
  );
});
