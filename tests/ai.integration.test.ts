import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AIChunk, AIProvider, AIRequest } from "../packages/integrations/src/index";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
let mode: "text" | "error" | "tool" = "text";
let toolArgs: Record<string, unknown> = {};
const providerRequests: AIRequest[] = [];
const provider: AIProvider = {
  async chat() {
    return "Completion";
  },
  async structured() {
    return {};
  },
  async toolCall() {
    return [];
  },
  async *stream(request): AsyncIterable<AIChunk> {
    providerRequests.push(request);
    if (mode === "error") throw new Error("Fixture provider unavailable");
    if (mode === "tool") yield { type: "tool", name: "createTransaction", args: toolArgs };
    else yield { type: "text", text: "Completion" };
  },
};
beforeAll(async () => {
  harness = await createApiHarness(provider);
}, 30000);
afterAll(async () => {
  await harness?.close();
});
async function actor(name: string) {
  const actor = harness.actor(),
    email = `${name}@example.test`;
  expect((await actor.register(email)).status).toBe(200);
  await actor.verify(email);
  expect((await actor.login(email)).status).toBe(200);
  return actor;
}
async function createConversation(actor: TestActor) {
  const response = await actor.request("/api/v1/ai/conversations", "POST", { title: "Private conversation" });
  expect(response.status).toBe(201);
  return String((await response.json()).data.id);
}
describe("AI server policy with an explicit test provider", () => {
  it("limits four concurrent requests to three successful completions", async () => {
    mode = "text";
    const user = await actor("quota"),
      conversationId = await createConversation(user);
    const responses = await Promise.all(
      Array.from({ length: 4 }, async (_, i) => {
        const response = await user.request(
          "/api/v1/ai/chat",
          "POST",
          { conversationId, message: `Message ${i}` },
          { "Idempotency-Key": `quota-${i}` },
        );
        const content = await response.text();
        return { status: response.status, content };
      }),
    );
    expect(responses.filter((v) => v.status === 200 && v.content.includes("event: done"))).toHaveLength(3);
    expect(responses.filter((v) => v.status === 429 && v.content.includes("AI_QUOTA_EXCEEDED"))).toHaveLength(1);
    const quota = (await (await user.request("/api/v1/ai/quota")).json()).data;
    expect(quota.used).toBe(3);
    expect(quota.reserved).toBe(0);
    expect(quota.remaining).toBe(0);
  });
  it("refunds reservations after a provider failure with no meaningful completion", async () => {
    mode = "error";
    const user = await actor("refund"),
      conversationId = await createConversation(user);
    const response = await user.request(
      "/api/v1/ai/chat",
      "POST",
      { conversationId, message: "Request" },
      { "Idempotency-Key": "refund-provider-error" },
    );
    expect(await response.text()).toContain("AI_PROVIDER_ERROR");
    const quota = (await (await user.request("/api/v1/ai/quota")).json()).data;
    expect(quota.used).toBe(0);
    expect(quota.reserved).toBe(0);
    expect(quota.remaining).toBe(3);
  });
  it("excludes a hidden module from provider context and available tools", async () => {
    mode = "text";
    const user = await actor("hidden"),
      conversationId = await createConversation(user);
    await user.request("/api/v1/ai/permissions", "PATCH", { health: true });
    await user.request("/api/v1/preferences", "PATCH", { hiddenModules: ["health"] });
    await user.request("/api/v1/health/water", "POST", { date: "2026-10-05", amountMl: 250 });
    const response = await user.request(
      "/api/v1/ai/chat",
      "POST",
      { conversationId, message: "Summarize" },
      { "Idempotency-Key": "hidden-health" },
    );
    expect(await response.text()).toContain("event: done");
    const request = providerRequests.at(-1);
    expect(request?.system).not.toContain('"health":');
    expect(request?.tools?.some((v) => v.name === "createHealthEntry")).toBe(false);
  });
  it("requires fresh permission at action confirmation and persists no unauthorized finance mutation", async () => {
    mode = "tool";
    const user = await actor("revoked"),
      conversationId = await createConversation(user);
    await user.request("/api/v1/ai/permissions", "PATCH", { finance: true });
    const account = (
      await (await user.request("/api/v1/finance/accounts", "POST", { name: "Cash", currency: "UAH" })).json()
    ).data;
    toolArgs = { accountId: account.id, type: "expense", amount: "10", currency: "UAH", transactionDate: "2026-10-05" };
    const response = await user.request(
      "/api/v1/ai/chat",
      "POST",
      { conversationId, message: "Record expense" },
      { "Idempotency-Key": "revoked-finance" },
    );
    const content = await response.text();
    const actionBlock = content.split("\n\n").find((v) => v.includes("event: action"));
    const line = actionBlock?.split("\n").find((v) => v.startsWith("data: "));
    if (!line) throw new Error(`No proposed action: ${content}`);
    const action = JSON.parse(line.slice(6)) as { id: string; confirmationToken: string };
    const before = await harness.db.$client.query("SELECT count(*)::int AS count FROM finance_transactions");
    expect(before.rows[0]?.count).toBe(0);
    await user.request("/api/v1/ai/permissions", "PATCH", { finance: false });
    const confirmation = await user.request(`/api/v1/ai/actions/${action.id}/confirm`, "POST", {
      confirmationToken: action.confirmationToken,
    });
    expect(confirmation.status).toBe(403);
    expect((await confirmation.json()).error.code).toBe("AI_PERMISSION_DENIED");
    const after = await harness.db.$client.query("SELECT count(*)::int AS count FROM finance_transactions");
    expect(after.rows[0]?.count).toBe(0);
  });
});
