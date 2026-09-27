// Lens: what to do when a recording shows nothing happening.
//
// A solution file only *defines* functions. Nothing calls them, so recording
// it shows just the definitions. Lens spots that ("idle"), lists what could
// be called, and builds a program that adds one call at the end, for that
// run only (the user's code isn't changed).

import type { LensObject, LensTrace } from "@/lib/lens";
import { LENS_TEST_SETUP_JS, LENS_TEST_SETUP_PY, type LensTestProgram } from "@/lib/lensPractice";

export type LensCallable = {
  name: string;
  // What the user sees, e.g. "mergeSort(arr)".
  label: string;
  // What goes in the call box, e.g. "mergeSort()".
  template: string;
  // Another of the user's functions calls this one (it's a helper).
  helper?: boolean;
};

// Matches the server's limit on a session's title.
const MAX_TITLE_CHARS = 80;

type Definition = { name: string; obj: Extract<LensObject, { k: "func" | "class" }> };

// The functions and classes the program defined, from its last step.
function definitions(trace: LensTrace): Definition[] {
  const last = trace.steps[trace.steps.length - 1];
  const global = last?.frames[0];
  if (!global) return [];
  const heap = new Map(last.heap.map((obj) => [obj.id, obj]));
  const found: Definition[] = [];
  for (const [name, value] of global.vars) {
    if (value[0] !== "ref") continue;
    const obj = heap.get(value[1]);
    if (obj && (obj.k === "func" || obj.k === "class")) found.push({ name, obj });
  }
  return found;
}

// True when nothing was called: every step is in the program's own frame,
// nothing was printed, nothing failed, and the program defines at least one
// function or class. A bare solution file looks exactly like this.
export function isIdleTrace(trace: LensTrace): boolean {
  if (!trace.steps.length || trace.error || trace.truncated || trace.stdout.trim() !== "") return false;
  if (trace.steps.some((step) => step.frames.length > 1)) return false;
  return definitions(trace).length > 0;
}

// ---------- Methods of a LeetCode-style "class Solution" ----------

type Method = { name: string; params: string };

function pythonMethods(code: string, className: string): Method[] {
  const lines = code.split("\n");
  const header = new RegExp(`^(\\s*)class\\s+${className}\\b[^:]*:\\s*(#.*)?$`);
  const start = lines.findIndex((line) => header.test(line));
  if (start === -1) return [];
  const indent = /^\s*/.exec(lines[start])![0].length;
  const methods: Method[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\s*/.exec(line)![0].length <= indent) break;
    const match = /^\s*def\s+([A-Za-z_]\w*)\s*\(\s*self\b\s*,?\s*([^)]*)/.exec(line);
    if (match && !match[1].startsWith("__")) methods.push({ name: match[1], params: match[2].trim() });
  }
  return methods;
}

const NOT_METHODS = new Set(["constructor", "if", "for", "while", "switch", "catch", "function", "return", "with"]);

function scriptMethods(code: string, className: string): Method[] {
  const header = new RegExp(`class\\s+${className}\\b[^{]*\\{`).exec(code);
  if (!header) return [];
  const methods: Method[] = [];
  let depth = 1;
  let lineStart = header.index + header[0].length;
  let quote: string | null = null;
  for (let i = lineStart; i < code.length && depth > 0; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === "\n") {
      lineStart = i + 1;
      continue;
    }
    // A method header is a line at the class's own depth that opens a block.
    if (ch === "{" && depth === 2) {
      const line = code.slice(lineStart, i);
      const match =
        /^\s*(?:(?:public|private|protected|static|async|override)\s+)*([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/.exec(line);
      if (match && !NOT_METHODS.has(match[1])) methods.push({ name: match[1], params: match[2].trim() });
    }
  }
  return methods;
}

// Which of these top-level functions another one calls. A function's body is
// its header line plus the indented lines (and closing brackets) under it.
function calledByOthers(code: string, language: string, names: string[]): Set<string> {
  const lines = code.split("\n");
  const header =
    language === "python"
      ? /^(?:async\s+)?def\s+([A-Za-z_]\w*)/
      : /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/;
  const continues = (line: string) => line.trim() === "" || /^[\s})\]]/.test(line) || /^(#|\/\/|\/\*|\*)/.test(line);
  const called = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const match = header.exec(lines[i]);
    const owner = match ? (match[1] ?? match[2]) : null;
    if (!owner || !names.includes(owner)) continue;
    let end = i + 1;
    while (end < lines.length && continues(lines[end])) end++;
    const body = lines.slice(i, end).join("\n");
    for (const name of names) {
      // A call like name(…), but not obj.name(…).
      const call = new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`);
      if (name !== owner && call.test(body)) called.add(name);
    }
  }
  return called;
}

// Everything the user could call: their functions, and the methods of a
// LeetCode-style "class Solution".
export function findCallables(trace: LensTrace, code: string, language: string): LensCallable[] {
  const found = definitions(trace);
  const helpers = calledByOthers(
    code,
    language,
    found.filter(({ obj }) => obj.k === "func").map(({ name }) => name),
  );
  const callables: LensCallable[] = [];
  for (const { name, obj } of found) {
    if (obj.k === "func") {
      callables.push({ name, label: `${name}(${obj.params})`, template: `${name}()`, helper: helpers.has(name) });
    } else if (name === "Solution") {
      const methods = language === "python" ? pythonMethods(code, name) : scriptMethods(code, name);
      for (const method of methods) {
        const target = language === "python" ? `${name}().${method.name}` : `new ${name}().${method.name}`;
        callables.push({
          name: method.name,
          label: `${name}.${method.name}(${method.params})`,
          template: `${target}()`,
        });
      }
    }
  }
  return callables;
}

// The call to suggest first: a Solution method (LeetCode style), otherwise
// the last function that no other function calls (the others are its
// helpers), skipping "_private" ones.
export function defaultCallable(callables: LensCallable[]): LensCallable | null {
  const method = callables.find((c) => c.label.startsWith("Solution."));
  if (method) return method;
  const open = callables.filter((c) => !c.name.startsWith("_"));
  const main = open.filter((c) => !c.helper);
  return main[main.length - 1] ?? open[open.length - 1] ?? callables[callables.length - 1] ?? null;
}

// The user's code plus one call at the end. The result stays in memory at
// the last step. Test helpers (lens_list / lensList, …) are available too.
export function buildCallProgram(code: string, language: string, call: string): LensTestProgram {
  const base = code.replace(/\s+$/, "");
  const trimmed = call.trim();
  const title = trimmed.length > MAX_TITLE_CHARS ? `${trimmed.slice(0, MAX_TITLE_CHARS - 1)}…` : trimmed;
  if (language === "python") {
    return {
      code: `${base}\n\n\n# ── Called by Lens ──\nresult = ${trimmed}\n`,
      setup: LENS_TEST_SETUP_PY,
      title,
      language,
    };
  }
  return {
    code: `${base}\n\n\n// ── Called by Lens ──\n{\n  const result = ${trimmed};\n}\n`,
    setup: LENS_TEST_SETUP_JS,
    title,
    language,
  };
}

// How to build a linked list or tree in the call box.
export function helperTip(language: string): string {
  return language === "python"
    ? "lens_list([1, 2, 3]) builds a linked list and lens_tree([1, 2, 3]) a binary tree."
    : "lensList([1, 2, 3]) builds a linked list and lensTree([1, 2, 3]) a binary tree.";
}

// A friendlier explanation for errors that come from Lens's limits (the same
// as the Run button's) or from a renamed function, or null.
export function lensErrorHint(message: string, language: string, fnName?: string): string | null {
  if (!message) return null;
  const missing = /NameError: name '([\w$]+)' is not defined|ReferenceError: ([\w$]+) is not defined/.exec(message);
  const missingName = missing ? (missing[1] ?? missing[2]) : null;
  if (fnName && missingName === fnName) {
    return `Lens calls ${fnName}() the way the tests do, so keep that function name.`;
  }
  if (language === "python" && /EOFError|reading a line|I\/O error|OSError: \[Errno 29\]/.test(message)) {
    return "Lens can't type input for your program. Replace input() with a fixed value to visualize it.";
  }
  if (missingName === "prompt") return "Lens can't answer prompt(). Use a fixed value instead.";
  if (/ModuleNotFoundError|No module named/.test(message)) {
    return "Only Python's standard library is available here, the same as the Run button.";
  }
  if (missingName === "require" || /'import' and 'export' may appear only/.test(message)) {
    return "Lens, like the Run button, runs a single file: it can't load packages or other files.";
  }
  return null;
}