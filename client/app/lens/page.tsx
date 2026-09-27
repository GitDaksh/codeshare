"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { motion } from "framer-motion";
import { Loader2, Play } from "lucide-react";
import { LensPlayer } from "@/components/lens/LensPlayer";
import { defineEditorThemes } from "@/lib/editorTheme";
import { traceCode } from "@/lib/execution";
import { LENS_MAX_STEPS, type LensTrace } from "@/lib/lens";
import { useEditorTheme } from "@/lib/useEditorTheme";

type Example = { id: string; label: string; code: string };
type Language = "python" | "javascript" | "typescript";

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
];

const PYTHON_EXAMPLES: Example[] = [
  {
    id: "linked-list",
    label: "Reverse a linked list",
    code: `class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def reverse(head):
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev


head = ListNode(1, ListNode(2, ListNode(3, ListNode(4))))
head = reverse(head)
`,
  },
  {
    id: "tree",
    label: "Binary search tree",
    code: `class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def insert(root, val):
    if root is None:
        return TreeNode(val)
    if val < root.val:
        root.left = insert(root.left, val)
    else:
        root.right = insert(root.right, val)
    return root


def in_order(node, out):
    if node:
        in_order(node.left, out)
        out.append(node.val)
        in_order(node.right, out)
    return out


root = None
for value in [8, 3, 10, 1, 6, 14]:
    root = insert(root, value)

print(in_order(root, []))
`,
  },
  {
    id: "recursion",
    label: "Recursion",
    code: `def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)


print(factorial(5))
`,
  },
  {
    id: "two-pointers",
    label: "Two pointers",
    code: `def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        if total < target:
            left += 1
        else:
            right -= 1
    return []


print(two_sum_sorted([1, 3, 4, 6, 8, 11], 10))
`,
  },
  {
    id: "hash-map",
    label: "Counting words",
    code: `text = "the quick brown fox jumps over the lazy dog the end"
counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1

top = max(counts, key=counts.get)
print(top, counts[top])
`,
  },
  {
    id: "bfs",
    label: "Breadth-first search",
    code: `from collections import deque

graph = {"A": ["B", "C"], "B": ["D"], "C": ["D", "E"], "D": ["F"], "E": ["F"], "F": []}


def bfs(start):
    seen = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph[node]:
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return order


print(bfs("A"))
`,
  },
];

const JS_EXAMPLES: Example[] = [
  {
    id: "linked-list",
    label: "Reverse a linked list",
    code: `class ListNode {
  constructor(val, next = null) {
    this.val = val;
    this.next = next;
  }
}

function reverse(head) {
  let prev = null;
  while (head) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

let head = null;
for (const value of [4, 3, 2, 1]) {
  head = new ListNode(value, head);
}
head = reverse(head);
`,
  },
  {
    id: "tree",
    label: "Binary search tree",
    code: `class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}

function insert(root, val) {
  if (root === null) {
    return new TreeNode(val);
  }
  if (val < root.val) {
    root.left = insert(root.left, val);
  } else {
    root.right = insert(root.right, val);
  }
  return root;
}

let root = null;
for (const val of [5, 3, 8, 1, 4, 9]) {
  root = insert(root, val);
}
`,
  },
  {
    id: "recursion",
    label: "Recursion",
    code: `function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result = factorial(5);
console.log(result);
`,
  },
  {
    id: "two-pointers",
    label: "Two pointers",
    code: `const nums = [1, 2, 3, 4, 5];
let left = 0;
let right = nums.length - 1;

while (left < right) {
  [nums[left], nums[right]] = [nums[right], nums[left]];
  left++;
  right--;
}

console.log(nums);
`,
  },
  {
    id: "hash-map",
    label: "Counting words",
    code: `const text = "the cat and the hat and the bat";
const counts = new Map();

for (const word of text.split(" ")) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}

console.log(counts);
`,
  },
  {
    id: "bfs",
    label: "Breadth-first search",
    code: `const graph = {
  A: ["B", "C"],
  B: ["D"],
  C: ["D", "E"],
  D: ["F"],
  E: ["F"],
  F: [],
};

function bfs(start) {
  const seen = new Set([start]);
  const queue = [start];
  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(bfs("A"));
`,
  },
];

const TS_EXAMPLES: Example[] = [
  {
    id: "linked-list",
    label: "Reverse a linked list",
    code: `class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function reverse(head: ListNode | null): ListNode | null {
  let prev: ListNode | null = null;
  while (head) {
    const next = head.next;
    head.next = prev;
    prev = head;
    head = next;
  }
  return prev;
}

let head: ListNode | null = null;
for (const value of [4, 3, 2, 1]) {
  head = new ListNode(value, head);
}
head = reverse(head);
`,
  },
  {
    id: "tree",
    label: "Binary search tree",
    code: `class TreeNode {
  left: TreeNode | null = null;
  right: TreeNode | null = null;

  constructor(public val: number) {}
}

function insert(root: TreeNode | null, val: number): TreeNode {
  if (root === null) {
    return new TreeNode(val);
  }
  if (val < root.val) {
    root.left = insert(root.left, val);
  } else {
    root.right = insert(root.right, val);
  }
  return root;
}

let root: TreeNode | null = null;
for (const val of [5, 3, 8, 1, 4, 9]) {
  root = insert(root, val);
}
`,
  },
  {
    id: "recursion",
    label: "Recursion",
    code: `function factorial(n: number): number {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

const result: number = factorial(5);
console.log(result);
`,
  },
  {
    id: "two-pointers",
    label: "Two pointers",
    code: `const nums: number[] = [1, 2, 3, 4, 5];
let left = 0;
let right = nums.length - 1;

while (left < right) {
  [nums[left], nums[right]] = [nums[right], nums[left]];
  left++;
  right--;
}

console.log(nums);
`,
  },
  {
    id: "hash-map",
    label: "Counting words",
    code: `const text = "the cat and the hat and the bat";
const counts = new Map<string, number>();

for (const word of text.split(" ")) {
  counts.set(word, (counts.get(word) ?? 0) + 1);
}

console.log(counts);
`,
  },
  {
    id: "bfs",
    label: "Breadth-first search",
    code: `type Graph = Record<string, string[]>;

const graph: Graph = {
  A: ["B", "C"],
  B: ["D"],
  C: ["D", "E"],
  D: ["F"],
  E: ["F"],
  F: [],
};

function bfs(start: string): string[] {
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    for (const next of graph[node]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

console.log(bfs("A"));
`,
  },
];

const EXAMPLES: Record<Language, Example[]> = {
  python: PYTHON_EXAMPLES,
  javascript: JS_EXAMPLES,
  typescript: TS_EXAMPLES,
};

function handleEditorWillMount(monaco: Monaco) {
  defineEditorThemes(monaco);
}

export default function LensPage() {
  const [themeId] = useEditorTheme();
  const [language, setLanguage] = useState<Language>("python");
  const [exampleId, setExampleId] = useState(PYTHON_EXAMPLES[0].id);
  const [code, setCode] = useState(PYTHON_EXAMPLES[0].code);
  const [mode, setMode] = useState<"edit" | "play">("edit");
  const [running, setRunning] = useState(false);
  const [pythonReady, setPythonReady] = useState(false);
  const [trace, setTrace] = useState<LensTrace | null>(null);
  const [tracedCode, setTracedCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Lens — CodeShare";
  }, []);

  const visualize = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    const result = await traceCode(language, code);
    setRunning(false);
    if (language === "python") setPythonReady(true);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.trace.steps.length === 0) {
      const problem = result.trace.error;
      setError(
        problem
          ? `${problem.message}${problem.line ? ` (line ${problem.line})` : ""}`
          : "There's nothing to show yet. Write some code first.",
      );
      return;
    }
    setTrace(result.trace);
    setTracedCode(code);
    setMode("play");
  }, [code, language, running]);

  // The editor's keyboard shortcut always calls the latest version.
  const visualizeRef = useRef(visualize);
  useEffect(() => {
    visualizeRef.current = visualize;
  }, [visualize]);

  const handleMount: OnMount = (editor, monaco) => {
    // Bracket colors are drawn by the text model, which ignores the editor's
    // bracketPairColorization option, so turn them off on the model itself.
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: { enabled: false, independentColorPoolPerBracketType: false },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      void visualizeRef.current();
    });
  };

  const pickExample = (example: Example) => {
    setExampleId(example.id);
    setCode(example.code);
    setError(null);
    setMode("edit");
  };

  // Switching language keeps you on the same example.
  const pickLanguage = (next: Language) => {
    if (next === language) return;
    const examples = EXAMPLES[next];
    setLanguage(next);
    pickExample(examples.find((example) => example.id === exampleId) ?? examples[0]);
  };

  return (
    <main className="relative min-h-[calc(100dvh-56px)] overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-400">Lens</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
            Watch your code run
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-400 sm:text-base">
            Step through Python, JavaScript or TypeScript one line at a time and see every variable, list, linked list
            and tree drawn as it changes, with arrows for every pointer.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Examples">
          {EXAMPLES[language].map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => pickExample(example)}
              aria-pressed={exampleId === example.id}
              className={
                exampleId === example.id
                  ? "rounded-full border border-ink-300 bg-ink-100 px-3 py-1 text-xs font-medium text-ink-950"
                  : "rounded-full border border-ink-800 px-3 py-1 text-xs font-medium text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-100"
              }
            >
              {example.label}
            </button>
          ))}
        </div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4"
        >
          {mode === "play" && trace ? (
            <LensPlayer code={tracedCode} trace={trace} onEdit={() => setMode("edit")} />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-950">
              <div className="flex items-center justify-between gap-3 border-b border-ink-800 px-4 py-2.5">
                <div className="flex rounded-lg border border-ink-800 p-0.5" role="group" aria-label="Language">
                  {LANGUAGES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => pickLanguage(option.id)}
                      aria-pressed={language === option.id}
                      className={
                        language === option.id
                          ? "rounded-md bg-ink-800 px-2.5 py-1 text-xs font-medium text-ink-100"
                          : "rounded-md px-2.5 py-1 text-xs font-medium text-ink-500 transition-colors hover:text-ink-300"
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void visualize()}
                  disabled={running}
                  title="Visualize (⌘ or Ctrl + Enter)"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70"
                >
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="h-4 w-4" aria-hidden="true" />
                  )}
                  {running ? (language === "python" && !pythonReady ? "Loading Python…" : "Recording…") : "Visualize"}
                </button>
              </div>
              <div className="h-[440px]">
                <Editor
                  height="100%"
                  language={language}
                  theme={themeId}
                  value={code}
                  onChange={(value) => setCode(value ?? "")}
                  beforeMount={handleEditorWillMount}
                  onMount={handleMount}
                  options={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    lineHeight: 22,
                    fontLigatures: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    automaticLayout: true,
                    tabSize: language === "python" ? 4 : 2,
                    renderLineHighlight: "line",
                    // Same as the room editor: no colored brackets (the app is strictly monochrome).
                    bracketPairColorization: { enabled: false },
                    guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
                    smoothScrolling: true,
                    cursorSmoothCaretAnimation: "on",
                    cursorBlinking: "smooth",
                    scrollbar: {
                      verticalScrollbarSize: 10,
                      horizontalScrollbarSize: 10,
                      useShadows: false,
                    },
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    hideCursorInOverviewRuler: true,
                    stickyScroll: { enabled: false },
                    fixedOverflowWidgets: true,
                  }}
                />
              </div>
              {error && (
                <div className="border-t border-ink-800 px-4 py-3">
                  <pre className="whitespace-pre-wrap break-words border-l-2 border-red-500/70 pl-3 font-mono text-xs text-red-300">
                    {error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </motion.div>

        <p className="mt-3 text-xs text-ink-600">
          Lens records up to {LENS_MAX_STEPS.toLocaleString()} steps.
          {language === "python" && " The first Python run downloads Python, which takes a few seconds."}
        </p>
      </div>
    </main>
  );
}