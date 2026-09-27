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

export function buildTestProgram(
  problem: Problem,
  code: string,
  testIndex: number,
  language = "python",
): LensTestProgram | null {
  if (language === "javascript" || language === "typescript") {
    return buildJsTestProgram(problem, code, testIndex, language);
  }
  const test = problem.tests[testIndex];
  if (!test) return null;

  const fn = problem.functionName.py;
  const args = problem.params.map((param) => param.name).join(", ");
  const expected = `  # expected: ${pyLiteral(test.expected)}`;
  const lines = [`# ── Test ${testIndex + 1}, added by Lens ──`];

  problem.params.forEach((param, index) => {
    lines.push(`${param.name} = ${inputExpression(param.type, test.args[index])}`);
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
    title: `Test ${testIndex + 1}`,
    language: "python",
  };
}

// JavaScript / TypeScript: the test runs in its own block, so its names
// can't clash with anything the user declared.
function buildJsTestProgram(problem: Problem, code: string, testIndex: number, language: string): LensTestProgram | null {
  const test = problem.tests[testIndex];
  if (!test) return null;

  const h = HELPERS.javascript;
  const fn = problem.functionName.js;
  const args = problem.params.map((param) => param.name).join(", ");
  const expected = ` // expected: ${jsLiteral(test.expected)}`;
  const lines = [`// ── Test ${testIndex + 1}, added by Lens ──`, "{"];

  problem.params.forEach((param, index) => {
    lines.push(`  const ${param.name} = ${inputExpression(param.type, test.args[index], h)};`);
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
    title: `Test ${testIndex + 1}`,
    language,
  };
}