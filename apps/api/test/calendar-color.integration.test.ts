import { afterAll, beforeAll, expect, it } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "../../../tests/helpers/api-harness";

let harness: ApiHarness, actor: TestActor;
async function data<T = Record<string, unknown>>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data;
}
beforeAll(async () => {
  harness = await createApiHarness();
  actor = harness.actor();
  await actor.register("calendar-color@example.test");
  await actor.verify("calendar-color@example.test");
  await actor.login("calendar-color@example.test");
}, 30000);
afterAll(async () => {
  await harness?.close();
});

it("persists calendar colors through create, update, list and recurrence expansion", async () => {
  const event = await data(
    await actor.request("/api/v1/calendar/events", "POST", {
      title: "Colored series",
      allDay: true,
      startDate: "2026-10-12",
      endDate: "2026-10-13",
      recurrenceRule: "FREQ=DAILY;COUNT=2",
      color: "#aAbB09",
    }),
  );
  expect(event.color).toBe("#aAbB09");
  const updated = await data(await actor.request(`/api/v1/calendar/events/${event.id}`, "PATCH", { color: "#123456" }));
  expect(updated).toMatchObject({ title: "Colored series", color: "#123456" });
  await data(await actor.request(`/api/v1/calendar/events/${event.id}`, "PATCH", { title: "Renamed" }));
  const list = await actor.request("/api/v1/calendar/events");
  const body = (await list.json()) as { data: Record<string, unknown>[] };
  expect(list.status).toBe(200);
  expect(body.data.find((row) => row.id === event.id)).toMatchObject({ title: "Renamed", color: "#123456" });
  const occurrences = await data<Record<string, unknown>[]>(
    await actor.request("/api/v1/calendar/occurrences?from=2026-10-12&to=2026-10-13"),
  );
  expect(occurrences).toHaveLength(2);
  expect(occurrences.every((row) => row.color === "#123456")).toBe(true);
  const invalid = await actor.request(`/api/v1/calendar/events/${event.id}`, "PATCH", { color: "red" });
  expect(invalid.status).toBe(400);
});
