// The programs that measure a function's growth inside the sandbox (see
// complexity.ts for what's measured and how it's judged). Each prints one
// line: a marker followed by JSON.

import type { MeterTarget, RawMeasurement } from "@/lib/complexity";

export const METER_MARKER = "__CODESHARE_METER__";

// Timing stops early when the next size would take too long.
const TIME_BUDGET_MS = 2500;
const SPACE_BUDGET_MS = 2000;
// Memory is measured on smaller inputs (it's slower to measure).
const SPACE_MAX_N = { javascript: 1024, python: 4096 };
const STEP_LIMIT = 300000;

// Placeholders are replaced with a function, so "$" in the data is kept as is.
function fill(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) out = out.split(key).join(value);
  return out;
}

// ---------- JavaScript ----------

// Builds each argument from its JSON form (linked lists and trees become
// nodes of the user's own ListNode / TreeNode class when they have one).
const JS_BUILDERS = String.raw`
    const List = __LIST__ || class {
      constructor(val = 0, next = null) {
        this.val = val;
        this.next = next;
      }
    };
    const Tree = __TREE__ || class {
      constructor(val = 0, left = null, right = null) {
        this.val = val;
        this.left = left;
        this.right = right;
      }
    };
    const list = (values) => {
      let head = null;
      for (let i = values.length - 1; i >= 0; i--) {
        const node = new List(values[i]);
        node.val = values[i];
        node.next = head;
        head = node;
      }
      return head;
    };
    const tree = (values) => {
      if (!values.length || values[0] === null) return null;
      const make = (value) => {
        const node = new Tree(value);
        node.val = value;
        node.left = null;
        node.right = null;
        return node;
      };
      const root = make(values[0]);
      const queue = [root];
      let at = 0;
      let i = 1;
      while (i < values.length && at < queue.length) {
        const node = queue[at++];
        for (const side of ["left", "right"]) {
          if (i < values.length) {
            if (values[i] !== null) {
              node[side] = make(values[i]);
              queue.push(node[side]);
            }
            i++;
          }
        }
      }
      return root;
    };
    // Arguments back in their JSON form, to spot a function that changes its input.
    const plain = (shape, arg) => {
      if (shape === "list") {
        const out = [];
        for (let node = arg, guard = 0; node && guard < 4194304; node = node.next, guard++) out.push(node.val);
        return out;
      }
      if (shape === "tree") {
        const out = [];
        const queue = [arg];
        for (let at = 0; at < queue.length && at < 4194304; at++) {
          const node = queue[at];
          out.push(node ? node.val : null);
          if (node) queue.push(node.left ?? null, node.right ?? null);
        }
        while (out.length && out[out.length - 1] === null) out.pop();
        return out;
      }
      if (shape === "lists") return arg.map((head) => plain("list", head));
      return arg;
    };
    const build = (raw) =>
      raw.map((arg, i) => {
        const shape = __cxSpec.shapes[i];
        if (shape === "list") return list(arg);
        if (shape === "tree") return tree(arg);
        if (shape === "lists") return arg.map(list);
        return arg !== null && typeof arg === "object" ? structuredClone(arg) : arg;
      });
`;

// Time: appended to the user's (plain JavaScript) code, so it can call their
// function directly. Their console is silenced while it measures.
const JS_TIME = String.raw`
;await (async () => {
  const __cxSpec = JSON.parse(__SPEC__);
  const __cxOut = { time: [], space: [], error: null, stopped: "done" };
  const __cxQuiet = {};
  for (const key of Object.keys(console)) {
    __cxQuiet[key] = console[key];
    console[key] = () => {};
  }
  let __cxN = 0;
  try {
    const fn = __RESOLVE__;
    if (typeof fn !== "function") throw new Error("__missing__");
    __BUILDERS__
    const now = () => performance.now();
    const began = now();
    const last = __cxSpec.inputs[__cxSpec.inputs.length - 1][0];
    let prev = 0;
    for (const [n, raw] of __cxSpec.inputs) {
      __cxN = n;
      const first = build(raw);
      fn(...first);
      // Inputs the function doesn't change are reused for every call;
      // otherwise each call gets a fresh copy (built outside the timing).
      const reuse = JSON.stringify(first.map((arg, i) => plain(__cxSpec.shapes[i], arg))) === JSON.stringify(raw);
      const most = reuse ? 1048576 : Math.max(1, Math.floor(2000000 / (n + 1)));
      let reps = 1;
      let per = Infinity;
      for (let trial = 0; trial < 2; trial++) {
        for (;;) {
          const batch = [];
          if (!reuse) for (let i = 0; i < reps; i++) batch.push(build(raw));
          const start = now();
          if (reuse) for (let i = 0; i < reps; i++) fn(...first);
          else for (const args of batch) fn(...args);
          const spent = now() - start;
          if (spent >= 8 || reps >= most) {
            per = Math.min(per, spent / reps);
            break;
          }
          reps = Math.min(most, reps * (spent < 0.5 ? 16 : 4));
        }
      }
      __cxOut.time.push([n, per]);
      const slow = per > 40 || now() - began > __BUDGET__ || (prev > 0 && (per / prev > 20 || (per * per) / prev > 250));
      if (slow) {
        if (n !== last) __cxOut.stopped = "slow";
        break;
      }
      prev = per;
    }
  } catch (err) {
    __cxOut.error = { n: __cxN, message: err instanceof Error ? err.name + ": " + err.message : String(err) };
  } finally {
    for (const key of Object.keys(__cxQuiet)) console[key] = __cxQuiet[key];
  }
  console.log(__MARKER__ + JSON.stringify(__cxOut));
})();
`;

// Memory: a runtime for the Lens instrumenter that, while a call runs,
// samples everything the function's frames can reach, minus the input, and
// keeps the peak. Recursion depth is the deepest stack of the user's frames.
const JS_SPACE_RUNTIME = String.raw`var __lens = (function (realConsole) {
  "use strict";
  var STOP = { meterStop: true };
  var stack = [];
  var measuring = false;
  var base = 0;
  var steps = 0;
  var limit = 0;
  var every = 1;
  var heapPeak = 0;
  var depthPeak = 0;
  var inputs = new Set();
  var out = { time: [], space: [], error: null, stopped: "done" };
  function noop() {}
  function describe(err) {
    return err instanceof Error ? err.name + ": " + err.message : String(err);
  }
  function reach(values, into, skip) {
    var work = values.slice();
    var total = 0;
    while (work.length) {
      var v = work.pop();
      if (typeof v === "string") {
        if (skip) total += Math.ceil(v.length / 8);
        continue;
      }
      if (v === null || typeof v !== "object" || into.has(v) || (skip && skip.has(v))) continue;
      into.add(v);
      if (into.size > 500000) throw STOP;
      if (Array.isArray(v)) {
        total += v.length;
        for (var i = 0; i < v.length; i++) work.push(v[i]);
      } else if (v instanceof Map) {
        total += v.size;
        v.forEach(function (item, key) {
          work.push(key, item);
        });
      } else if (v instanceof Set) {
        total += v.size;
        v.forEach(function (item) {
          work.push(item);
        });
      } else if (ArrayBuffer.isView(v)) {
        total += Math.ceil(v.byteLength / 8);
      } else {
        var keys = Object.keys(v);
        total += keys.length;
        for (var k = 0; k < keys.length; k++) {
          var desc = Object.getOwnPropertyDescriptor(v, keys[k]);
          if (desc && "value" in desc) work.push(desc.value);
        }
      }
    }
    return total;
  }
  function sample(extra) {
    var values = [];
    for (var i = base; i < stack.length; i++) {
      var frame = stack[i];
      if (!frame.get) continue;
      try {
        frame.get(function (name, v) {
          values.push(v);
        });
      } catch (e) {}
    }
    if (extra !== undefined) values.push(extra);
    var seen = new Set();
    var total = reach(values, seen, inputs);
    if (total > heapPeak) heapPeak = total;
    every = Math.max(1, Math.min(64, Math.floor(seen.size / 32)));
  }
  function tick(extra) {
    steps++;
    if (steps > limit) throw STOP;
    if (steps % every === 0) sample(extra);
  }
  var api = {
    console: { log: noop, info: noop, warn: noop, error: noop, debug: noop, trace: noop, table: noop, dir: noop },
    out: out,
    g: function () {
      var frame = { get: null };
      stack.push(frame);
      return frame;
    },
    s: function (line, get) {
      var frame = stack[stack.length - 1];
      if (!frame) return;
      frame.get = get;
      if (measuring) tick();
    },
    c: function () {
      var frame = { get: null };
      stack.push(frame);
      if (measuring && stack.length - base > depthPeak) depthPeak = stack.length - base;
      return frame;
    },
    r: function (frame, value) {
      if (measuring) tick(value);
      return value;
    },
    l: function (frame) {
      var at = stack.lastIndexOf(frame);
      if (at !== -1) stack.splice(at, 1);
    },
    x: noop,
    p: function (frame, value) {
      api.l(frame);
      return value;
    },
    w: function (frame, value) {
      if (frame) stack.push(frame);
      return value;
    },
    q: function (fn) {
      return fn();
    },
    u: function () {
      return undefined;
    },
    k: noop,
    e: noop,
    done: noop,
    fail: function (err) {
      if (err !== STOP) out.error = { n: 0, message: describe(err) };
    },
    measure: function (fn, args, stepLimit) {
      base = stack.length;
      steps = 0;
      limit = stepLimit;
      every = 1;
      heapPeak = 0;
      depthPeak = 0;
      inputs = new Set();
      reach(args, inputs, null);
      measuring = true;
      try {
        var result = fn();
        measuring = false;
        sample(result);
        return { heap: heapPeak, depth: depthPeak, steps: steps };
      } catch (err) {
        if (err === STOP) return { stopped: true };
        return { error: describe(err) };
      } finally {
        measuring = false;
      }
    },
    finish: function () {
      realConsole.log(__MARKER__ + JSON.stringify(out));
    },
  };
  return api;
})(console);
`;

const JS_SPACE = String.raw`
await (async function () {
  const console = __lens.console;
  try {
    await (async function () {
__CODE__
    })();
  } catch (err) {
    __lens.fail(err);
  }
  const __cxSpec = JSON.parse(__SPEC__);
  const __cxOut = __lens.out;
  let __cxN = 0;
  try {
    const fn = __RESOLVE__;
    if (typeof fn !== "function") throw new Error("__missing__");
    __BUILDERS__
    const began = Date.now();
    for (const [n, raw] of __cxSpec.inputs) {
      if (n > __MAXN__) break;
      __cxN = n;
      const args = build(raw);
      const m = __lens.measure(() => fn(...args), args, __STEPS__);
      if (m.error) {
        __cxOut.error = { n, message: m.error };
        break;
      }
      if (m.stopped) break;
      __cxOut.space.push([n, m.heap, m.depth, m.steps]);
      if (Date.now() - began > __BUDGET__) break;
    }
  } catch (err) {
    __cxOut.error = { n: __cxN, message: err instanceof Error ? err.name + ": " + err.message : String(err) };
  }
})();
__lens.finish();
`;

function jsResolve(target: MeterTarget, lookup: (name: string) => string): string {
  if (target.call.kind === "function") return lookup(target.call.name);
  const method = JSON.stringify(target.call.name);
  return (
    `((S) => { if (typeof S !== "function") return undefined; const s = new S(); ` +
    `return typeof s[${method}] === "function" ? s[${method}].bind(s) : undefined; })(${lookup("Solution")})`
  );
}

// Names the memory program looks up in the user's code.
export function meterNames(target: MeterTarget): string[] {
  return [target.call.kind === "function" ? target.call.name : "Solution", "ListNode", "TreeNode"];
}

// Plain JavaScript (TypeScript already stripped) + the timing driver.
export function jsTimeProgram(code: string, target: MeterTarget, specJson: string): string {
  const inScope = (name: string) => `(typeof ${name} === "function" ? ${name} : undefined)`;
  const driver = fill(JS_TIME, {
    __BUILDERS__: fill(JS_BUILDERS, { __LIST__: inScope("ListNode"), __TREE__: inScope("TreeNode") }),
    __RESOLVE__: jsResolve(target, inScope),
    __SPEC__: JSON.stringify(specJson),
    __BUDGET__: String(TIME_BUDGET_MS),
    __MARKER__: JSON.stringify(METER_MARKER),
  });
  return `${code}\n${driver}`;
}

// The user's code already instrumented (instrumentJsWith, resolving
// meterNames) + the memory runtime and driver.
export function jsSpaceProgram(instrumented: string, target: MeterTarget, specJson: string): string {
  const viaLens = (name: string) => `__lens.u(${JSON.stringify(name)})`;
  return (
    fill(JS_SPACE_RUNTIME, { __MARKER__: JSON.stringify(METER_MARKER) }) +
    fill(JS_SPACE, {
      __CODE__: instrumented,
      __BUILDERS__: fill(JS_BUILDERS, { __LIST__: viaLens("ListNode"), __TREE__: viaLens("TreeNode") }),
      __RESOLVE__: jsResolve(target, viaLens),
      __SPEC__: JSON.stringify(specJson),
      __MAXN__: String(SPACE_MAX_N.javascript),
      __STEPS__: String(STEP_LIMIT),
      __BUDGET__: String(SPACE_BUDGET_MS),
    })
  );
}

// ---------- Python ----------

const PY_METER = String.raw`
import copy as _cx_copy
import json as _cx_json
import sys as _cx_sys
import time as _cx_time
import tracemalloc as _cx_tm


def _cx_meter():
    spec = _cx_json.loads(__SPEC__)
    out = {"time": [], "space": [], "error": None, "stopped": "done"}
    names = globals()
    fn = __RESOLVE__
    if not callable(fn):
        out["error"] = {"n": 0, "message": "NameError: __missing__"}
        print(__MARKER__ + _cx_json.dumps(out))
        return

    class FallbackList:
        def __init__(self, val=0, next=None):
            self.val = val
            self.next = next

    class FallbackTree:
        def __init__(self, val=0, left=None, right=None):
            self.val = val
            self.left = left
            self.right = right

    List = names.get("ListNode") if isinstance(names.get("ListNode"), type) else FallbackList
    Tree = names.get("TreeNode") if isinstance(names.get("TreeNode"), type) else FallbackTree

    def node(cls, value):
        try:
            made = cls(value)
        except TypeError:
            made = cls()
        made.val = value
        return made

    def make_list(values):
        head = None
        for value in reversed(values):
            item = node(List, value)
            item.next = head
            head = item
        return head

    def make_tree(values):
        if not values or values[0] is None:
            return None
        root = node(Tree, values[0])
        root.left = root.right = None
        queue = [root]
        at = 0
        i = 1
        while i < len(values) and at < len(queue):
            parent = queue[at]
            at += 1
            for side in ("left", "right"):
                if i < len(values):
                    if values[i] is not None:
                        child = node(Tree, values[i])
                        child.left = child.right = None
                        setattr(parent, side, child)
                        queue.append(child)
                    i += 1
        return root

    shapes = spec["shapes"]

    def plain(shape, arg):
        if shape == "list":
            out, guard = [], 0
            while arg is not None and guard < 4194304:
                out.append(getattr(arg, "val", None))
                arg = getattr(arg, "next", None)
                guard += 1
            return out
        if shape == "tree":
            out, queue, at = [], [arg], 0
            while at < len(queue) and at < 4194304:
                item = queue[at]
                at += 1
                out.append(None if item is None else getattr(item, "val", None))
                if item is not None:
                    queue.append(getattr(item, "left", None))
                    queue.append(getattr(item, "right", None))
            while out and out[-1] is None:
                out.pop()
            return out
        if shape == "lists":
            return [plain("list", head) for head in arg]
        return arg

    def build(raw):
        args = []
        for shape, arg in zip(shapes, raw):
            if shape == "list":
                args.append(make_list(arg))
            elif shape == "tree":
                args.append(make_tree(arg))
            elif shape == "lists":
                args.append([make_list(values) for values in arg])
            elif isinstance(arg, (list, dict)):
                args.append(_cx_copy.deepcopy(arg))
            else:
                args.append(arg)
        return args

    class Quiet:
        def write(self, text):
            return len(text)

        def flush(self):
            pass

    clock = _cx_time.perf_counter
    real_stdout = _cx_sys.stdout
    _cx_sys.stdout = Quiet()
    measured = []
    try:
        # Time: milliseconds per call, each measurement lasting at least 8 ms.
        began = clock()
        last = spec["inputs"][-1][0]
        prev = 0.0
        for n, raw in spec["inputs"]:
            try:
                first = build(raw)
                fn(*first)
                # Inputs the function doesn't change are reused for every call;
                # otherwise each call gets a fresh copy (built outside the timing).
                reuse = _cx_json.dumps([plain(s, a) for s, a in zip(shapes, first)]) == _cx_json.dumps(raw)
                most = 1048576 if reuse else max(1, 2000000 // (n + 1))
                reps, per = 1, float("inf")
                for _ in range(2):
                    while True:
                        batch = None if reuse else [build(raw) for _ in range(reps)]
                        start = clock()
                        if reuse:
                            for _ in range(reps):
                                fn(*first)
                        else:
                            for args in batch:
                                fn(*args)
                        spent = (clock() - start) * 1000
                        if spent >= 8 or reps >= most:
                            per = min(per, spent / reps)
                            break
                        reps = min(most, reps * (16 if spent < 0.5 else 4))
            except BaseException as err:
                out["error"] = {"n": n, "message": type(err).__name__ + ": " + str(err)}
                break
            out["time"].append([n, per])
            measured.append(n)
            slow = per > 40 or (clock() - began) * 1000 > __BUDGET__
            if prev > 0 and (per / prev > 20 or per * per / prev > 250):
                slow = True
            if slow:
                if n != last:
                    out["stopped"] = "slow"
                break
            prev = per

        # Space: the most extra memory a call holds at once, its deepest
        # recursion, and how many lines it runs (exact, unlike time).
        class Stop(BaseException):
            pass

        def traced(args, state):
            def lines(frame, event, arg):
                if event == "line":
                    state[2] += 1
                    if state[2] > __STEPS__:
                        raise Stop()
                elif event == "return":
                    state[0] -= 1
                return lines

            def calls(frame, event, arg):
                if event == "call":
                    state[0] += 1
                    if state[0] > state[1]:
                        state[1] = state[0]
                    return lines
                return None

            _cx_tm.start()
            _cx_sys.settrace(calls)
            try:
                fn(*args)
                return True
            except BaseException:
                return False
            finally:
                _cx_sys.settrace(None)
                state.append(_cx_tm.get_traced_memory()[1])
                _cx_tm.stop()

        # A first traced call pays one-time costs; it isn't counted.
        if measured:
            traced(build(spec["inputs"][0][1]), [0, 0, 0])
        began = clock()
        for n, raw in spec["inputs"]:
            if n not in measured or n > __MAXN__:
                break
            state = [0, 0, 0]

            if not traced(build(raw), state):
                break
            out["space"].append([n, state[3], state[1], state[2]])
            if (clock() - began) * 1000 > __SPACE_BUDGET__:
                break
    finally:
        _cx_sys.stdout = real_stdout
        _cx_sys.settrace(None)
        if _cx_tm.is_tracing():
            _cx_tm.stop()
    print(__MARKER__ + _cx_json.dumps(out))


_cx_meter()
`;

export function pythonMeterProgram(code: string, target: MeterTarget, specJson: string): string {
  const resolve =
    target.call.kind === "function"
      ? `names.get(${JSON.stringify(target.call.name)})`
      : `(lambda cls: getattr(cls(), ${JSON.stringify(target.call.name)}, None) if isinstance(cls, type) else None)(names.get("Solution"))`;
  return (
    code +
    "\n" +
    fill(PY_METER, {
      __SPEC__: JSON.stringify(specJson),
      __RESOLVE__: resolve,
      __MARKER__: JSON.stringify(METER_MARKER),
      __BUDGET__: String(TIME_BUDGET_MS),
      __SPACE_BUDGET__: String(SPACE_BUDGET_MS),
      __MAXN__: String(SPACE_MAX_N.python),
      __STEPS__: String(STEP_LIMIT),
    })
  );
}

// ---------- Reading the result ----------

const pairs = (value: unknown, width: number): number[][] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is number[] =>
          Array.isArray(row) && row.length === width && row.every((x) => typeof x === "number" && Number.isFinite(x)),
      )
    : [];

export function parseMeterOutput(output: string): RawMeasurement | null {
  const line = output
    .split("\n")
    .reverse()
    .find((text) => text.startsWith(METER_MARKER));
  if (!line) return null;
  try {
    const data = JSON.parse(line.slice(METER_MARKER.length)) as Record<string, unknown>;
    const error = data.error as { n?: unknown; message?: unknown } | null;
    return {
      time: pairs(data.time, 2) as [number, number][],
      space: pairs(data.space, 4) as [number, number, number, number][],
      error:
        error && typeof error.message === "string"
          ? { n: typeof error.n === "number" ? error.n : 0, message: error.message.slice(0, 300) }
          : null,
      stopped: typeof data.stopped === "string" ? data.stopped : undefined,
    };
  } catch {
    return null;
  }
}