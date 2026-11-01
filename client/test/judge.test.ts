import { describe, expect, it } from "vitest";
import { formatValue, stableStringify, valuesMatch } from "@/lib/judge";

describe("stableStringify", () => {
  it("writes objects with their keys sorted, at every depth", () => {
    expect(stableStringify({ b: 1, a: { d: [1, { z: 0, y: 1 }], c: null } })).toBe('{"a":{"c":null,"d":[1,{"y":1,"z":0}]},"b":1}');
  });

  it("keeps array order and handles undefined", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
    expect(stableStringify(undefined)).toBe("undefined");
  });
});

describe("valuesMatch", () => {
  it("compares exactly by default, ignoring key order", () => {
    expect(valuesMatch({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(valuesMatch([1, 2], [2, 1])).toBe(false);
    expect(valuesMatch(1, "1")).toBe(false);
    expect(valuesMatch(null, undefined)).toBe(false);
  });

  it("can ignore the order of a list", () => {
    expect(valuesMatch([[1, 2], [3]], [[3], [1, 2]], "unordered")).toBe(true);
    // Only the outer list: the inner lists still have to match exactly.
    expect(valuesMatch([[2, 1], [3]], [[3], [1, 2]], "unordered")).toBe(false);
    expect(valuesMatch([1, 1, 2], [1, 2, 2], "unordered")).toBe(false);
  });

  it("can ignore order at every level", () => {
    expect(valuesMatch([[2, 1], [3]], [[3], [1, 2]], "unordered-deep")).toBe(true);
    expect(valuesMatch([["eat", "tea"], ["bat"]], [["bat"], ["tea", "eat"]], "unordered-deep")).toBe(true);
    expect(valuesMatch([[1, 2]], [[1, 3]], "unordered-deep")).toBe(false);
  });
});

describe("formatValue", () => {
  it("renders values compactly and readably", () => {
    expect(formatValue([1, "a", null])).toBe('[1, "a", null]');
    expect(formatValue({ a: 1, b: [true] })).toBe('{"a": 1, "b": [true]}');
    expect(formatValue({})).toBe("{}");
    expect(formatValue(undefined)).toBe("undefined");
  });
});
