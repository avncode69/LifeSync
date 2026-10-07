import { describe, expect, it } from "vitest";
import { parseCursor, publicError, requireMutationOrigin } from "../src/security";

describe("API boundary", () => {
  it("rejects foreign and missing origins on writes", () => {
    expect(() => requireMutationOrigin("POST", "https://evil.test", "https://app.test")).toThrow();
    expect(() => requireMutationOrigin("DELETE", null, "https://app.test")).toThrow();
    expect(() => requireMutationOrigin("POST", "https://app.test", "https://app.test")).not.toThrow();
    expect(() => requireMutationOrigin("GET", null, "https://app.test")).not.toThrow();
  });
  it("never exposes SQL or secrets in unexpected errors", () => {
    expect(JSON.stringify(publicError(new Error("password=secret SQL"), "r1"))).not.toContain("secret");
    expect(publicError(new Error("SQL"), "r1").error.requestId).toBe("r1");
  });
  it("rejects malformed pagination cursors", () => {
    expect(() => parseCursor("' OR 1=1")).toThrow();
    expect(parseCursor("550e8400-e29b-41d4-a716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
