import { formatValue, type CompareMode } from "@/lib/judge";
import { EASY_PROBLEMS } from "@/lib/problemSet/easy";
import { EASY_PROBLEMS_2 } from "@/lib/problemSet/easy2";
import { HARD_PROBLEMS } from "@/lib/problemSet/hard";
import { HARD_PROBLEMS_2 } from "@/lib/problemSet/hard2";
import { MEDIUM_PROBLEMS } from "@/lib/problemSet/medium";
import { MEDIUM_PROBLEMS_2 } from "@/lib/problemSet/medium2";

export type Difficulty = "Easy" | "Medium" | "Hard";

// A tiny type language used to generate starter code for every language and
// to tell the test runner how to build inputs and read results.
export type ValueType =
  | "int"
  | "int[]"
  | "int[][]"
  | "float"
  | "str"
  | "str[]"
  | "str[][]"
  | "bool"
  // A singly linked list, written as an array of its values: [1, 2, 3].
  | "list"
  // Several linked lists: [[1, 4], [2]].
  | "list[]"
  // A binary tree in level order, with null for a missing child: [1, null, 2].
  | "tree";

export type ProblemTest = {
  args: unknown[];
  expected: unknown;
  // Examples are shown in the problem statement as well as run as tests.
  example?: boolean;
  explanation?: string;
};

export type Problem = {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  summary: string;
  description: string[];
  constraints: string[];
  hint: string;
  functionName: { js: string; py: string };
  params: { name: string; type: ValueType }[];
  // "void" means the function changes an argument in place; outputArg says
  // which one the tests check afterwards.
  returns: ValueType | "void";
  outputArg?: number;
  compare?: CompareMode;
  tests: ProblemTest[];
};

// Tests run in the browser, so only languages we can execute there are testable.
export const TESTABLE_LANGUAGES = ["javascript", "typescript", "python"] as const;

export function isTestableLanguage(language: string): boolean {
  return (TESTABLE_LANGUAGES as readonly string[]).includes(language);
}

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

// The problems, split into files by difficulty (the originals, then the
// second set). Each file is a plain list; the order here is the order in the
// Practice list, so new problems go at the end of their difficulty.
export const PROBLEMS: Problem[] = [
  ...EASY_PROBLEMS,
  ...EASY_PROBLEMS_2,
  ...MEDIUM_PROBLEMS,
  ...MEDIUM_PROBLEMS_2,
  ...HARD_PROBLEMS,
  ...HARD_PROBLEMS_2,
];

export const TOPICS: string[] = Array.from(new Set(PROBLEMS.flatMap((p) => p.topics))).sort();

export function getProblem(slug: string): Problem | null {
  return PROBLEMS.find((p) => p.slug === slug) ?? null;
}

export function getAdjacentProblems(slug: string): { previous: Problem | null; next: Problem | null } {
  const index = PROBLEMS.findIndex((p) => p.slug === slug);
  return {
    previous: index > 0 ? PROBLEMS[index - 1] : null,
    next: index >= 0 && index < PROBLEMS.length - 1 ? PROBLEMS[index + 1] : null,
  };
}

export function functionNameFor(problem: Problem, language: string): string {
  return language === "python" ? problem.functionName.py : problem.functionName.js;
}

export function exampleTests(problem: Problem): ProblemTest[] {
  return problem.tests.filter((t) => t.example);
}

// "nums = [2, 7, 11, 15], target = 9"
export function formatArgs(problem: Problem, args: unknown[]): string {
  return problem.params.map((param, i) => `${param.name} = ${formatValue(args[i])}`).join(", ");
}

// ---------- Starter code ----------

function tsType(type: ValueType | "void"): string {
  switch (type) {
    case "int":
    case "float":
      return "number";
    case "int[]":
      return "number[]";
    case "int[][]":
      return "number[][]";
    case "str":
      return "string";
    case "str[]":
      return "string[]";
    case "str[][]":
      return "string[][]";
    case "bool":
      return "boolean";
    case "list":
      return "ListNode | null";
    case "list[]":
      return "Array<ListNode | null>";
    case "tree":
      return "TreeNode | null";
    case "void":
      return "void";
  }
}

function pyType(type: ValueType | "void"): string {
  switch (type) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "int[]":
      return "list[int]";
    case "int[][]":
      return "list[list[int]]";
    case "str":
      return "str";
    case "str[]":
      return "list[str]";
    case "str[][]":
      return "list[list[str]]";
    case "bool":
      return "bool";
    case "list":
      return "ListNode | None";
    case "list[]":
      return "list[ListNode | None]";
    case "tree":
      return "TreeNode | None";
    case "void":
      return "None";
  }
}

// A harmless placeholder return value, so the starter code runs (and the
// tests report "wrong answer" rather than crashing).
function placeholder(type: ValueType, language: "js" | "py"): string {
  if (type === "list" || type === "tree") return language === "py" ? "None" : "null";
  if (type.endsWith("[]")) return "[]";
  if (type === "str") return '""';
  if (type === "bool") return language === "py" ? "False" : "false";
  if (type === "float") return language === "py" ? "0.0" : "0";
  return "0";
}

const NODE_CLASSES: Record<"javascript" | "typescript" | "python", { list: string; tree: string }> = {
  javascript: {
    list: [
      "// A linked list node. The tests build their lists from this class.",
      "class ListNode {",
      "  constructor(val = 0, next = null) {",
      "    this.val = val;",
      "    this.next = next;",
      "  }",
      "}",
    ].join("\n"),
    tree: [
      "// A binary tree node. The tests build their trees from this class.",
      "class TreeNode {",
      "  constructor(val = 0, left = null, right = null) {",
      "    this.val = val;",
      "    this.left = left;",
      "    this.right = right;",
      "  }",
      "}",
    ].join("\n"),
  },
  typescript: {
    list: [
      "// A linked list node. The tests build their lists from this class.",
      "class ListNode {",
      "  val: number;",
      "  next: ListNode | null;",
      "  constructor(val = 0, next: ListNode | null = null) {",
      "    this.val = val;",
      "    this.next = next;",
      "  }",
      "}",
    ].join("\n"),
    tree: [
      "// A binary tree node. The tests build their trees from this class.",
      "class TreeNode {",
      "  val: number;",
      "  left: TreeNode | null;",
      "  right: TreeNode | null;",
      "  constructor(val = 0, left: TreeNode | null = null, right: TreeNode | null = null) {",
      "    this.val = val;",
      "    this.left = left;",
      "    this.right = right;",
      "  }",
      "}",
    ].join("\n"),
  },
  python: {
    list: [
      "# A linked list node. The tests build their lists from this class.",
      "class ListNode:",
      "    def __init__(self, val=0, next=None):",
      "        self.val = val",
      "        self.next = next",
    ].join("\n"),
    tree: [
      "# A binary tree node. The tests build their trees from this class.",
      "class TreeNode:",
      "    def __init__(self, val=0, left=None, right=None):",
      "        self.val = val",
      "        self.left = left",
      "        self.right = right",
    ].join("\n"),
  },
};

// The node class definitions a problem's starter code needs, if any.
function nodeClasses(problem: Problem, language: "javascript" | "typescript" | "python"): string {
  const types: string[] = [...problem.params.map((p) => p.type), problem.returns];
  const blocks: string[] = [];
  if (types.includes("list") || types.includes("list[]")) blocks.push(NODE_CLASSES[language].list);
  if (types.includes("tree")) blocks.push(NODE_CLASSES[language].tree);
  if (blocks.length === 0) return "";
  const gap = language === "python" ? "\n\n\n" : "\n\n";
  return blocks.join(gap) + gap;
}

export function getProblemStarterCode(problem: Problem, language: string): string | null {
  const header = `${problem.title}: the full problem is in the Problem tab.`;
  const inPlace = problem.returns === "void";

  if (language === "javascript") {
    const doc = [
      "/**",
      ...problem.params.map((p) => ` * @param {${tsType(p.type)}} ${p.name}`),
      ` * @return {${tsType(problem.returns)}}`,
      " */",
    ].join("\n");
    const params = problem.params.map((p) => p.name).join(", ");
    const body =
      problem.returns === "void"
        ? "  // Change the input in place. There's no need to return anything.\n"
        : `  // Write your solution here.\n  return ${placeholder(problem.returns, "js")};\n`;
    return `// ${header}\n\n${nodeClasses(problem, "javascript")}${doc}\nfunction ${problem.functionName.js}(${params}) {\n${body}}\n`;
  }

  if (language === "typescript") {
    const params = problem.params.map((p) => `${p.name}: ${tsType(p.type)}`).join(", ");
    const body =
      problem.returns === "void"
        ? "  // Change the input in place. There's no need to return anything.\n"
        : `  // Write your solution here.\n  return ${placeholder(problem.returns, "js")};\n`;
    return `// ${header}\n\n${nodeClasses(problem, "typescript")}function ${problem.functionName.js}(${params}): ${tsType(problem.returns)} {\n${body}}\n`;
  }

  if (language === "python") {
    const params = problem.params.map((p) => `${p.name}: ${pyType(p.type)}`).join(", ");
    const body = inPlace
      ? "    # Change the input in place. There's no need to return anything.\n    pass\n"
      : `    # Write your solution here.\n    return ${placeholder(problem.returns as ValueType, "py")}\n`;
    return `# ${header}\n\n${nodeClasses(problem, "python")}def ${problem.functionName.py}(${params}) -> ${pyType(problem.returns)}:\n${body}`;
  }

  return null;
}