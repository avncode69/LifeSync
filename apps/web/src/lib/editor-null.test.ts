import { describe, expect, it } from "vitest";
import { z } from "zod";
import { omitStoredNull } from "./editor-null";
describe("stored optional nulls in editors", () => {
  it("lets existing uncolored records change color without resubmitting null notes", () => {
    const properties = { description: { type: "string" }, color: { type: "string" } };
    const values = { description: null, color: "#3B82F6" };
    const patch = Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) => !omitStoredNull(value, properties[key as keyof typeof properties], false),
      ),
    );
    expect(z.object({ description: z.string().optional(), color: z.string() }).parse(patch)).toEqual({
      color: "#3B82F6",
    });
  });
  it("preserves an explicitly nullable relation", () =>
    expect(omitStoredNull(null, { anyOf: [{ type: "string" }, { type: "null" }] }, false)).toBe(false));
  it("does not hide invalid required values", () => expect(omitStoredNull(null, { type: "string" }, true)).toBe(false));
});
