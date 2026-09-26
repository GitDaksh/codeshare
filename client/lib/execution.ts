import { formatValue, valuesMatch, type CompareMode } from "@/lib/judge";
import { PROBLEMS } from "@/lib/problems";
import { JS_RUNNER_SOURCE, PYTHON_RUNNER_SOURCE, buildSandboxDocument } from "@/lib/sandboxRunners";

// ============================================================================
// Public types (unchanged from before, plus test types)
// ============================================================================

export type ExecutionResult = {
  output: string;
  error: string | null;
  durationMs: number;
};

export type RunRunner = {
  name: string;
  avatarId: string;
  isSelf: boolean;
};

export type RunState = {
  status: "idle" | "running" | "done";
  result: ExecutionResult | null;
  runner: RunRunner | null;
  language: string | null;
};

export const IDLE_RUN_STATE: RunState = {
  status: "idle",
  result: null,
  runner: null,
  language: null,
};

export type TestSpec = {
  fnName: string;
  tests: { args: unknown[]; expected: unknown }[];
  compare: CompareMode;
  // How arguments and results are shaped. Linked lists and trees travel as
  // arrays and are rebuilt into real nodes inside the sandbox.
  argTypes?: string[];
  returnType?: string;
  // In-place problems: which argument the tests check after the call.
  outputArg?: number | null;
};

export type TestStatus = "passed" | "failed" | "error" | "not-run";

export type TestCaseResult = {
  index: number;
  status: TestStatus;
  actual: string | null;
  error: string | null;
  ms: number | null;
};

export type TestRunReport = {
  // "completed" means every test actually ran (pass or fail).
  outcome: "completed" | "timeout" | "error";
  message: string | null;
  results: TestCaseResult[];
  passed: number;
  total: number;
  logs: string;
  durationMs: number;
  // Plain-text version, shared with the rest of the room.
  summary: string;
};

// ============================================================================
// Limits
// ============================================================================

const MAX_OUTPUT_CHARS = 20000;
const RUNNABLE_LANGUAGES = new Set(["javascript", "typescript", "python"]);

const LIMITS = {
  jsProgram: { loadMs: 10000, runMs: 5000 },
  jsTests: { loadMs: 10000, runMs: 8000 },
  // The first Python run downloads the runtime, so loading gets a generous
  // allowance; the run clock only starts once Python is ready.
  pyProgram: { loadMs: 90000, runMs: 10000 },
  pyTests: { loadMs: 90000, runMs: 15000 },
};

export function isRunnable(language: string): boolean {
  return RUNNABLE_LANGUAGES.has(language);
}

function truncate(text: string): string {
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n… output truncated` : text;
}

function seconds(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

// ============================================================================
// Sandbox: a hidden iframe with an opaque origin (no allow-same-origin), so
// code running inside it can't reach the app, its cookies, or the session.
// ============================================================================

type SandboxMessage = { type?: unknown; id?: unknown; [key: string]: unknown };
type Listener = (message: SandboxMessage) => void;

const READY_TIMEOUT_MS = 10000;

class Sandbox {
  private iframe: HTMLIFrameElement;
  private listeners = new Map<string, Listener>();
  private ready: Promise<void>;
  private markReady: () => void = () => {};

  constructor(runnerSource: string, options: { moduleWorker?: boolean } = {}) {
    this.ready = new Promise((resolve) => {
      this.markReady = resolve;
    });
    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("sandbox", "allow-scripts");
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.tabIndex = -1;
    this.iframe.style.display = "none";
    window.addEventListener("message", this.handleMessage);
    this.iframe.srcdoc = buildSandboxDocument(runnerSource, options);
    document.body.appendChild(this.iframe);
  }

  private handleMessage = (event: MessageEvent) => {
    if (event.source !== this.iframe.contentWindow) return;
    const message = event.data as SandboxMessage;
    if (!message || typeof message !== "object") return;

    if (message.type === "ready") {
      this.markReady();
      return;
    }
    if (message.type === "fatal") {
      for (const listener of Array.from(this.listeners.values())) listener(message);
      return;
    }
    if (typeof message.id === "string") this.listeners.get(message.id)?.(message);
  };

  async post(message: Record<string, unknown>): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("sandbox not ready")), READY_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.ready, timeout]);
    } finally {
      clearTimeout(timer);
    }
    this.iframe.contentWindow?.postMessage(message, "*");
  }

  listen(id: string, listener: Listener) {
    this.listeners.set(id, listener);
  }

  unlisten(id: string) {
    this.listeners.delete(id);
  }

  destroy() {
    window.removeEventListener("message", this.handleMessage);
    this.listeners.clear();
    this.iframe.remove();
  }
}

export type SandboxOutcome =
  | { kind: "done"; data: SandboxMessage; durationMs: number }
  | { kind: "timeout"; phase: "load" | "run"; limitMs: number }
  | { kind: "fatal"; message: string };

let idCounter = 0;

function runInSandbox(
  sandbox: Sandbox,
  request: Record<string, unknown>,
  limits: { loadMs: number; runMs: number }
): Promise<SandboxOutcome> {
  const id = `run-${Date.now()}-${idCounter++}`;

  return new Promise((resolve) => {
    let startedAt = 0;
    let settled = false;
    let timer = setTimeout(() => finish({ kind: "timeout", phase: "load", limitMs: limits.loadMs }), limits.loadMs);

    function finish(outcome: SandboxOutcome) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sandbox.unlisten(id);
      resolve(outcome);
    }

    sandbox.listen(id, (message) => {
      if (message.type === "started") {
        startedAt = performance.now();
        clearTimeout(timer);
        timer = setTimeout(() => finish({ kind: "timeout", phase: "run", limitMs: limits.runMs }), limits.runMs);
      } else if (message.type === "done") {
        finish({ kind: "done", data: message, durationMs: startedAt ? performance.now() - startedAt : 0 });
      } else if (message.type === "fatal") {
        finish({ kind: "fatal", message: String(message.message ?? "The code runner stopped unexpectedly.") });
      }
    });

    sandbox.post({ ...request, type: "run", id }).catch(() => {
      finish({ kind: "fatal", message: "The code runner couldn't start. Try again." });
    });
  });
}

// JavaScript gets a brand-new sandbox for every run: a clean slate each time,
// and the frame (with any runaway loop inside it) is thrown away afterwards.
async function runJavaScript(request: Record<string, unknown>, limits: { loadMs: number; runMs: number }) {
  const sandbox = new Sandbox(JS_RUNNER_SOURCE);
  try {
    return await runInSandbox(sandbox, request, limits);
  } finally {
    sandbox.destroy();
  }
}

// Python keeps one sandbox alive between runs so the runtime stays loaded.
// It's only torn down (and rebuilt on the next run) after a timeout or crash.
let pythonSandbox: Sandbox | null = null;
let pythonQueue: Promise<unknown> = Promise.resolve();

function runPython(request: Record<string, unknown>, limits: { loadMs: number; runMs: number }) {
  const job = pythonQueue.then(async () => {
    // Pyodide only runs in a module worker (see sandboxRunners.ts).
    if (!pythonSandbox) pythonSandbox = new Sandbox(PYTHON_RUNNER_SOURCE, { moduleWorker: true });
    const outcome = await runInSandbox(pythonSandbox, request, limits);
    if (outcome.kind !== "done") {
      pythonSandbox.destroy();
      pythonSandbox = null;
    }
    return outcome;
  });
  pythonQueue = job.catch(() => {});
  return job;
}

// ============================================================================
// TypeScript → JavaScript (types are stripped, not checked)
// ============================================================================

async function transpileTypeScript(code: string): Promise<{ code: string } | { error: string }> {
  try {
    const Babel = await import("@babel/standalone");
    const result = Babel.transform(code, { presets: ["typescript"], filename: "solution.ts" });
    return { code: result.code ?? "" };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "TypeScript compilation failed." };
  }
}

// ============================================================================
// Running a program (the Run button)
// ============================================================================

function outcomeToResult(outcome: SandboxOutcome, language: string): ExecutionResult {
  if (outcome.kind === "done") {
    return {
      output: typeof outcome.data.output === "string" ? outcome.data.output : "",
      error: typeof outcome.data.error === "string" && outcome.data.error ? outcome.data.error : null,
      durationMs: outcome.durationMs,
    };
  }
  if (outcome.kind === "timeout") {
    const error =
      outcome.phase === "load"
        ? language === "python"
          ? "The Python runtime took too long to load. Check your connection and try again."
          : "The code runner took too long to start. Try again."
        : `Stopped after ${seconds(outcome.limitMs)}: the code was still running. Check for an infinite loop.`;
    return { output: "", error, durationMs: outcome.phase === "run" ? outcome.limitMs : 0 };
  }
  return { output: "", error: outcome.message, durationMs: 0 };
}

export async function executeCode(code: string, language: string): Promise<ExecutionResult> {
  let result: ExecutionResult;

  if (language === "javascript") {
    result = outcomeToResult(await runJavaScript({ mode: "program", code }, LIMITS.jsProgram), language);
  } else if (language === "typescript") {
    const compiled = await transpileTypeScript(code);
    result =
      "error" in compiled
        ? { output: "", error: compiled.error, durationMs: 0 }
        : outcomeToResult(await runJavaScript({ mode: "program", code: compiled.code }, LIMITS.jsProgram), language);
  } else if (language === "python") {
    result = outcomeToResult(await runPython({ mode: "program", code }, LIMITS.pyProgram), language);
  } else {
    result = { output: "", error: "Running code isn't supported for this language yet.", durationMs: 0 };
  }

  return {
    ...result,
    output: truncate(result.output),
    error: result.error ? truncate(result.error) : null,
  };
}

// ============================================================================
// Running tests (Practice)
// ============================================================================

type RawTestResult = { ok?: unknown; actualJson?: unknown; display?: unknown; error?: unknown; ms?: unknown };

function notRunResults(total: number): TestCaseResult[] {
  return Array.from({ length: total }, (_, index) => ({
    index,
    status: "not-run" as const,
    actual: null,
    error: null,
    ms: null,
  }));
}

function buildSummary(report: Omit<TestRunReport, "summary">, spec: TestSpec): string {
  if (report.outcome !== "completed") {
    return `Tests couldn't finish: ${report.message ?? "something went wrong."}`;
  }
  const lines = [`Tests: ${report.passed} of ${report.total} passed`];
  for (const result of report.results) {
    const label = `Test ${result.index + 1}`;
    if (result.status === "passed") lines.push(`✓ ${label}`);
    else if (result.status === "failed")
      lines.push(`✗ ${label}: expected ${formatValue(spec.tests[result.index].expected)}, got ${result.actual ?? "nothing"}`);
    else if (result.status === "error") lines.push(`! ${label}: ${result.error ?? "error"}`);
  }
  return truncate(lines.join("\n"));
}

// Turns a raw sandbox outcome into a judged report. Pure (no DOM), exported
// so it can be tested on its own.
export function judgeOutcome(outcome: SandboxOutcome, spec: TestSpec, language: string): TestRunReport {
  const total = spec.tests.length;
  let base: Omit<TestRunReport, "summary">;

  if (outcome.kind === "timeout") {
    const message =
      outcome.phase === "load"
        ? language === "python"
          ? "The Python runtime took too long to load. Check your connection and try again."
          : "The code runner took too long to start. Try again."
        : `Stopped after ${seconds(outcome.limitMs)}: your code was still running. Check for an infinite loop.`;
    base = { outcome: "timeout", message, results: notRunResults(total), passed: 0, total, logs: "", durationMs: 0 };
  } else if (outcome.kind === "fatal") {
    base = {
      outcome: "error",
      message: outcome.message,
      results: notRunResults(total),
      passed: 0,
      total,
      logs: "",
      durationMs: 0,
    };
  } else {
    const data = outcome.data;
    const logs = typeof data.logs === "string" ? truncate(data.logs) : "";
    const fatal = typeof data.fatal === "string" && data.fatal ? data.fatal : null;
    const raw = Array.isArray(data.results) ? (data.results as RawTestResult[]) : [];

    if (fatal || raw.length !== total) {
      base = {
        outcome: "error",
        message: fatal ?? "The tests didn't run completely. Try again.",
        results: notRunResults(total),
        passed: 0,
        total,
        logs,
        durationMs: outcome.durationMs,
      };
    } else {
      const results: TestCaseResult[] = raw.map((r, index) => {
        const ms = typeof r.ms === "number" ? r.ms : null;
        if (!r.ok) {
          return { index, status: "error", actual: null, error: typeof r.error === "string" ? r.error : "Error", ms };
        }
        const display = typeof r.display === "string" ? r.display : null;
        if (typeof r.actualJson !== "string") {
          // Nothing comparable came back (e.g. no return value, or a set).
          return { index, status: "failed", actual: display ?? "nothing", error: null, ms };
        }
        let actual: unknown;
        try {
          actual = JSON.parse(r.actualJson);
        } catch {
          return { index, status: "failed", actual: display, error: null, ms };
        }
        const match = valuesMatch(actual, spec.tests[index].expected, spec.compare);
        return { index, status: match ? "passed" : "failed", actual: display ?? formatValue(actual), error: null, ms };
      });
      base = {
        outcome: "completed",
        message: null,
        results,
        passed: results.filter((r) => r.status === "passed").length,
        total,
        logs,
        durationMs: outcome.durationMs,
      };
    }
  }

  return { ...base, summary: buildSummary(base, spec) };
}

// Callers can pass the shape explicitly. When they don't (the room page just
// passes a problem's own tests array), it's looked up from that problem.
function resolveShape(spec: TestSpec) {
  if (spec.argTypes) {
    return { argTypes: spec.argTypes, returnType: spec.returnType ?? null, outputArg: spec.outputArg ?? null };
  }
  const problem =
    PROBLEMS.find((p) => p.tests === spec.tests) ??
    PROBLEMS.find((p) => p.functionName.js === spec.fnName || p.functionName.py === spec.fnName);
  return {
    argTypes: problem ? problem.params.map((param) => param.type) : [],
    returnType: problem ? problem.returns : null,
    outputArg: problem?.outputArg ?? null,
  };
}

export async function runTests(code: string, language: string, spec: TestSpec): Promise<TestRunReport> {
  const shape = resolveShape(spec);
  const request = {
    mode: "tests",
    fnName: spec.fnName,
    // Only the inputs go to the sandbox; answers are checked out here.
    tests: spec.tests.map((t) => ({ args: t.args })),
    argTypes: shape.argTypes,
    returnType: shape.returnType,
    outputArg: shape.outputArg,
  };

  if (language === "python") {
    return judgeOutcome(await runPython({ ...request, code }, LIMITS.pyTests), spec, language);
  }

  if (language === "javascript" || language === "typescript") {
    let source = code;
    if (language === "typescript") {
      const compiled = await transpileTypeScript(code);
      if ("error" in compiled) {
        return judgeOutcome({ kind: "fatal", message: compiled.error }, spec, language);
      }
      source = compiled.code;
    }
    return judgeOutcome(await runJavaScript({ ...request, code: source }, LIMITS.jsTests), spec, language);
  }

  return judgeOutcome(
    { kind: "fatal", message: "Tests can only run in JavaScript, TypeScript, or Python for now." },
    spec,
    language
  );
}