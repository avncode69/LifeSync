import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { type ApiHarness, createApiHarness, type TestActor } from "./helpers/api-harness";

let harness: ApiHarness;
let owner: TestActor;
let other: TestActor;
beforeAll(async () => {
  harness = await createApiHarness();
  Object.assign(harness.config, {
    GOOGLE_WORKSPACE_CLIENT_ID: "test-workspace-client",
    GOOGLE_WORKSPACE_CLIENT_SECRET: "test-workspace-secret",
    GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  });
  owner = harness.actor();
  other = harness.actor();
  for (const [actor, email] of [
    [owner, "oauth-owner@example.test"],
    [other, "oauth-other@example.test"],
  ] as const) {
    expect((await actor.register(email)).status).toBe(200);
    await actor.verify(email);
    expect((await actor.login(email)).status).toBe(200);
  }
}, 30000);
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => harness?.close());

async function connect(calendar: boolean, drive: boolean) {
  const response = await owner.request("/api/v1/integrations/google/connect", "POST", { calendar, drive });
  expect(response.status).toBe(200);
  return new URL((await response.json()).data.url);
}
it("requests only selected incremental scopes with PKCE and offline access", async () => {
  const calendar = await connect(true, false);
  const drive = await connect(false, true);
  expect(calendar.searchParams.get("scope")).toContain("calendar.events");
  expect(calendar.searchParams.get("scope")).not.toContain("drive.file");
  expect(drive.searchParams.get("scope")).toContain("drive.file");
  expect(drive.searchParams.get("scope")).not.toContain("calendar.events");
  expect(drive.searchParams.get("scope")).not.toMatch(/auth\/drive(?:\s|$)/);
  expect(calendar.searchParams.get("code_challenge_method")).toBe("S256");
  expect(calendar.searchParams.get("access_type")).toBe("offline");
  expect(calendar.searchParams.get("include_granted_scopes")).toBe("true");
});
it("rejects foreign and expired state, consumes valid state before exchange, and rejects replay", async () => {
  const state = (await connect(true, false)).searchParams.get("state");
  const path = `/api/v1/integrations/google/callback?state=${state}&code=test-code`;
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  expect((await other.request(path)).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await owner.request(path)).status).toBeGreaterThanOrEqual(400);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((await owner.request(path)).status).toBe(403);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const expired = (await connect(false, true)).searchParams.get("state");
  await harness.db.$client.query("UPDATE verifications SET expires_at=$1 WHERE identifier LIKE 'workspace:%'", [
    new Date(0),
  ]);
  expect((await owner.request(`/api/v1/integrations/google/callback?state=${expired}&code=test-code`)).status).toBe(
    403,
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
