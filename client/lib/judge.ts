// Pure helpers for checking test results. No DOM access, so this is safe to
// import anywhere (including server rendering) and easy to unit test.

export type CompareMode = "exact" | "unordered" | "unordered-deep";

// JSON with object keys sorted, so logically equal values produce equal strings.
export function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(",")}}`;
}

function sortDeep(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .map((item) => sortDeep(item))
    .sort((a, b) => {
      const sa = stableStringify(a);
      const sb = stableStringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
}

function canonicalize(value: unknown, mode: CompareMode): unknown {
  if (!Array.isArray(value)) return value;
  if (mode === "unordered-deep") return sortDeep(value);
  if (mode === "unordered") {
    return [...value].sort((a, b) => {
      const sa = stableStringify(a);
      const sb = stableStringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  return value;
}

export function valuesMatch(actual: unknown, expected: unknown, mode: CompareMode = "exact"): boolean {
  return stableStringify(canonicalize(actual, mode)) === stableStringify(canonicalize(expected, mode));
}

// Readable, compact rendering of a JSON-like value: [1, 2], "text", {"a": 1}.
export function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map((v) => formatValue(v)).join(", ")}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record).map((k) => `${JSON.stringify(k)}: ${formatValue(record[k])}`);
  return entries.length > 0 ? `{${entries.join(", ")}}` : "{}";
}