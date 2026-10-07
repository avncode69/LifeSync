import { expect, it } from "vitest";
import { validatePushEndpoint } from "./push";

it("accepts trusted push services and rejects SSRF destinations", () => {
  expect(validatePushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
  expect(validatePushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
  expect(() => validatePushEndpoint("https://127.0.0.1/admin")).toThrow("INVALID_PUSH_ENDPOINT");
  expect(() => validatePushEndpoint("https://fcm.googleapis.com.evil.test/abc")).toThrow();
});
