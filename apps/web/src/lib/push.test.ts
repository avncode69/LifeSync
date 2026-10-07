import { expect, it, vi } from "vitest";
import { RequestError } from "./api";
import { registerPushSubscription, removePushSubscription } from "./push";

function subscription(endpoint: string) {
  return { endpoint, unsubscribe: vi.fn().mockResolvedValue(true) } as unknown as PushSubscription;
}
it("reuses an existing browser subscription on repeated enable", async () => {
  const existing = subscription("https://push.example/existing");
  const manager = { getSubscription: vi.fn().mockResolvedValue(existing), subscribe: vi.fn() };
  const save = vi.fn().mockResolvedValue(undefined);
  expect(await registerPushSubscription(manager, { userVisibleOnly: true }, save)).toBe(existing);
  expect(manager.subscribe).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith(existing);
});
it("replaces a foreign endpoint instead of reassigning it", async () => {
  const foreign = subscription("https://push.example/foreign");
  const fresh = subscription("https://push.example/fresh");
  const manager = { getSubscription: vi.fn().mockResolvedValue(foreign), subscribe: vi.fn().mockResolvedValue(fresh) };
  const save = vi
    .fn()
    .mockRejectedValueOnce(new RequestError("PUSH_ENDPOINT_CONFLICT", undefined, 409))
    .mockResolvedValueOnce(undefined);
  expect(await registerPushSubscription(manager, { userVisibleOnly: true }, save)).toBe(fresh);
  expect(foreign.unsubscribe).toHaveBeenCalledOnce();
  expect(save).toHaveBeenNthCalledWith(2, fresh);
});
it("unsubscribes locally even when backend cleanup fails", async () => {
  const existing = subscription("https://push.example/existing");
  const remove = vi.fn().mockRejectedValue(new Error("offline"));
  await expect(removePushSubscription(existing, remove)).rejects.toThrow("offline");
  expect(existing.unsubscribe).toHaveBeenCalledOnce();
});
it("preserves an endpoint after a recoverable registration failure", async () => {
  const existing = subscription("https://push.example/existing");
  const manager = { getSubscription: vi.fn().mockResolvedValue(existing), subscribe: vi.fn() };
  await expect(
    registerPushSubscription(manager, { userVisibleOnly: true }, vi.fn().mockRejectedValue(new Error("offline"))),
  ).rejects.toThrow("offline");
  expect(existing.unsubscribe).not.toHaveBeenCalled();
});
