import { api, RequestError } from "./api";
export async function registerPushSubscription(
  manager: Pick<PushManager, "getSubscription" | "subscribe">,
  options: PushSubscriptionOptionsInit,
  save: (subscription: PushSubscription) => Promise<unknown>,
): Promise<PushSubscription> {
  let subscription = (await manager.getSubscription()) ?? (await manager.subscribe(options));
  try {
    await save(subscription);
  } catch (reason) {
    if (!(reason instanceof RequestError) || reason.status !== 409 || reason.code !== "PUSH_ENDPOINT_CONFLICT")
      throw reason;
    const oldEndpoint = subscription.endpoint;
    if (!(await subscription.unsubscribe())) throw new RequestError("PUSH_UNSUBSCRIBE_FAILED");
    subscription = await manager.subscribe(options);
    if (subscription.endpoint === oldEndpoint) throw new RequestError("PUSH_ENDPOINT_CONFLICT", undefined, 409);
    await save(subscription);
  }
  return subscription;
}
export async function removePushSubscription(
  subscription: Pick<PushSubscription, "endpoint" | "unsubscribe">,
  remove?: (endpoint: string) => Promise<unknown>,
) {
  let failure: { reason: unknown } | undefined;
  try {
    if (remove) await remove(subscription.endpoint);
  } catch (reason) {
    failure = { reason };
  }
  try {
    if (!(await subscription.unsubscribe())) failure ??= { reason: new RequestError("PUSH_UNSUBSCRIBE_FAILED") };
  } catch (reason) {
    failure ??= { reason };
  }
  if (failure) throw failure.reason;
}
export async function cleanupBrowserPush(removeServer = true) {
  try {
    if (!("serviceWorker" in navigator)) return;
    const worker = await navigator.serviceWorker.getRegistration();
    const subscription = await worker?.pushManager?.getSubscription();
    if (subscription)
      await removePushSubscription(
        subscription,
        removeServer
          ? (endpoint) => api("/push/subscriptions/current", { method: "DELETE", body: JSON.stringify({ endpoint }) })
          : undefined,
      );
  } finally {
    localStorage.removeItem("lifesync.push-user");
  }
}
