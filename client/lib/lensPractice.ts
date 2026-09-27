import type { Problem, ValueType } from "@/lib/problems";

// "Visualize this test": the user's code, plus a few lines at the end that
// build the test's input and call their function. The helpers used by those
// lines (building a linked list or tree, reading a result back) are defined
// by the setup code, which runs first without being recorded. Nodes are
// built with the user's own ListNode / TreeNode class when their code
// defines one, exactly like the test runner does.

// Plain text: no backticks or "${" (String.raw keeps it exactly as written).
export const LENS_TEST_SETUP_PY = String.raw`def _lens_fallback_classes():
    class ListNode:
        def __init__(self, val=0, next=None):
            self.val = val
            self.next = next

    class TreeNode:
        def __init__(self, val=0, left=None, right=None):
            self.val = val
            self.left = left
            self.right = right

    return ListNode, TreeNode


_LensListNode, _LensTreeNode = _lens_fallback_classes()


def _lens_node(name, fallback, links, value):
    cls = globals().get(name)
    if isinstance(cls, type):
        try:
            node = cls(value)
            node.val = value
            for link in links:
                setattr(node, link, None)
            return node
        except BaseException:
            pass
    return fallback(value)


def lens_list(values):
    head = None
    tail = None
    for value in values:
        node = _lens_node("ListNode", _LensListNode, ("next",), value)
        if tail is None:
            head = node
        else:
            tail.next = node
        tail = node
    return head


def lens_tree(values):
    if not values or values[0] is None:
        return None
    make = lambda value: _lens_node("TreeNode", _LensTreeNode, ("left", "right"), value)
    root = make(values[0])
    queue = [root]
    head = 0
    i = 1
    while i < len(values) and head < len(queue):
        node = queue[head]
        head += 1
        if i < len(values):
            if values[i] is not None:
                node.left = make(values[i])
                queue.append(node.left)
            i += 1
        if i < len(values):
            if values[i] is not None:
                node.right = make(values[i])
                queue.append(node.right)
            i += 1
    return root


def lens_values(head):
    out = []
    seen = set()
    while head is not None and id(head) not in seen and len(out) < 10000:
        seen.add(id(head))
        out.append(getattr(head, "val", None))
        head = getattr(head, "next", None)
    return out


def lens_values_each(heads):
    return [lens_values(head) for head in heads]


def lens_tree_values(root):
    if root is None:
        return []
    out = []
    queue = [root]
    head = 0
    while head < len(queue) and len(out) < 10000:
        node = queue[head]
        head += 1
        if node is None:
            out.append(None)
            continue
        out.append(getattr(node, "val", None))
        queue.append(getattr(node, "left", None))
        queue.append(getattr(node, "right", None))
    while out and out[-1] is None:
        out.pop()
    return out
`;

// The same helpers for JavaScript and TypeScript. They run outside the
// recorded code, and __lens.q keeps the user's constructors (which are
// recorded) quiet while an input is being built.
export const LENS_TEST_SETUP_JS = String.raw`class ListNode {
  constructor(val = 0, next = null) {
    this.val = val;
    this.next = next;
  }
}

class TreeNode {
  constructor(val = 0, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

function lensNode(name, links, value) {
  const Cls = __lens.u(name);
  if (typeof Cls === "function") {
    try {
      const node = new Cls(value);
      node.val = value;
      for (const link of links) node[link] = null;
      return node;
    } catch (e) {}
  }
  return name === "ListNode" ? new ListNode(value) : new TreeNode(value);
}

function lensList(values) {
  return __lens.q(() => {
    let head = null;
    let tail = null;
    for (const value of values) {
      const node = lensNode("ListNode", ["next"], value);
      if (tail === null) head = node;
      else tail.next = node;
      tail = node;
    }
    return head;
  });
}

function lensTree(values) {
  return __lens.q(() => {
    if (!values.length || values[0] === null) return null;
    const make = (value) => lensNode("TreeNode", ["left", "right"], value);
    const root = make(values[0]);
    const queue = [root];
    let head = 0;
    let i = 1;
    while (i < values.length && head < queue.length) {
      const node = queue[head++];
      if (i < values.length) {
        if (values[i] !== null) {
          node.left = make(values[i]);
          queue.push(node.left);
        }
        i++;
      }
      if (i < values.length) {
        if (values[i] !== null) {
          node.right = make(values[i]);
          queue.push(node.right);
        }
        i++;
      }
    }
    return root;
  });
}

function lensValues(head) {
  return __lens.q(() => {
    const out = [];
    const seen = new Set();
    while (head !== null && head !== undefined && !seen.has(head) && out.length < 10000) {
      seen.add(head);
      out.push(head.val);
      head = head.next;
    }
    return out;
  });
}

function lensValuesEach(heads) {
  return heads.map(lensValues);
}

function lensTreeValues(root) {
  return __lens.q(() => {
    if (root === null || root === undefined) return [];
    const out = [];
    const queue = [root];
    let head = 0;
    while (head < queue.length && out.length < 10000) {
      const node = queue[head++];
      if (node === null || node === undefined) {
        out.push(null);
        continue;
      }
      out.push(node.val);
      queue.push(node.left ?? null, node.right ?? null);
    }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  });
}
`;

// A JSON test value written as Python source.
export function pyLiteral(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "None";
  // JSON string literals are valid Python string literals.
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pyLiteral).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => `${JSON.stringify(key)}: ${pyLiteral(item)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  return "None";
}

// A JSON test value written as JavaScript source.
export function jsLiteral(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jsLiteral).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => `${JSON.stringify(key)}: ${jsLiteral(item)}`,
    );
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return "null";
}

const HELPERS = {
  python: {
    literal: pyLiteral,
    list: "lens_list",
    tree: "lens_tree",
    values: "lens_values",
    valuesEach: "lens_values_each",
    treeValues: "lens_tree_values",
  },
  javascript: {
    literal: jsLiteral,
    list: "lensList",
    tree: "lensTree",
    values: "lensValues",
    valuesEach: "lensValuesEach",
    treeValues: "lensTreeValues",
  },
};

type Helpers = (typeof HELPERS)["python"];

function inputExpression(type: ValueType, value: unknown, h: Helpers = HELPERS.python): string {
  if (type === "list") return `${h.list}(${h.literal(value)})`;
  if (type === "list[]" && Array.isArray(value)) {
    return `[${value.map((item) => `${h.list}(${h.literal(item)})`).join(", ")}]`;
  }
  if (type === "tree") return `${h.tree}(${h.literal(value)})`;
  return h.literal(value);
}

function outputExpression(type: ValueType | "void" | undefined, name: string, h: Helpers = HELPERS.python): string {
  if (type === "list") return `${h.values}(${name})`;
  if (type === "list[]") return `${h.valuesEach}(${name})`;
  if (type === "tree") return `${h.treeValues}(${name})`;
  return name;
}

export type LensTestProgram = { code: string; setup: string; title: string; language: string };

// What a Practice room visualizes: one of the problem's tests, the user's own
// input, or just their code as it is.
export type LensChoice = { kind: "test"; index: number } | { kind: "custom"; args: unknown[] } | { kind: "code" };

type ProgramSpec = { args: unknown[]; expected?: { value: unknown }; heading: string; title: string };

function pythonProgram(problem: Problem, code: string, spec: ProgramSpec): LensTestProgram {
  const fn = problem.functionName.py;
  const args = problem.params.map((param) => param.name).join(", ");
  const expected = spec.expected ? `  # expected: ${pyLiteral(spec.expected.value)}` : "";
  const lines = [`# ── ${spec.heading} ──`];

  problem.params.forEach((param, index) => {
    lines.push(`${param.name} = ${inputExpression(param.type, spec.args[index])}`);
  });

  if (problem.returns === "void") {
    // In-place problems: call, then show the argument the tests check.
    const target = problem.params[problem.outputArg ?? 0];
    lines.push(`${fn}(${args})`);
    lines.push(`print(${target ? outputExpression(target.type, target.name) : "None"})${expected}`);
  } else {
    lines.push(`result = ${fn}(${args})`);
    lines.push(`print(${outputExpression(problem.returns, "result")})${expected}`);
  }

  // The user's lines keep their numbers; the test goes underneath.
  const base = code.replace(/\s+$/, "");
  return {
    code: `${base}\n\n\n${lines.join("\n")}\n`,
    setup: LENS_TEST_SETUP_PY,
    title: spec.title,
    language: "python",
  };
}

// JavaScript / TypeScript: the test runs in its own block, so its names
// can't clash with anything the user declared.
function scriptProgram(problem: Problem, code: string, spec: ProgramSpec, language: string): LensTestProgram {
  const h = HELPERS.javascript;
  const fn = problem.functionName.js;
  const args = problem.params.map((param) => param.name).join(", ");
  const expected = spec.expected ? ` // expected: ${jsLiteral(spec.expected.value)}` : "";
  const lines = [`// ── ${spec.heading} ──`, "{"];

  problem.params.forEach((param, index) => {
    lines.push(`  const ${param.name} = ${inputExpression(param.type, spec.args[index], h)};`);
  });

  if (problem.returns === "void") {
    const target = problem.params[problem.outputArg ?? 0];
    lines.push(`  ${fn}(${args});`);
    lines.push(`  console.log(${target ? outputExpression(target.type, target.name, h) : "undefined"});${expected}`);
  } else {
    lines.push(`  const result = ${fn}(${args});`);
    lines.push(`  console.log(${outputExpression(problem.returns, "result", h)});${expected}`);
  }
  lines.push("}");

  const base = code.replace(/\s+$/, "");
  return {
    code: `${base}\n\n\n${lines.join("\n")}\n`,
    setup: LENS_TEST_SETUP_JS,
    title: spec.title,
    language,
  };
}

function buildProgram(problem: Problem, code: string, language: string, spec: ProgramSpec): LensTestProgram {
  return language === "javascript" || language === "typescript"
    ? scriptProgram(problem, code, spec, language)
    : pythonProgram(problem, code, spec);
}

export function buildTestProgram(
  problem: Problem,
  code: string,
  testIndex: number,
  language = "python",
): LensTestProgram | null {
  const test = problem.tests[testIndex];
  if (!test) return null;
  return buildProgram(problem, code, language, {
    args: test.args,
    expected: { value: test.expected },
    heading: `Test ${testIndex + 1}, added by Lens`,
    title: `Test ${testIndex + 1}`,
  });
}

// The user's own input (already checked by parseCustomArgs).
export function buildCustomProgram(problem: Problem, code: string, args: unknown[], language = "python"): LensTestProgram {
  return buildProgram(problem, code, language, { args, heading: "Custom input, added by Lens", title: "Custom input" });
}

export function buildChoiceProgram(
  problem: Problem,
  code: string,
  choice: LensChoice,
  language = "python",
): LensTestProgram | null {
  if (choice.kind === "test") return buildTestProgram(problem, code, choice.index, language);
  if (choice.kind === "custom") return buildCustomProgram(problem, code, choice.args, language);
  return { code, setup: "", title: "", language };
}

// The test to show by default: the first one that failed in the last test
// run (that's the one worth debugging), otherwise Test 1.
export function defaultChoice(report: { results: { status: string }[] } | null): { kind: "test"; index: number } {
  const failing = report ? report.results.findIndex((r) => r.status === "failed" || r.status === "error") : -1;
  return { kind: "test", index: failing >= 0 ? failing : 0 };
}

// A session's title says what it shows ("Test 2", "Custom input", "" for
// just the code, or the call the user typed).
export function choiceLabel(title: string): { label: string; index: number | null } {
  const test = /^Test (\d+)$/.exec(title);
  if (test) return { label: title, index: Number(test[1]) - 1 };
  if (title === "Custom input") return { label: title, index: null };
  if (title === "") return { label: "Just my code", index: null };
  return { label: "Your call", index: null };
}

// ---------- Custom input ----------

const MAX_ARG_CHARS = 5000;

const TYPE_HINTS: Record<ValueType, { words: string; example: string }> = {
  int: { words: "a whole number", example: "5" },
  float: { words: "a number", example: "2.5" },
  str: { words: "text in quotes", example: '"hello"' },
  bool: { words: "true or false", example: "true" },
  "int[]": { words: "a list of whole numbers", example: "[1, 2, 3]" },
  "int[][]": { words: "a list of lists of whole numbers", example: "[[1, 2], [3, 4]]" },
  "str[]": { words: "a list of strings", example: '["a", "b"]' },
  "str[][]": { words: "a list of lists of strings", example: '[["a", "b"], ["c"]]' },
  list: { words: "a linked list, written as a list", example: "[1, 2, 3]" },
  "list[]": { words: "a list of linked lists", example: "[[1, 4], [2, 3]]" },
  tree: { words: "a tree in level order (null for a missing child)", example: "[1, 2, 3, null, 4]" },
};

const isInt = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const isStr = (v: unknown) => typeof v === "string";
const listOf = (v: unknown, check: (item: unknown) => boolean) => Array.isArray(v) && v.every(check);

function fitsType(value: unknown, type: ValueType): boolean {
  switch (type) {
    case "int":
      return isInt(value);
    case "float":
      return typeof value === "number" && Number.isFinite(value);
    case "str":
      return isStr(value);
    case "bool":
      return typeof value === "boolean";
    case "int[]":
    case "list":
      return listOf(value, isInt);
    case "int[][]":
    case "list[]":
      return listOf(value, (row) => listOf(row, isInt));
    case "str[]":
      return listOf(value, isStr);
    case "str[][]":
      return listOf(value, (row) => listOf(row, isStr));
    case "tree":
      return listOf(value, (item) => item === null || isInt(item));
  }
}

// JSON, plus Python spellings (None, True, False, 'single quotes'), so the
// same box works in every language.
function readLiteral(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    // Fall through to the Python spellings.
  }
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        // JSON has no \' escape: inside single quotes it's just a quote.
        const next = text[i + 1] ?? "";
        out += next === "'" ? "'" : ch + next;
        i++;
      } else if (ch === quote) {
        out += '"';
        quote = null;
      } else {
        out += ch === '"' ? '\\"' : ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += '"';
      continue;
    }
    const word = /^(None|True|False)\b/.exec(text.slice(i));
    if (word && !/[\w$]/.test(text[i - 1] ?? "")) {
      out += word[1] === "None" ? "null" : word[1] === "True" ? "true" : "false";
      i += word[1].length - 1;
      continue;
    }
    out += ch;
  }
  try {
    return { ok: true, value: JSON.parse(out) };
  } catch {
    return { ok: false };
  }
}

// Each argument as text for the custom-input boxes, e.g. "[1, 2, 3]".
export function formatArgs(args: unknown[]): string[] {
  return args.map((arg) => jsLiteral(arg));
}

export function parseCustomArgs(
  problem: Problem,
  texts: string[],
): { ok: true; args: unknown[] } | { ok: false; errors: (string | null)[] } {
  const args: unknown[] = [];
  const errors = problem.params.map((param, index) => {
    const text = (texts[index] ?? "").trim();
    const hint = TYPE_HINTS[param.type];
    if (!text) return "Enter a value.";
    if (text.length > MAX_ARG_CHARS) return `That's too long for Lens (${MAX_ARG_CHARS.toLocaleString()} characters max).`;
    const read = readLiteral(text);
    if (!read.ok) return `Lens couldn't read that. Write it like ${hint.example}.`;
    if (!fitsType(read.value, param.type)) return `${param.name} should be ${hint.words}, like ${hint.example}.`;
    args[index] = read.value;
    return null;
  });
  return errors.some((error) => error !== null) ? { ok: false, errors } : { ok: true, args };
}