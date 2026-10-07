import { describe, expect, it, vi } from "vitest";
import {
  decryptToken,
  encryptToken,
  GoogleCalendarClient,
  googleEventSchema,
  NbuRateProvider,
  parseGoogleFile,
  syncDecision,
  workspaceAuthorizationUrl,
} from "./index";

describe("integration boundaries", () => {
  it("preserves recurrence and location from Google instead of stripping them", () => {
    const event = googleEventSchema.parse({
      id: "remote",
      location: "Kyiv",
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    });
    expect(event.location).toBe("Kyiv");
    expect(event.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
  });
  it("encrypts refresh tokens with authenticated associated owner identity", async () => {
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(17)));
    const token = await encryptToken("refresh-secret", key, "user-a");
    expect(token).not.toContain("refresh-secret");
    expect(await decryptToken(token, key, "user-a")).toBe("refresh-secret");
    await expect(decryptToken(token, key, "user-b")).rejects.toThrow();
  });
  it("blocks arbitrary URL fetches and extracts Google IDs", () => {
    expect(parseGoogleFile("https://docs.google.com/document/d/Abc_123/edit")).toBe("Abc_123");
    expect(() => parseGoogleFile("https://localhost/admin")).toThrow("INVALID_GOOGLE_FILE");
    expect(() => parseGoogleFile("https://docs.google.com.evil.test/document/d/123/edit")).toThrow();
  });
  it("identity and workspace scopes stay separated and PKCE is present", () => {
    const url = new URL(
      workspaceAuthorizationUrl({
        clientId: "client",
        redirectUri: "https://app.test/api/v1/integrations/google/callback",
        state: "state",
        challenge: "challenge",
        calendar: true,
        drive: false,
      }),
    );
    expect(url.searchParams.get("scope")).not.toContain("drive");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
  });
  it("does not overwrite concurrent Calendar edits", () => {
    expect(
      syncDecision({
        localUpdatedAt: "2026-10-05T12:00:00Z",
        remoteUpdatedAt: "2026-10-05T11:00:00Z",
        lastSyncedAt: "2026-10-05T10:00:00Z",
      }),
    ).toBe("conflict");
  });
  it("invalid sync token requests a full resync once", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 410 }))
      .mockResolvedValueOnce(Response.json({ items: [], nextSyncToken: "fresh" }));
    const result = await new GoogleCalendarClient("access", fetcher).listEvents("primary", "expired");
    expect(result.reset).toBe(true);
    expect(result.syncToken).toBe("fresh");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("validates NBU rates and never fabricates missing currencies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json([{ cc: "USD", rate: 41.1, exchangedate: "05.10.2026", r030: 840, txt: "USD" }]));
    const rates = await new NbuRateProvider(fetcher).rates("2026-10-05");
    expect(rates.map((r) => [r.currency, r.rate])).toEqual([
      ["USD", "41.1"],
      ["UAH", "1"],
    ]);
    const invalid = new NbuRateProvider(
      vi.fn().mockResolvedValue(Response.json([{ cc: "USD", rate: -1, exchangedate: "05.10.2026" }])),
    );
    await expect(invalid.rates("2026-10-05")).rejects.toThrow();
  });
});
