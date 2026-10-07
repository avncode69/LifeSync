import webPush from "web-push";

export function validatePushEndpoint(endpoint: string): true {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("INVALID_PUSH_ENDPOINT");
  }
  const suffixes = [
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "web.push.apple.com",
    "notify.windows.com",
    "wns.windows.com",
  ];
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !suffixes.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
  ) {
    throw new Error("INVALID_PUSH_ENDPOINT");
  }
  return true;
}
export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export async function sendWebPush(
  subscription: PushSubscription,
  notification: { id?: string; title: string; body: string; url: string },
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<"delivered" | "expired"> {
  validatePushEndpoint(subscription.endpoint);
  if (!notification.url.startsWith("/") || notification.url.startsWith("//"))
    throw new Error("INVALID_NOTIFICATION_URL");
  try {
    await webPush.sendNotification(subscription, JSON.stringify(notification), {
      vapidDetails: vapid,
      TTL: 3600,
      timeout: 10000,
    });
    return "delivered";
  } catch (error) {
    if (error instanceof webPush.WebPushError && [404, 410].includes(error.statusCode)) return "expired";
    throw new Error("PUSH_DELIVERY_FAILED", { cause: error });
  }
}
