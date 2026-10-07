import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.unstubAllGlobals());
it("follows cursor pages without losing records", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "a" }], nextCursor: "a" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "b" }] })));
  vi.stubGlobal("fetch", fetcher);
  expect(await api("/tasks?limit=100")).toEqual([{ id: "a" }, { id: "b" }]);
  expect(fetcher.mock.calls[1][0]).toBe("/api/v1/tasks?limit=100&cursor=a");
});
it("rejects cursor cycles rather than returning an incomplete list", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ data: [{ id: "a" }], nextCursor: "a" }))),
      ),
  );
  await expect(api("/tasks?limit=100")).rejects.toMatchObject({ code: "PAGINATION_LIMIT" });
});
