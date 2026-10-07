import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AIChunk, AIProvider } from "../packages/integrations/src/index";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
let owner: TestActor;
let stranger: TestActor;
let proposed: Record<string, unknown>;
const provider: AIProvider = {
  async chat() {
    return "Review test completion";
  },
  async structured() {
    return {};
  },
  async toolCall() {
    return [];
  },
  async *stream(): AsyncIterable<AIChunk> {
    yield { type: "tool", name: "updateTask", args: proposed };
  },
};
async function data(response: Response) {
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBeLessThan(400);
  return body.data as Record<string, unknown>;
}
beforeAll(async () => {
  harness = await createApiHarness(provider);
  owner = harness.actor();
  stranger = harness.actor();
  for (const [actor, email] of [
    [owner, "ai-review-owner@example.test"],
    [stranger, "ai-review-stranger@example.test"],
  ] as const) {
    expect((await actor.register(email)).status).toBe(200);
    expect((await actor.verify(email)).status).toBeLessThan(400);
    expect((await actor.login(email)).status).toBe(200);
  }
  await data(await owner.request("/api/v1/ai/permissions", "PATCH", { tasks: true }));
}, 30000);
afterAll(async () => {
  await harness?.close();
});

async function actionFor(taskId: string) {
  proposed = { id: taskId, input: { title: "AI updated title" } };
  const conversation = await data(await owner.request("/api/v1/ai/conversations", "POST", { title: "Review action" }));
  const response = await owner.request(
    "/api/v1/ai/chat",
    "POST",
    { conversationId: conversation.id, message: "Rename my task" },
    { "Idempotency-Key": randomUUID() },
  );
  expect(response.status).toBe(200);
  const content = await response.text();
  expect(content).toContain("event: done");
  const block = content.split("\n\n").find((value) => value.includes("event: action"));
  const line = block?.split("\n").find((value) => value.startsWith("data: "));
  if (!line) throw new Error(`No proposed action: ${content}`);
  return JSON.parse(line.slice(6)) as { id: string; confirmationToken: string };
}

describe("AI confirmed mutations and reversible undo", () => {
  it("confirms once, checks ownership, restores prior values once and retains audit metadata", async () => {
    const task = await data(await owner.request("/api/v1/tasks", "POST", { title: "Original task", priority: "high" }));
    const action = await actionFor(String(task.id));
    const path = `/api/v1/ai/actions/${action.id}`;
    const input = { confirmationToken: action.confirmationToken };
    expect((await stranger.request(`${path}/confirm`, "POST", input)).status).toBeGreaterThanOrEqual(400);
    expect((await data(await owner.request(`/api/v1/tasks/${task.id}`))).title).toBe("Original task");
    const confirmations = await Promise.all([
      owner.request(`${path}/confirm`, "POST", input),
      owner.request(`${path}/confirm`, "POST", input),
    ]);
    expect(confirmations.map((response) => response.status).sort()).toEqual([200, 409]);
    const accepted = confirmations.find((response) => response.status === 200);
    if (!accepted) throw new Error("No accepted confirmation");
    expect((await data(accepted)).id).toBe(task.id);
    expect(await data(await owner.request(`/api/v1/tasks/${task.id}`))).toMatchObject({
      title: "AI updated title",
      priority: "high",
    });
    expect((await stranger.request(`${path}/undo`, "POST")).status).toBeGreaterThanOrEqual(400);
    const undo = await owner.request(`${path}/undo`, "POST");
    if (undo.status !== 200) {
      const debug = await harness.db.$client.query(
        "SELECT t.updated_at::text AS actual,a.undo_data FROM tasks t JOIN ai_action_logs a ON a.target_id=t.id WHERE a.id=$1",
        [action.id],
      );
      throw new Error(`Undo ${undo.status}: ${await undo.text()}; snapshot ${JSON.stringify(debug.rows)}`);
    }
    expect(await data(undo)).toMatchObject({
      title: "Original task",
      priority: "high",
    });
    expect((await owner.request(`${path}/undo`, "POST")).status).toBe(409);
    const rows = await harness.db.$client.query(
      "SELECT status,undo_data IS NOT NULL AS has_snapshot FROM ai_action_logs WHERE id=$1",
      [action.id],
    );
    expect(rows.rows).toEqual([{ status: "undone", has_snapshot: true }]);
    const audit = await harness.db.$client.query(
      "SELECT action,count(*)::int AS count FROM audit_logs WHERE target_id=$1 AND action LIKE 'ai.action_%' GROUP BY action ORDER BY action",
      [task.id],
    );
    expect(audit.rows).toEqual([
      { action: "ai.action_confirmed", count: 1 },
      { action: "ai.action_undone", count: 1 },
    ]);
  });

  it("refuses undo when a later manual edit would be overwritten", async () => {
    const task = await data(await owner.request("/api/v1/tasks", "POST", { title: "Original conflict task" }));
    const action = await actionFor(String(task.id));
    const path = `/api/v1/ai/actions/${action.id}`;
    await data(await owner.request(`${path}/confirm`, "POST", { confirmationToken: action.confirmationToken }));
    await data(await owner.request(`/api/v1/tasks/${task.id}`, "PATCH", { title: "Newer manual title" }));
    const response = await owner.request(`${path}/undo`, "POST");
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("UNDO_CONFLICT");
    expect((await data(await owner.request(`/api/v1/tasks/${task.id}`))).title).toBe("Newer manual title");
  });
});
