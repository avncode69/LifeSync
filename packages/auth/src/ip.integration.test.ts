import { afterAll, beforeAll, expect, it } from "vitest";
import { type ApiHarness, createApiHarness } from "../../../tests/helpers/api-harness";

let harness: ApiHarness;
beforeAll(async () => {
  harness = await createApiHarness();
}, 30000);
afterAll(async () => {
  await harness?.close();
});

it("ignores spoofed forwarded IPs and separates trusted Cloudflare clients for auth rate limits", async () => {
  const actor = harness.actor();
  const reset = (trustedIp: string, forwardedIp: string) =>
    actor.request(
      "/api/auth/request-password-reset",
      "POST",
      { email: "unknown-rate-limit@example.test" },
      { "CF-Connecting-IP": trustedIp, "X-Forwarded-For": forwardedIp },
    );

  for (let attempt = 1; attempt <= 3; attempt++) {
    expect((await reset("192.0.2.100", `198.51.100.${attempt}`)).status).toBe(200);
  }
  expect((await reset("192.0.2.100", "198.51.100.4")).status).toBe(429);
  expect((await reset("192.0.2.101", "198.51.100.4")).status).toBe(200);
});
