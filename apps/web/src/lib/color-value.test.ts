import { describe, expect, it } from "vitest";
import { hexColor } from "./color-value";

describe("user color values", () => {
  it("accepts six-digit colors and normalizes case", () => {
    expect(hexColor("#8b5cF6")).toBe("#8B5CF6");
    expect(hexColor("#000000")).toBe("#000000");
    expect(hexColor("#ffffff")).toBe("#FFFFFF");
  });

  it.each([undefined, null, "", "#fff", "#12345678", "red", "#GGGGGG", " #123456", "#123456; color:red", 123456])(
    "rejects unsupported values before using them in styles (%s)",
    (value) => expect(hexColor(value)).toBeUndefined(),
  );
});
