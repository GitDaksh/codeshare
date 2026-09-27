// How a program's running time and memory grow with the size of its input.
//
// Big-O can't be read off arbitrary code (in general that's impossible), so
// CodeShare measures it: in a background sandbox, the user's function runs on
// inputs that keep growing, each run is timed (which also counts the hidden
// cost of built-ins like sort() and `in`) and its extra memory is measured,
// and the growth is matched against the usual complexity classes.

import type { Problem, ValueType } from "@/lib/problems";

// ---------- Seeded random inputs (every run and every browser agree) ----------

export type Rand = ReturnType<typeof makeRand>;

export function makeRand(seed = 20260927) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  const ints = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => int(lo, hi));
  const shuffle = <T>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };
  // n different numbers from [lo, hi].
  const distinct = (n: number, lo: number, hi: number) => {
    const seen = new Set<number>();
    const out: number[] = [];
    while (out.length < n) {
      const value = int(lo, hi);
      if (!seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
    return out;
  };
  const text = (n: number, alphabet: string) =>
    Array.from({ length: n }, () => alphabet[int(0, alphabet.length - 1)]).join("");
  return { next, int, ints, shuffle, distinct, text };
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const range = (n: number, start = 0) => Array.from({ length: n }, (_, i) => start + i);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const half = (n: number) => Math.max(1, Math.floor(n / 2));
const side = (cells: number) => Math.max(2, Math.round(Math.sqrt(cells)));
const grid = (cells: number, cell: (i: number, j: number) => number) =>
  range(side(cells)).map((i) => range(side(cells)).map((j) => cell(i, j)));

// A valid bracket string of about n characters, nested as deep as it goes
// (the worst case for the stack a solution keeps).
const nestedBrackets = (n: number) => {
  const open = range(Math.max(1, Math.floor(n / 2))).map((i) => "([{"[i % 3]);
  const close: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  return (
    open.join("") +
    [...open]
      .reverse()
      .map((c) => close[c])
      .join("")
  );
};

const palindrome = (r: Rand, n: number) => {
  const left = r.text(Math.floor(n / 2), LOWER);
  return left + (n % 2 ? "a" : "") + [...left].reverse().join("");
};

// A complete binary search tree in level order (a valid BST of n nodes).
const bst = (n: number) => {
  const values: number[] = new Array(n);
  let next = 0;
  const visit = (i: number) => {
    if (i >= n) return;
    visit(2 * i + 1);
    values[i] = next++;
    visit(2 * i + 2);
  };
  visit(0);
  return values;
};

// Sizes of n: doubling for most inputs, square grids for grids, and small
// steps for inputs whose work explodes (subsets, permutations, n-queens).
export const DOUBLING = [8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
const CELLS = [16, 64, 256, 1024, 4096, 16384, 65536];

// ---------- What gets measured ----------

// How the sandbox builds each argument from its JSON form.
export type Shape = "value" | "list" | "tree" | "lists";

export type MeterCall = { kind: "function"; name: string } | { kind: "method"; name: string };

export type MeterTarget = {
  call: MeterCall;
  // "twoSum(nums, target)"
  label: string;
  // What n means, e.g. "the length of nums".
  n: string;
  shapes: Shape[];
  sizes: number[];
  make: (n: number, r: Rand) => unknown[];
};

export type MeterPlan = { ok: true; target: MeterTarget } | { ok: false; reason: string };

type Recipe = { n: string; make: (n: number, r: Rand) => unknown[]; sizes?: number[] };

// Practice problems: an input of size n that makes each problem do its real
// work (no early exits), e.g. a target that isn't there, a valid bracket
// string, a palindrome.
const RECIPES: Record<string, Recipe> = {
  "two-sum": { n: "the length of nums", make: (n, r) => [r.distinct(n, 0, 4 * n), -1] },
  "valid-parentheses": { n: "the length of s", make: (n) => [nestedBrackets(n)] },
  "valid-anagram": {
    n: "the length of s",
    make: (n, r) => {
      const s = r.text(n, LOWER);
      return [s, r.shuffle([...s]).join("")];
    },
  },
  "binary-search": { n: "the length of nums", make: (n) => [range(n).map((i) => 2 * i), 1] },
  "best-time-to-buy-and-sell-stock": { n: "the number of prices", make: (n, r) => [r.ints(n, 1, 1000)] },
  "valid-palindrome": { n: "the length of s", make: (n, r) => [palindrome(r, n)] },
  "climbing-stairs": { n: "n", make: (n) => [n], sizes: [4, 8, 12, 16, 20, 24, 28, 32, 64, 128, 256, 512, 1024, 2048] },
  "missing-number": {
    n: "the length of nums",
    make: (n, r) => {
      const drop = r.int(0, n);
      return [r.shuffle(range(n + 1).filter((x) => x !== drop))];
    },
  },
  "first-unique-character": {
    n: "the length of s",
    make: (n, r) => {
      const left = [...r.text(half(n), LOWER)];
      return [r.shuffle([...left, ...left]).join("")];
    },
  },
  "roman-to-integer": { n: "the length of s", make: (n) => ["MDCLXVI".repeat(Math.ceil(n / 7)).slice(0, n)] },
  "single-number": {
    n: "the length of nums",
    make: (n, r) => {
      const pairs = half(n);
      const values = r.distinct(pairs + 1, 0, 8 * n);
      return [r.shuffle([...values.slice(0, pairs), ...values.slice(0, pairs), values[pairs]])];
    },
  },
  "counting-bits": { n: "n", make: (n) => [n] },
  "move-zeroes": { n: "the length of nums", make: (n, r) => [r.ints(n, 0, 1).map((b) => (b ? r.int(1, 99) : 0))] },
  "reverse-linked-list": { n: "the number of nodes", make: (n, r) => [r.ints(n, 1, 99)] },
  "merge-two-sorted-lists": {
    n: "the total number of nodes",
    make: (n, r) => [sorted(r.ints(half(n), 0, 1000)), sorted(r.ints(n - half(n), 0, 1000))],
  },
  "maximum-depth-of-binary-tree": { n: "the number of nodes", make: (n, r) => [r.ints(n, 1, 99)] },
  "invert-binary-tree": { n: "the number of nodes", make: (n, r) => [r.ints(n, 1, 99)] },
  "maximum-subarray": { n: "the length of nums", make: (n, r) => [r.ints(n, -100, 100)] },
  "group-anagrams": { n: "the number of words", make: (n, r) => [range(n).map(() => r.text(5, "abcde"))] },
  "longest-substring-without-repeating-characters": { n: "the length of s", make: (n, r) => [r.text(n, LOWER)] },
  "product-of-array-except-self": { n: "the length of nums", make: (n, r) => [r.ints(n, 1, 9)] },
  "top-k-frequent-elements": {
    n: "the length of nums",
    make: (n, r) => [r.ints(n, 0, Math.max(4, Math.floor(n / 4))), 2],
  },
  "three-sum": { n: "the length of nums", make: (n, r) => [r.ints(n, -n, n)] },
  "container-with-most-water": { n: "the number of heights", make: (n, r) => [r.ints(n, 0, 1000)] },
  "longest-consecutive-sequence": { n: "the length of nums", make: (n, r) => [r.distinct(n, 0, 2 * n)] },
  "subarray-sum-equals-k": { n: "the length of nums", make: (n, r) => [r.ints(n, -3, 3), 3] },
  "merge-intervals": {
    n: "the number of intervals",
    make: (n, r) => [
      range(n).map(() => {
        const start = r.int(0, 10 * n);
        return [start, start + r.int(0, 20)];
      }),
    ],
  },
  "insert-interval": {
    n: "the number of intervals",
    make: (n) => [range(n).map((i) => [4 * i, 4 * i + 2]), [2 * n, 2 * n + 5]],
  },
  "search-in-rotated-sorted-array": {
    n: "the length of nums",
    make: (n) => {
      const values = range(n).map((i) => 2 * i);
      const cut = Math.floor(n / 3);
      return [[...values.slice(cut), ...values.slice(0, cut)], 1];
    },
  },
  "daily-temperatures": { n: "the number of days", make: (n, r) => [r.ints(n, 30, 100)] },
  "kth-largest-element-in-an-array": { n: "the length of nums", make: (n, r) => [r.ints(n, -1000, 1000), 2] },
  "coin-change": { n: "the amount", make: (n) => [[1, 2, 5], n] },
  "house-robber": { n: "the number of houses", make: (n, r) => [r.ints(n, 0, 100)] },
  "word-break": {
    n: "the length of s",
    make: (n, r) => {
      const words = ["code", "share", "sea", "co", "de"];
      let s = "";
      while (s.length < n) s += words[r.int(0, words.length - 1)];
      return [s, words];
    },
  },
  subsets: { n: "the length of nums", make: (n) => [range(n)], sizes: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  permutations: { n: "the length of nums", make: (n) => [range(n)], sizes: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  "combination-sum": {
    n: "the target",
    make: (n) => [[2, 3, 5, 7], n],
    sizes: [4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64],
  },
  // All land: one island covering the grid, the worst case for a search.
  "number-of-islands": { n: "the number of cells", make: (n) => [grid(n, () => 1)], sizes: CELLS },
  "rotting-oranges": {
    n: "the number of cells",
    make: (n) => [grid(n, (i, j) => (i === 0 && j === 0 ? 2 : 1))],
    sizes: CELLS,
  },
  "course-schedule": { n: "the number of courses", make: (n) => [n, range(n - 1).map((i) => [i + 1, i])] },
  "number-of-connected-components": {
    n: "the number of nodes",
    make: (n, r) => [n, range(half(n)).map(() => [r.int(0, n - 1), r.int(0, n - 1)])],
  },
  "rotate-image": { n: "the number of cells", make: (n, r) => [grid(n, () => r.int(0, 99))], sizes: CELLS },
  "remove-nth-node-from-end-of-list": { n: "the number of nodes", make: (n, r) => [r.ints(n, 1, 99), 2] },
  "binary-tree-level-order-traversal": { n: "the number of nodes", make: (n, r) => [r.ints(n, 1, 99)] },
  "validate-binary-search-tree": { n: "the number of nodes", make: (n) => [bst(n)] },
  "trapping-rain-water": { n: "the number of bars", make: (n, r) => [r.ints(n, 0, 100)] },
  "largest-rectangle-in-histogram": { n: "the number of bars", make: (n, r) => [r.ints(n, 0, 100)] },
  "sliding-window-maximum": {
    n: "the length of nums (with k = n / 4)",
    make: (n, r) => [r.ints(n, -1000, 1000), Math.max(1, Math.floor(n / 4))],
  },
  "minimum-window-substring": { n: "the length of s", make: (n, r) => [r.text(n, "ABCDEFG"), "ABC"] },
  "median-of-two-sorted-arrays": {
    n: "the total length",
    make: (n, r) => [sorted(r.ints(half(n), 0, 10000)), sorted(r.ints(n - half(n), 0, 10000))],
  },
  "merge-k-sorted-lists": {
    n: "the total number of nodes (in 8 lists)",
    make: (n, r) => [range(8).map(() => sorted(r.ints(Math.max(1, Math.floor(n / 8)), 0, 1000)))],
  },
  "binary-tree-maximum-path-sum": { n: "the number of nodes", make: (n, r) => [r.ints(n, -50, 50)] },
  "word-ladder": {
    n: "the number of words",
    make: (n, r) => {
      const chain = ["baaaa", "bbaaa", "bbbaa", "bbbba", "bbbbb"];
      const filler = range(Math.max(0, n - chain.length)).map(() => r.text(5, "abcde"));
      return ["aaaaa", "bbbbb", r.shuffle([...chain, ...filler])];
    },
  },
  "n-queens": { n: "n", make: (n) => [n], sizes: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  "edit-distance": { n: "the length of each word", make: (n, r) => [r.text(n, LOWER), r.text(n, LOWER)] },
  "regular-expression-matching": {
    n: "the length of s",
    make: (n) => ["ab".repeat(Math.max(1, Math.floor(n / 2))), ".*b"],
  },
};

// ---------- Normal rooms: guess the inputs from the parameter names ----------

type Kind = "ints" | "text" | "int" | "list" | "tree" | "grid" | "texts" | "intervals";

const KIND_BY_NAME: [RegExp, Kind][] = [
  [/^(head\d*|l\d|node)$/i, "list"],
  [/^(root\d*|tree)$/i, "tree"],
  [/^(grid|matrix|board|mat|image|maze)$/i, "grid"],
  [/^(intervals|ranges|meetings)$/i, "intervals"],
  [/^(words|strs|strings|names|tokens|word_?list|dictionary|word_?dict|sentences)$/i, "texts"],
  [
    /^(nums\d*|arr\w*|array|list\d*|lst|a|b|values|vals|numbers|xs|data|items|prices|heights?|costs?|weights|scores|temps|temperatures|stones|piles|candidates|coins|digits_?list)$/i,
    "ints",
  ],
  [/^(s\d*|str|string|text|word\d*|t|pattern|sentence|expr|expression|password|dna|seq)$/i, "text"],
  [/^(n|num|number|x|m|count|size|amount|limit|target|k|steps|total)$/i, "int"],
];

const GROWS: Kind[] = ["ints", "text", "list", "tree", "grid", "texts", "intervals"];

function kindOf(name: string): Kind | null {
  for (const [pattern, kind] of KIND_BY_NAME) if (pattern.test(name)) return kind;
  return null;
}

const DESCRIBE: Record<Kind, (name: string) => string> = {
  ints: (name) => `the length of ${name}`,
  text: (name) => `the length of ${name}`,
  int: (name) => name,
  list: () => "the number of nodes",
  tree: () => "the number of nodes",
  grid: () => "the number of cells",
  texts: (name) => `the number of words in ${name}`,
  intervals: () => "the number of intervals",
};

function grown(kind: Kind, n: number, r: Rand): unknown {
  switch (kind) {
    case "ints":
      // Spread with n, so the values stay mostly distinct.
      return r.ints(n, -4 * n, 4 * n);
    case "text":
      return r.text(n, LOWER);
    case "int":
      return n;
    case "list":
    case "tree":
      return r.ints(n, 1, 99);
    case "grid":
      return grid(n, () => r.int(0, 1));
    case "texts":
      return range(n).map(() => r.text(5, "abcde"));
    case "intervals":
      return range(n).map(() => {
        const start = r.int(0, 10 * n);
        return [start, start + r.int(0, 20)];
      });
  }
}

// Other arguments stay small and fixed. A target that can't be found makes
// searches do their full (worst-case) work.
function fixed(kind: Kind, name: string): unknown {
  switch (kind) {
    case "int":
      return /target/i.test(name) ? 1_000_000_007 : /^k$/i.test(name) ? 2 : 3;
    case "ints":
      return [1, 2, 3];
    case "text":
      return "abc";
    case "list":
    case "tree":
      return [1, 2, 3];
    case "grid":
      return [
        [1, 0],
        [0, 1],
      ];
    case "texts":
      return ["abc", "bca"];
    case "intervals":
      return [[1, 3]];
  }
}

const SHAPE: Partial<Record<Kind | ValueType, Shape>> = { list: "list", tree: "tree", "list[]": "lists" };

type FoundFunction = { name: string; params: string[]; method: boolean };

// The required parameters of a signature (types, self, *args and parameters
// with a default are left out), or null for ones Lens can't fill (destructuring).
function paramNames(signature: string): string[] | null {
  const names: string[] = [];
  let depth = 0;
  let current = "";
  const parts: string[] = [];
  for (const ch of signature) {
    if ("([{<".includes(ch)) depth++;
    if (")]}>".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  if (current.trim()) parts.push(current);
  for (const part of parts) {
    const text = part.trim();
    if (!text || text === "self" || /^(\*|\.\.\.)/.test(text)) continue;
    // A default value or a "?" makes it optional.
    if (/^[\w$]+\s*\?/.test(text) || /(^|[^=!<>])=(?![=>])/.test(text)) continue;
    const name = text.replace(/:[\s\S]*$/, "").trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
    names.push(name);
  }
  return names;
}

// Top-level functions (and the methods of a LeetCode-style class Solution).
function findFunctions(code: string, language: string): FoundFunction[] {
  const found: FoundFunction[] = [];
  const lines = code.split("\n");
  if (language === "python") {
    let inSolution = false;
    for (const line of lines) {
      if (/^class\s+Solution\b/.test(line)) inSolution = true;
      else if (/^\S/.test(line)) inSolution = false;
      const top = /^def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/.exec(line);
      const method = inSolution ? /^\s+def\s+([A-Za-z_]\w*)\s*\(\s*self\s*,?([^)]*)\)/.exec(line) : null;
      const match = top ?? method;
      if (!match || match[1].startsWith("_")) continue;
      const params = paramNames(match[2]);
      if (params) found.push({ name: match[1], params, method: !!method });
    }
    return found;
  }
  let inSolution = false;
  for (const line of lines) {
    if (/^(export\s+)?class\s+Solution\b/.test(line)) inSolution = true;
    else if (/^\}/.test(line)) inSolution = false;
    const top =
      /^(?:export\s+)?(?:async\s+)?function\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/.exec(line) ??
      /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\s*\w*\s*)?\(([^)]*)\)/.exec(
        line,
      );
    const method = inSolution
      ? /^\s+(?:(?:public|static|async)\s+)*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?::[^{]+)?\{/.exec(line)
      : null;
    const match = top ?? method;
    if (!match || match[1] === "constructor" || match[1].startsWith("_")) continue;
    const params = paramNames(match[2]);
    if (params) found.push({ name: match[1], params, method: !!method });
  }
  return found;
}

// The function to measure: a Solution method, else the last function that no
// other function calls (the others are its helpers).
function mainFunction(code: string, found: FoundFunction[]): FoundFunction | null {
  const method = found.find((f) => f.method);
  if (method) return method;
  const called = (name: string) =>
    found.some((other) => {
      if (other.name === name) return false;
      const start = code.search(new RegExp(`(def|function|const|let|var)\\s+${other.name}\\b`));
      const next = found
        .map((f) => code.search(new RegExp(`(def|function|const|let|var)\\s+${f.name}\\b`)))
        .filter((at) => at > start)
        .sort((a, b) => a - b)[0];
      const body = code.slice(start, next ?? code.length);
      return new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(body.slice(body.indexOf("\n")));
    });
  const roots = found.filter((f) => !called(f.name));
  return roots[roots.length - 1] ?? found[found.length - 1] ?? null;
}

export function planMeter(code: string, language: string, problem: Problem | null): MeterPlan {
  if (problem) {
    const name = language === "python" ? problem.functionName.py : problem.functionName.js;
    const recipe = RECIPES[problem.slug];
    const params = problem.params.map((p) => p.name);
    const growAt = problem.params.findIndex((p) => p.type !== "int" && p.type !== "bool" && p.type !== "float");
    const fallback: Recipe = {
      n: growAt >= 0 ? `the size of ${params[growAt]}` : params[0] ? params[0] : "n",
      make: (n, r) =>
        problem.params.map((p, i) =>
          i === Math.max(0, growAt) ? grown(valueKind(p.type), n, r) : problem.tests[0]?.args[i],
        ),
    };
    const chosen = recipe ?? fallback;
    return {
      ok: true,
      target: {
        call: { kind: "function", name },
        label: `${name}(${params.join(", ")})`,
        n: chosen.n,
        shapes: problem.params.map((p) => SHAPE[p.type] ?? "value"),
        sizes: chosen.sizes ?? (problem.params.some((p) => p.type === "int[][]") && !recipe ? CELLS : DOUBLING),
        make: chosen.make,
      },
    };
  }

  const found = findFunctions(code, language);
  const main = mainFunction(code, found);
  if (!main)
    return { ok: false, reason: "Put your code in a function, like solve(nums), and Lens can measure how it grows." };
  if (!main.params.length) {
    return {
      ok: false,
      reason: `${main.name}() takes no input, so there's nothing to grow. Give it a parameter like nums or n.`,
    };
  }
  const kinds = main.params.map(kindOf);
  let growAt = kinds.findIndex((kind) => kind !== null && GROWS.includes(kind));
  if (growAt === -1) growAt = kinds.findIndex((kind) => kind === "int");
  if (growAt === -1) {
    return {
      ok: false,
      reason: `Lens can't tell what ${main.params.join(", ")} should be. Name the input like nums, s, head, root, grid or n.`,
    };
  }
  const growKind = kinds[growAt]!;
  const unknown = main.params.find((_, i) => i !== growAt && kinds[i] === null);
  if (unknown) {
    return { ok: false, reason: `Lens can't tell what ${unknown} should be. Name it like nums, s, k or target.` };
  }
  return {
    ok: true,
    target: {
      call: { kind: main.method ? "method" : "function", name: main.name },
      label: `${main.method ? "Solution." : ""}${main.name}(${main.params.join(", ")})`,
      n: DESCRIBE[growKind](main.params[growAt]),
      shapes: kinds.map((kind) => SHAPE[kind!] ?? "value"),
      sizes: growKind === "grid" ? CELLS : DOUBLING,
      make: (n, r) => kinds.map((kind, i) => (i === growAt ? grown(kind!, n, r) : fixed(kind!, main.params[i]))),
    },
  };
}

function valueKind(type: ValueType): Kind {
  if (type === "str") return "text";
  if (type === "str[]") return "texts";
  if (type === "int[][]") return "grid";
  if (type === "list" || type === "tree") return type;
  if (type === "int") return "int";
  return "ints";
}

// The inputs for every size, as JSON (sent to the sandbox once).
export function meterInputs(target: MeterTarget, seed?: number): [number, unknown[]][] {
  const r = makeRand(seed);
  return target.sizes.map((n) => [n, target.make(n, r)]);
}

// ---------- Fitting the growth ----------

export type GrowthModel = { id: string; label: string; order: number; f: (n: number) => number };

const FACTORIAL = (n: number) => {
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
};

export const MODELS: GrowthModel[] = [
  { id: "1", label: "O(1)", order: 0, f: () => 1 },
  { id: "log", label: "O(log n)", order: 1, f: (n) => Math.log2(n) },
  { id: "sqrt", label: "O(√n)", order: 2, f: (n) => Math.sqrt(n) },
  { id: "n", label: "O(n)", order: 3, f: (n) => n },
  { id: "nlog", label: "O(n log n)", order: 4, f: (n) => n * Math.log2(n) },
  { id: "n2", label: "O(n²)", order: 5, f: (n) => n * n },
  { id: "n3", label: "O(n³)", order: 6, f: (n) => n ** 3 },
  { id: "2n", label: "O(2ⁿ)", order: 7, f: (n) => 2 ** n },
  { id: "fact", label: "O(n!)", order: 8, f: FACTORIAL },
];

const POLYNOMIAL = MODELS.filter((m) => m.order <= 6);

export type Point = { n: number; y: number };

export type Verdict = {
  label: string;
  order: number;
  confidence: "high" | "medium" | "low";
  points: Point[];
  // The fitted curve at the measured sizes, and at any n (for drawing).
  curve: Point[];
  at: (n: number) => number;
};

// y ≈ a + b·f(n), minimising the relative error (weights 1/y²; values
// below "floor" count as floor, so zeros can't dominate).
function fit(points: Point[], f: (n: number) => number, floor: number) {
  let sw = 0,
    swf = 0,
    swff = 0,
    swy = 0,
    swfy = 0;
  for (const { n, y } of points) {
    const w = 1 / Math.max(y, floor) ** 2;
    const x = f(n);
    sw += w;
    swf += w * x;
    swff += w * x * x;
    swy += w * y;
    swfy += w * x * y;
  }
  const det = sw * swff - swf * swf;
  let a = det ? (swff * swy - swf * swfy) / det : swy / sw;
  let b = det ? (sw * swfy - swf * swy) / det : 0;
  if (b < 0) {
    b = 0;
    a = swy / sw;
  } else if (a < 0) {
    a = 0;
    b = swfy / swff;
  }
  const error = Math.sqrt(
    points.reduce((sum, { n, y }) => sum + ((y - (a + b * f(n))) / Math.max(y, floor)) ** 2, 0) / points.length,
  );
  return { a, b, error };
}

// log y as a straight line in x (least squares): the growth rate and how well it fits.
function logLine(points: Point[], x: (n: number) => number, floor: number) {
  const xs = points.map((p) => x(p.n));
  const ys = points.map((p) => Math.log(Math.max(p.y, floor)));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((sum, v) => sum + (v - mx) ** 2, 0);
  const slope = sxx ? xs.reduce((sum, v, i) => sum + (v - mx) * (ys[i] - my), 0) / sxx : 0;
  const error = Math.sqrt(ys.reduce((sum, v, i) => sum + (v - (my + slope * (xs[i] - mx))) ** 2, 0) / ys.length);
  return { at: (n: number) => Math.exp(my + slope * (x(n) - mx)), error, slope };
}

const lnFactorial = (n: number) => {
  let out = 0;
  for (let i = 2; i <= n; i++) out += Math.log(i);
  return out;
};

// The simplest class that explains the growth about as well as the best one.
export function classify(points: Point[], flat: number): Verdict | null {
  if (!points.length) return null;
  const ys = points.map((p) => p.y);
  const maxY = Math.max(...ys);
  const floor = Math.max(maxY * 1e-4, 1e-9);
  const span = points[points.length - 1].n / points[0].n;
  const verdict = (model: GrowthModel, confidence: Verdict["confidence"], at: (n: number) => number): Verdict => ({
    label: model.label,
    order: model.order,
    confidence,
    points,
    curve: points.map(({ n }) => ({ n, y: at(n) })),
    at,
  });
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  // Tiny values, or barely any change across the whole range, is O(1).
  if (points.length < 2 || maxY <= flat || maxY - Math.min(...ys) <= flat / 2) {
    return verdict(MODELS[0], points.length >= 4 && span >= 16 ? "high" : "medium", () => mean);
  }

  // Faster than any polynomial (steeper than n⁴ at the end): 2ⁿ or n!.
  const [a, b] = points.slice(-2);
  const slope = Math.log(Math.max(b.y, floor) / Math.max(a.y, floor)) / Math.log(b.n / a.n);
  if (slope > 4.5 && b.y > flat * 4) {
    const tail = points.filter((p) => p.y > maxY * 1e-3);
    const exp = logLine(tail, (n) => n, floor);
    const fact = logLine(tail, lnFactorial, floor);
    // n! only when it matches n! itself (a scale near 1): a scaled-down
    // log(n!) can mimic plain exponential growth over a short range.
    const factorial = tail.length >= 4 && fact.slope > 0.6 && fact.slope < 1.6 && fact.error < exp.error;
    return verdict(
      MODELS.find((m) => m.id === (factorial ? "fact" : "2n"))!,
      tail.length >= 4 ? "medium" : "low",
      factorial ? fact.at : exp.at,
    );
  }

  // Judge by the largest inputs: at small n, fixed costs (the call itself,
  // setting up a loop) blur the growth.
  const nMax = points[points.length - 1].n;
  const top = points.filter((p) => p.n >= nMax / 64);
  const tail = top.length >= 4 ? top : points.slice(-4);
  const results = POLYNOMIAL.map((model) => ({ model, ...fit(tail, model.f, floor) }));
  const best = results.reduce((x, y) => (y.error < x.error ? y : x));
  const constant = results[0];
  // Hardly any growth over a wide range of n is O(1).
  if (
    constant.error < 0.25 &&
    Math.max(ys[ys.length - 1], ys[ys.length - 2] ?? 0) < 1.8 * Math.min(ys[0], ys[1] ?? ys[0])
  ) {
    return verdict(MODELS[0], span >= 16 ? "high" : "medium", () => mean);
  }
  const tailSpan = tail[tail.length - 1].n / tail[0].n;
  const pick =
    results
      .filter((r) => r.model.order <= best.model.order && (r.b > 0 || r.model.order === 0))
      .filter((r) => r.error <= best.error * 1.5 + 0.06)
      .sort((x, y) => x.model.order - y.model.order)[0] ?? best;
  const rival = results.filter((r) => r.model.order !== pick.model.order).reduce((x, y) => (y.error < x.error ? y : x));
  const confidence =
    tail.length >= 4 && tailSpan >= 16 && pick.error < 0.2 && rival.error > pick.error * 1.5 + 0.02
      ? "high"
      : tail.length >= 3 && pick.error < 0.35
        ? "medium"
        : "low";
  return verdict(pick.model, confidence, (n) => pick.a + pick.b * pick.model.f(n));
}

// The measured points drawn against a particular class.
function verdictAs(points: Point[], id: string, confidence: Verdict["confidence"]): Verdict {
  const model = MODELS.find((m) => m.id === id)!;
  const floor = Math.max(Math.max(...points.map((p) => p.y)) * 1e-4, 1e-9);
  const { a, b } = fit(points, model.f, floor);
  const at = (n: number) => a + b * model.f(n);
  return {
    label: model.label,
    order: model.order,
    confidence,
    points,
    curve: points.map(({ n }) => ({ n, y: at(n) })),
    at,
  };
}

// ---------- Results ----------

export type RawMeasurement = {
  // [n, milliseconds per call]
  time: [number, number][];
  // [n, extra memory (bytes in Python, slots in JavaScript), deepest
  // recursion, lines/statements run]
  space: [number, number, number, number][];
  error: { n: number; message: string } | null;
  // How the sizes ended: "done", "slow" (next size would take too long), "limit".
  stopped?: string;
};

export type MeterResult =
  | {
      status: "ok";
      label: string;
      n: string;
      time: Verdict;
      // Null when memory couldn't be measured.
      space: Verdict | null;
      // Which part of the memory decides the space complexity.
      spaceFrom: "memory" | "recursion";
      sizes: [number, number];
      note: string | null;
    }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

export function summarize(raw: RawMeasurement, target: MeterTarget, language: string, code: string): MeterResult {
  const missing = raw.error?.message.includes("__missing__");
  if (missing) {
    return { status: "error", message: `Couldn't find ${target.label.split("(")[0]} in your code.` };
  }
  if (!raw.time.length) {
    return {
      status: "error",
      message: raw.error ? `Your code crashed: ${raw.error.message}` : "Lens couldn't measure this code.",
    };
  }
  const timed = classify(
    raw.time.map(([n, y]) => ({ n, y })),
    0,
  )!;
  // Exact step counts see through the cost of the call itself, so a small
  // O(log n) isn't mistaken for O(1); timing sees built-ins (sort, in, …).
  const counted = classify(
    raw.space.map(([n, , , steps]) => ({ n, y: steps })),
    4,
  );
  let time = timed;
  const sorts = /\.sort\s*\(|\bsorted\s*\(|\.toSorted\s*\(/.test(code);
  // Other built-ins that add a log factor: heaps and binary search.
  const logFactor = sorts || /heapq|heappush|heappop|heapify|PriorityQueue|bisect|insort/.test(code);
  if (counted && counted.order <= 6) {
    if (counted.order > timed.order) time = counted;
    // n log n by the clock, at most n by exact count, and nothing that adds a
    // log factor: that's the engine slowing down on big inputs (caches, deep
    // stacks, big hash tables), not the algorithm.
    else if (timed.label === "O(n log n)" && counted.order <= 3 && !logFactor) {
      time = verdictAs(timed.points, "n", "medium");
    }
  }
  // A sort costs n log n even when fast built-in code hides it at these sizes.
  let sorted = false;
  if (sorts && time.label === "O(n)") {
    time = verdictAs(time.points, "nlog", "medium");
    sorted = true;
  }
  const memory = classify(
    raw.space.map(([n, y]) => ({ n, y })),
    language === "python" ? 1024 : 8,
  );
  const depth = classify(
    raw.space.map(([n, , d]) => ({ n, y: d })),
    3,
  );
  const fromRecursion = !!depth && (!memory || depth.order > memory.order);
  const space = (fromRecursion ? depth : memory) ?? null;
  const sizes: [number, number] = [raw.time[0][0], raw.time[raw.time.length - 1][0]];
  const note = sorted
    ? "It sorts, and sorting costs O(n log n), even though fast built-in code hides it at these sizes."
    : raw.error
      ? /Recursion|call stack/i.test(raw.error.message)
        ? `At n = ${raw.error.n.toLocaleString()} the recursion got too deep, so Lens stopped there.`
        : `At n = ${raw.error.n.toLocaleString()} your code crashed (${raw.error.message}), so Lens stopped there.`
      : raw.stopped === "slow" && sizes[1] < target.sizes[target.sizes.length - 1]
        ? `Lens stopped at n = ${sizes[1].toLocaleString()}: bigger inputs would take too long.`
        : null;
  return {
    status: "ok",
    label: target.label,
    n: target.n,
    time,
    space,
    spaceFrom: fromRecursion ? "recursion" : "memory",
    sizes,
    note,
  };
}