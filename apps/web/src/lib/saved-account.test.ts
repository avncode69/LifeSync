import { afterEach, describe, expect, it, vi } from "vitest";
import { readSavedAccount } from "./saved-account";

afterEach(() => vi.unstubAllGlobals());
describe("saved session lookup", () => {
  it("reuses the cookie account without creating a session", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { id: "saved-user" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await readSavedAccount()).toEqual({ id: "saved-user" });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({ credentials: "same-origin", cache: "no-store" }),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403])("does not redirect an anonymous or disabled account (%s)", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    expect(await readSavedAccount()).toBeNull();
  });
  it("preserves network failure instead of attempting a new sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(readSavedAccount()).rejects.toThrow("REQUEST_FAILED");
  });
});
