import { describe, expect, it, vi } from "vitest";
import { runExclusively } from "./scheduler";

describe("scheduler database lease", () => {
  it("runs under the same session lock and releases it", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const job = vi.fn().mockResolvedValue(undefined);
    expect(await runExclusively({ connect: async () => ({ query, release }) }, job)).toBe(true);
    expect(job).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledOnce();
  });
  it("skips an already leased cycle", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ acquired: false }] });
    const release = vi.fn();
    const job = vi.fn();
    expect(await runExclusively({ connect: async () => ({ query, release }) }, job)).toBe(false);
    expect(job).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });
  it("unlocks and releases after a failed cycle", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValue({ rows: [] });
    const release = vi.fn();
    await expect(
      runExclusively({ connect: async () => ({ query, release }) }, async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(query).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledOnce();
  });
});
