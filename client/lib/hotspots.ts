import { makeRand, planMeter } from "@/lib/complexity";
import { buildCustomProgram } from "@/lib/lensPractice";
import type { Problem } from "@/lib/problems";

// Hotspots: how many times every line of the room's code ran, which lines it
// jumped between, and how the run unfolded over time. The code runs in the
// usual sandbox, wrapped in a counter (this file for Python, hotspotsJs.ts
// for JavaScript and TypeScript) that prints its findings after a marker.

export const HOTSPOTS_MARKER = "__CODESHARE_HOTSPOTS__";

// Python's line tracer costs far more per step than JavaScript's counters,
// so it stops sooner. Either way a run stops at its step or time budget, and
// the heat then shows the part that ran.
export const HOTSPOTS_BUDGET = {
  python: { events: 400_000, ms: 4_000 },
  javascript: { events: 3_000_000, ms: 4_000 },
};
// Timeline samples kept while running (halved, keeping every other one, each
// time it fills up, so they always cover the whole run evenly).
export const HOTSPOTS_SAMPLES = 120_000;
// The timeline is reported as this many slices of the run.
export const HOTSPOTS_SLICES = 480;
// Only the busiest jumps between lines are reported.
export const HOTSPOTS_MAX_FLOWS = 300;

// Practice problems run on one big input, so the heat shows where the work
// grows. Python is slower, so it gets a smaller one.
const PRACTICE_SIZE = { python: 256, javascript: 1024 };

export type HotspotsFlow = { from: number; to: number; count: number };

export type HotspotsResult = {
  // Line → how many times it ran (lines that never ran are absent).
  counts: Map<number, number>;
  // Lines that could have run (the rest are blank, comments, braces, types).
  executable: number[];
  // The busiest jumps between lines that aren't simply the next line.
  flows: HotspotsFlow[];
  // The line that was running in each slice of the run, start to finish.
  timeline: number[];
  // Every line run counted, and the busiest single line.
  total: number;
  hottest: number;
  truncated: boolean;
  durationMs: number;
  error: { line: number | null; message: string } | null;
  // What ran, for Practice problems: "twoSum(nums, target) with n = 1,024".
  input: string | null;
  // How many lines the room's code had (the call added below it is not counted).
  lineCount: number;
};

export type HotspotsOutcome = { ok: true; result: HotspotsResult } | { ok: false; error: string };

// ---------- The heat scale ----------

export const HEAT_STEPS = 10;

// 0 (coldest) to 1 (the busiest line). Logarithmic, because run counts span
// several orders of magnitude and a linear scale would leave everything but
// the hottest line cold.
export function heatOf(count: number, hottest: number): number {
  if (count <= 0 || hottest <= 0) return 0;
  if (hottest === 1) return 1;
  return Math.log1p(count) / Math.log1p(hottest);
}

export function heatStep(count: number, hottest: number): number {
  return Math.min(HEAT_STEPS - 1, Math.floor(heatOf(count, hottest) * HEAT_STEPS));
}

export function formatRuns(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  if (count >= 100_000) return `${Math.round(count / 1000)}k`;
  return count.toLocaleString("en-US");
}

// ---------- Preparing the run ----------

export type HotspotsProgram = { code: string; setup: string; lastLine: number; input: string | null };

function lineCountOf(code: string): number {
  return code.replace(/\s+$/, "").split("\n").length;
}

// Practice rooms call the problem's function on a large, worst-case input
// (the Big-O meter's recipes); any other room runs the code as it is.
export function prepareHotspots(code: string, language: string, problem: Problem | null): HotspotsProgram {
  const lastLine = lineCountOf(code);
  if (problem) {
    const plan = planMeter(code, language, problem);
    if (plan.ok) {
      const { target } = plan;
      const limit = language === "python" ? PRACTICE_SIZE.python : PRACTICE_SIZE.javascript;
      const fitting = target.sizes.filter((size) => size <= limit);
      const n = fitting.length ? fitting[fitting.length - 1] : target.sizes[0];
      const args = target.make(n, makeRand());
      const program = buildCustomProgram(problem, code, args, language);
      return {
        code: program.code,
        setup: program.setup,
        lastLine,
        input: `${target.label} with n = ${n.toLocaleString("en-US")}`,
      };
    }
  }
  return { code, setup: "", lastLine, input: null };
}

// ---------- Python ----------

const HOTSPOTS_PY = String.raw`
import sys as _hs_sys
import json as _hs_json
import time as _hs_time

_HS_MARKER = "__CODESHARE_HOTSPOTS__"
_HS_FILE = "<hotspots>"
_HS_SETUP = "<hotspots-setup>"


class _HsStop(BaseException):
    pass


class _HsOut:
    def __init__(self, limit):
        self.parts = []
        self.size = 0
        self.limit = limit

    def write(self, text):
        text = str(text)
        if self.size < self.limit:
            self.parts.append(text[: self.limit - self.size])
        self.size += len(text)
        return len(text)

    def flush(self):
        pass


def _hs_executable(code):
    lines = set()
    stack = [code]
    while stack:
        current = stack.pop()
        if current.co_filename != _HS_FILE:
            continue
        for _start, _end, line in current.co_lines():
            if line is not None and line > 0:
                lines.add(line)
        for const in current.co_consts:
            if hasattr(const, "co_lines"):
                stack.append(const)
    return lines


def _hs_main(code, setup, last_line, max_events, max_ms, max_samples, slices, max_flows):
    counts = {}
    flows = {}
    samples = []
    # Previous line, steps counted, sampling stride, start time.
    state = [0, 0, 1, 0.0]
    result = {"error": None, "truncated": False}
    namespace = {"__name__": "__main__"}
    perf = _hs_time.perf_counter

    def local(frame, event, arg):
        if event != "line":
            return local
        line = frame.f_lineno
        if line > last_line:
            return local
        total = state[1] + 1
        state[1] = total
        counts[line] = counts.get(line, 0) + 1
        prev = state[0]
        if prev:
            key = (prev, line)
            flows[key] = flows.get(key, 0) + 1
        state[0] = line
        if total % state[2] == 0:
            samples.append(line)
            if len(samples) >= max_samples:
                del samples[1::2]
                state[2] *= 2
        if total & 1023 == 0 and (total >= max_events or (perf() - state[3]) * 1000 > max_ms):
            raise _HsStop()
        return local

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != _HS_FILE:
            return None
        # The room's code called while a helper builds the input (like its
        # own ListNode class) isn't part of the run.
        caller = frame.f_back
        if caller is not None and caller.f_code.co_filename == _HS_SETUP:
            return None
        return local

    compiled = None
    try:
        if setup:
            exec(compile(setup, _HS_SETUP, "exec"), namespace)
        compiled = compile(code, _HS_FILE, "exec")
    except SyntaxError as exc:
        result["error"] = {"line": exc.lineno, "message": "SyntaxError: " + str(exc.msg)}
    except BaseException as exc:
        result["error"] = {"line": None, "message": type(exc).__name__ + ": " + str(exc)}

    executable = _hs_executable(compiled) if compiled is not None else set()
    elapsed = 0.0
    if compiled is not None:
        saved = (_hs_sys.stdout, _hs_sys.stderr)
        quiet = _HsOut(20000)
        _hs_sys.stdout = quiet
        _hs_sys.stderr = quiet
        state[3] = perf()
        _hs_sys.settrace(tracer)
        try:
            exec(compiled, namespace)
        except _HsStop:
            result["truncated"] = True
        except SystemExit:
            pass
        except BaseException as exc:
            line = None
            tb = exc.__traceback__
            while tb is not None:
                if tb.tb_frame.f_code.co_filename == _HS_FILE and tb.tb_lineno <= last_line:
                    line = tb.tb_lineno
                tb = tb.tb_next
            result["error"] = {"line": line, "message": type(exc).__name__ + ": " + str(exc)}
        finally:
            _hs_sys.settrace(None)
            elapsed = (perf() - state[3]) * 1000
            _hs_sys.stdout, _hs_sys.stderr = saved

    timeline = []
    size = len(samples)
    if size:
        parts = min(slices, size)
        for index in range(parts):
            chunk = samples[index * size // parts:(index + 1) * size // parts]
            seen = {}
            for value in chunk:
                seen[value] = seen.get(value, 0) + 1
            timeline.append(max(seen, key=seen.get) if seen else 0)

    busiest = sorted(
        ((key, count) for key, count in flows.items() if key[1] != key[0] + 1 and key[1] != key[0]),
        key=lambda item: -item[1],
    )[:max_flows]

    result["counts"] = sorted(counts.items())
    result["executable"] = sorted(line for line in executable if line <= last_line)
    result["flows"] = [[key[0], key[1], count] for key, count in busiest]
    result["timeline"] = timeline
    result["total"] = state[1]
    result["ms"] = round(elapsed, 2)
    print(_HS_MARKER + _hs_json.dumps(result, separators=(",", ":")))
`;

// JSON string literals are valid Python string literals.
export function buildHotspotsPython(program: HotspotsProgram): string {
  const budget = HOTSPOTS_BUDGET.python;
  return (
    HOTSPOTS_PY +
    "\n_hs_main(" +
    [
      JSON.stringify(program.code),
      JSON.stringify(program.setup),
      program.lastLine,
      budget.events,
      budget.ms,
      HOTSPOTS_SAMPLES,
      HOTSPOTS_SLICES,
      HOTSPOTS_MAX_FLOWS,
    ].join(", ") +
    ")\n"
  );
}

// ---------- Reading the result ----------

type RawReport = {
  counts?: unknown;
  executable?: unknown;
  flows?: unknown;
  timeline?: unknown;
  total?: unknown;
  truncated?: unknown;
  ms?: unknown;
  error?: unknown;
};

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseHotspotsOutput(output: string, program: HotspotsProgram): HotspotsResult | null {
  const start = output.lastIndexOf(HOTSPOTS_MARKER);
  if (start === -1) return null;
  const end = output.indexOf("\n", start);
  let raw: RawReport;
  try {
    raw = JSON.parse(output.slice(start + HOTSPOTS_MARKER.length, end === -1 ? undefined : end)) as RawReport;
  } catch {
    return null;
  }

  const counts = new Map<number, number>();
  if (Array.isArray(raw.counts)) {
    for (const pair of raw.counts) {
      if (Array.isArray(pair) && isNumber(pair[0]) && isNumber(pair[1]) && pair[0] <= program.lastLine) {
        counts.set(pair[0], pair[1]);
      }
    }
  }
  const flows: HotspotsFlow[] = [];
  if (Array.isArray(raw.flows)) {
    for (const flow of raw.flows) {
      if (Array.isArray(flow) && isNumber(flow[0]) && isNumber(flow[1]) && isNumber(flow[2])) {
        flows.push({ from: flow[0], to: flow[1], count: flow[2] });
      }
    }
  }
  const executable = Array.isArray(raw.executable) ? raw.executable.filter(isNumber) : [];
  const timeline = Array.isArray(raw.timeline) ? raw.timeline.filter(isNumber) : [];
  const error =
    raw.error && typeof raw.error === "object"
      ? {
          line: isNumber((raw.error as { line?: unknown }).line) ? ((raw.error as { line: number }).line) : null,
          message: String((raw.error as { message?: unknown }).message ?? "The code stopped with an error."),
        }
      : null;

  let hottest = 0;
  for (const count of counts.values()) hottest = Math.max(hottest, count);

  return {
    counts,
    executable,
    flows,
    timeline,
    total: isNumber(raw.total) ? raw.total : 0,
    hottest,
    truncated: raw.truncated === true,
    durationMs: isNumber(raw.ms) ? raw.ms : 0,
    error,
    input: program.input,
    lineCount: program.lastLine,
  };
}