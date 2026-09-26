// Source code for the isolated code runners.
//
// These are plain JavaScript strings, not imported modules: they execute
// inside a sandboxed iframe (and, where the browser allows, a Web Worker
// inside it), with no access to the app, its cookies, or the user's session.
// They must not use template literals or anything from the app bundle.
//
// Each runner defines createRunner(post), which returns a message handler.
// The same source runs in a worker (post = self.postMessage) or, as a
// fallback, directly in the sandboxed frame (post = parent.postMessage).
//
// The Python runner needs a *module* worker: Pyodide 314 refuses to start in
// classic workers ("Classic web workers are not supported") and ships its
// loader as an ES module, which is loaded with import(). Inside the sandbox,
// a module worker can only be started from a data: URL (see HOST_SOURCE).

export const JS_RUNNER_SOURCE = String.raw`
function createRunner(post) {
  var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  // Grace period after the program finishes, so short timers (setTimeout 0)
  // still get their console output captured.
  var SETTLE_MS = 50;

  function format(value, depth, seen) {
    if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
    if (typeof value === "bigint") return String(value) + "n";
    if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "function") return "[Function " + (value.name || "anonymous") + "]";
    if (value instanceof Error) return value.name + ": " + value.message;
    if (seen.has(value)) return "[Circular]";
    if (depth > 4) return Array.isArray(value) ? "[Array]" : "[Object]";
    seen.add(value);
    var out;
    if (Array.isArray(value)) {
      out = "[" + value.map(function (v) { return format(v, depth + 1, seen); }).join(", ") + "]";
    } else if (value instanceof Map) {
      var mapItems = [];
      value.forEach(function (v, k) { mapItems.push(format(k, depth + 1, seen) + " => " + format(v, depth + 1, seen)); });
      out = "Map(" + value.size + ") {" + mapItems.join(", ") + "}";
    } else if (value instanceof Set) {
      var setItems = [];
      value.forEach(function (v) { setItems.push(format(v, depth + 1, seen)); });
      out = "Set(" + value.size + ") {" + setItems.join(", ") + "}";
    } else {
      var entries = Object.keys(value).map(function (k) {
        var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
        return key + ": " + format(value[k], depth + 1, seen);
      });
      out = entries.length ? "{ " + entries.join(", ") + " }" : "{}";
    }
    seen.delete(value);
    return out;
  }

  function makeConsole(lines) {
    function write() {
      var args = Array.prototype.slice.call(arguments);
      lines.push(args.map(function (a) { return format(a, 0, new WeakSet()); }).join(" "));
    }
    return { log: write, info: write, warn: write, error: write, debug: write, trace: write, table: write, dir: write };
  }

  // Line numbers inside new Function() code are offset by the two lines of
  // the generated function header.
  function userLine(err) {
    var match = String((err && err.stack) || "").match(/(?:<anonymous>|Function):(\d+):\d+/);
    if (!match) return null;
    var line = Number(match[1]) - 2;
    return line >= 1 ? line : null;
  }

  function describe(err) {
    if (err instanceof Error) {
      var line = userLine(err);
      return (line ? "Line " + line + ": " : "") + err.name + ": " + err.message;
    }
    return "Uncaught " + format(err, 1, new WeakSet());
  }

  // Errors thrown while *compiling* the code (syntax errors). Their stack
  // points at the runner, not the user's code, so only Firefox's own
  // lineNumber (when present) is trustworthy.
  function describeCompileError(err) {
    if (!(err instanceof Error)) return "Uncaught " + format(err, 1, new WeakSet());
    var line = typeof err.lineNumber === "number" && err.lineNumber > 2 ? err.lineNumber - 2 : null;
    return (line ? "Line " + line + ": " : "") + err.name + ": " + err.message;
  }

  function clone(value) {
    return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Linked lists and binary trees travel as arrays (LeetCode style) and are
  // rebuilt into nodes here, using the user's own ListNode/TreeNode classes
  // when their code defines them.
  var MAX_NODES = 100000;

  function makeNodes(UserListNode, UserTreeNode) {
    function listNode(val) {
      if (typeof UserListNode === "function") {
        try {
          var made = new UserListNode(val);
          made.val = val;
          made.next = null;
          return made;
        } catch (e) {}
      }
      return { val: val, next: null };
    }

    function treeNode(val) {
      if (typeof UserTreeNode === "function") {
        try {
          var made = new UserTreeNode(val);
          made.val = val;
          made.left = null;
          made.right = null;
          return made;
        } catch (e) {}
      }
      return { val: val, left: null, right: null };
    }

    function buildList(values) {
      var head = null;
      var tail = null;
      for (var i = 0; i < values.length; i++) {
        var node = listNode(values[i]);
        if (tail === null) head = node;
        else tail.next = node;
        tail = node;
      }
      return head;
    }

    function buildTree(values) {
      if (!values.length || values[0] === null) return null;
      var root = treeNode(values[0]);
      var queue = [root];
      var head = 0;
      var i = 1;
      while (i < values.length && head < queue.length) {
        var node = queue[head++];
        if (i < values.length) {
          if (values[i] !== null) {
            node.left = treeNode(values[i]);
            queue.push(node.left);
          }
          i++;
        }
        if (i < values.length) {
          if (values[i] !== null) {
            node.right = treeNode(values[i]);
            queue.push(node.right);
          }
          i++;
        }
      }
      return root;
    }

    function listToArray(head) {
      var out = [];
      var node = head;
      while (node !== null && node !== undefined) {
        if (out.length >= MAX_NODES) throw new Error("The returned list never ends. Check for a cycle.");
        out.push(node.val);
        node = node.next;
      }
      return out;
    }

    function treeToArray(root) {
      if (root === null || root === undefined) return [];
      var out = [];
      var queue = [root];
      var head = 0;
      while (head < queue.length) {
        if (queue.length > MAX_NODES * 2 + 1) throw new Error("The returned tree is too large. Check for a cycle.");
        var node = queue[head++];
        if (node === null || node === undefined) {
          out.push(null);
          continue;
        }
        out.push(node.val);
        queue.push(node.left === undefined ? null : node.left);
        queue.push(node.right === undefined ? null : node.right);
      }
      while (out.length && out[out.length - 1] === null) out.pop();
      return out;
    }

    return {
      toInput: function (value, type) {
        if (type === "list") return buildList(value);
        if (type === "list[]") return value.map(buildList);
        if (type === "tree") return buildTree(value);
        return value;
      },
      toOutput: function (value, type) {
        if (type === "list") return listToArray(value);
        if (type === "tree") return treeToArray(value);
        return value;
      },
    };
  }

  async function runProgram(msg) {
    var lines = [];
    var error = null;
    post({ type: "started", id: msg.id });
    var program;
    try {
      program = new AsyncFunction("console", msg.code);
    } catch (err) {
      post({ type: "done", id: msg.id, output: "", error: describeCompileError(err) });
      return;
    }
    try {
      await program(makeConsole(lines));
      await wait(SETTLE_MS);
    } catch (err) {
      error = describe(err);
    }
    post({ type: "done", id: msg.id, output: lines.join("\n"), error: error });
  }

  async function runTests(msg) {
    var lines = [];
    var consoleShim = makeConsole(lines);
    post({ type: "started", id: msg.id });

    var factory;
    try {
      factory = new Function(
        "console",
        msg.code +
          "\n;return {" +
          " fn: typeof " + msg.fnName + " === \"function\" ? " + msg.fnName + " : undefined," +
          " ListNode: typeof ListNode === \"function\" ? ListNode : undefined," +
          " TreeNode: typeof TreeNode === \"function\" ? TreeNode : undefined };"
      );
    } catch (err) {
      post({ type: "done", id: msg.id, fatal: describeCompileError(err), results: [], logs: "" });
      return;
    }

    var env;
    try {
      env = factory(consoleShim);
    } catch (err) {
      post({ type: "done", id: msg.id, fatal: describe(err), results: [], logs: lines.join("\n") });
      return;
    }
    var fn = env.fn;

    if (typeof fn !== "function") {
      post({
        type: "done",
        id: msg.id,
        fatal: "Couldn't find a function named " + msg.fnName + ". Keep the function name from the starter code.",
        results: [],
        logs: lines.join("\n"),
      });
      return;
    }

    var nodes = makeNodes(env.ListNode, env.TreeNode);
    var argTypes = msg.argTypes || [];
    // In-place problems check an argument after the call instead of the return value.
    var outputArg = typeof msg.outputArg === "number" ? msg.outputArg : null;
    var outputType = outputArg !== null ? argTypes[outputArg] : msg.returnType;

    var results = [];
    for (var i = 0; i < msg.tests.length; i++) {
      var args = clone(msg.tests[i].args).map(function (value, index) {
        return nodes.toInput(value, argTypes[index]);
      });
      var started = performance.now();
      var returned;
      try {
        returned = fn.apply(null, args);
        if (returned && typeof returned.then === "function") returned = await returned;
      } catch (err) {
        results.push({ ok: false, error: describe(err), ms: performance.now() - started });
        continue;
      }
      var ms = performance.now() - started;

      var actual;
      try {
        actual = nodes.toOutput(outputArg !== null ? args[outputArg] : returned, outputType);
      } catch (err) {
        results.push({ ok: false, error: String((err && err.message) || err), ms: ms });
        continue;
      }

      var json;
      try { json = JSON.stringify(actual); } catch (e) { json = undefined; }
      results.push({
        ok: true,
        actualJson: json === undefined ? null : json,
        display: format(actual, 1, new WeakSet()),
        ms: ms,
      });
    }
    post({ type: "done", id: msg.id, results: results, logs: lines.join("\n") });
  }

  return function handle(msg) {
    if (!msg || msg.type !== "run") return;
    if (msg.mode === "tests") runTests(msg);
    else runProgram(msg);
  };
}
`;

// The Python test harness (runs inside Pyodide, see PYTHON_RUNNER_SOURCE).
// Plain text: it contains no backticks, "${" or backslashes, so String.raw
// keeps it exactly as written.
const PYTHON_HARNESS = String.raw`import json as __cs_json
import copy as __cs_copy
import time as __cs_time
import traceback as __cs_traceback

__CS_MAX_NODES = 100000


class __cs_ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class __cs_TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right


def __cs_describe_error(exc):
    """One or two readable lines, pointing at the user's own code only."""
    if isinstance(exc, SyntaxError):
        line = f"Line {exc.lineno}: " if exc.lineno else ""
        return f"{line}SyntaxError: {exc.msg}"
    frames = [f for f in __cs_traceback.extract_tb(exc.__traceback__) if f.filename == "solution.py"]
    location = f"Line {frames[-1].lineno}: " if frames else ""
    message = "".join(__cs_traceback.format_exception_only(type(exc), exc)).strip()
    return f"{location}{message}"


def __cs_jsonable(value):
    if isinstance(value, (list, tuple)):
        return [__cs_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): __cs_jsonable(v) for k, v in value.items()}
    return value


def __cs_node_maker(user_class, fallback, links):
    """Builds nodes with the user's own class when they define one."""
    def make(val):
        if user_class is not None:
            try:
                node = user_class(val)
                node.val = val
                for link in links:
                    setattr(node, link, None)
                return node
            except BaseException:
                pass
        return fallback(val)
    return make


def __cs_build_list(values, make):
    head = None
    tail = None
    for value in values:
        node = make(value)
        if tail is None:
            head = node
        else:
            tail.next = node
        tail = node
    return head


def __cs_build_tree(values, make):
    if not values or values[0] is None:
        return None
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


def __cs_list_to_array(head):
    out = []
    node = head
    while node is not None:
        if len(out) >= __CS_MAX_NODES:
            raise ValueError("The returned list never ends. Check for a cycle.")
        out.append(node.val)
        node = getattr(node, "next", None)
    return out


def __cs_tree_to_array(root):
    if root is None:
        return []
    out = []
    queue = [root]
    head = 0
    while head < len(queue):
        if len(queue) > __CS_MAX_NODES * 2 + 1:
            raise ValueError("The returned tree is too large. Check for a cycle.")
        node = queue[head]
        head += 1
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(getattr(node, "left", None))
        queue.append(getattr(node, "right", None))
    while out and out[-1] is None:
        out.pop()
    return out


def __cs_run_tests(code, tests_json, fn_name, spec_json):
    tests = __cs_json.loads(tests_json)
    spec = __cs_json.loads(spec_json) if spec_json else {}
    arg_types = spec.get("argTypes") or []
    output_arg = spec.get("outputArg")
    if output_arg is not None and output_arg < len(arg_types):
        output_type = arg_types[output_arg]
    else:
        output_type = spec.get("returnType")

    namespace = {"__name__": "__solution__"}
    try:
        exec(compile(code, "solution.py", "exec"), namespace)
    except BaseException as exc:
        return __cs_json.dumps({"fatal": __cs_describe_error(exc)})

    fn = namespace.get(fn_name)
    if not callable(fn):
        return __cs_json.dumps(
            {"fatal": f"Couldn't find a function named {fn_name}. Keep the function name from the starter code."}
        )

    user_list = namespace.get("ListNode")
    user_tree = namespace.get("TreeNode")
    make_list = __cs_node_maker(user_list if isinstance(user_list, type) else None, __cs_ListNode, ("next",))
    make_tree = __cs_node_maker(user_tree if isinstance(user_tree, type) else None, __cs_TreeNode, ("left", "right"))

    def to_input(value, kind):
        if kind == "list":
            return __cs_build_list(value, make_list)
        if kind == "list[]":
            return [__cs_build_list(v, make_list) for v in value]
        if kind == "tree":
            return __cs_build_tree(value, make_tree)
        return value

    def to_output(value, kind):
        if kind == "list":
            return __cs_list_to_array(value)
        if kind == "tree":
            return __cs_tree_to_array(value)
        return value

    results = []
    for test in tests:
        raw = __cs_copy.deepcopy(test["args"])
        kinds = list(arg_types) + [None] * max(0, len(raw) - len(arg_types))
        args = [to_input(value, kind) for value, kind in zip(raw, kinds)]
        started = __cs_time.perf_counter()
        try:
            returned = fn(*args)
        except RecursionError:
            results.append({"ok": False, "error": "RecursionError: maximum recursion depth exceeded", "ms": 0})
            continue
        except BaseException as exc:
            elapsed = (__cs_time.perf_counter() - started) * 1000
            results.append({"ok": False, "error": __cs_describe_error(exc), "ms": elapsed})
            continue
        elapsed = (__cs_time.perf_counter() - started) * 1000

        try:
            actual = to_output(args[output_arg] if output_arg is not None else returned, output_type)
        except BaseException as exc:
            results.append({"ok": False, "error": str(exc), "ms": elapsed})
            continue

        try:
            actual_json = __cs_json.dumps(__cs_jsonable(actual))
        except (TypeError, ValueError):
            actual_json = None
        if output_type in ("list", "tree"):
            display = actual_json if actual_json is not None else repr(actual)
        else:
            display = repr(actual)
        results.append({"ok": True, "actualJson": actual_json, "display": display, "ms": elapsed})
    return __cs_json.dumps({"results": results})


__cs_run_tests(__cs_user_code, __cs_tests_json, __cs_fn_name, __cs_spec_json)
`;

export const PYTHON_RUNNER_SOURCE = String.raw`
function createRunner(post) {
  var PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v314.0.6/full/";
  var HARNESS = __HARNESS__;
  var pyodidePromise = null;
  var queue = Promise.resolve();

  // Works both in the module worker and in the sandboxed frame itself.
  function loadRuntime() {
    if (!pyodidePromise) {
      pyodidePromise = import(PYODIDE_BASE + "pyodide.mjs").then(function (mod) {
        return mod.loadPyodide({ indexURL: PYODIDE_BASE });
      });
      pyodidePromise.catch(function (err) {
        // The user sees a friendly message; the console gets the real reason.
        console.error("CodeShare: the Python runtime failed to load.", err);
        pyodidePromise = null;
      });
    }
    return pyodidePromise;
  }

  // Keep the traceback lines about the user's code; drop Pyodide's internals.
  function cleanError(text) {
    var lines = String(text).split("\n");
    var kept = [];
    var skipping = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*File "/.test(line)) {
        skipping = !/File "<exec>"/.test(line);
        if (skipping) continue;
        kept.push(line.replace('File "<exec>"', "Your code"));
        continue;
      }
      if (skipping && /^\s{4,}/.test(line)) continue;
      skipping = false;
      kept.push(line);
    }
    return kept.join("\n").trim();
  }

  async function execute(msg) {
    var pyodide;
    try {
      pyodide = await loadRuntime();
    } catch (err) {
      var loadError = "Couldn't load the Python runtime. Check your connection and try again.";
      post({ type: "done", id: msg.id, output: "", error: loadError, fatal: loadError, results: [], logs: "" });
      return;
    }

    var lines = [];
    pyodide.setStdout({ batched: function (text) { lines.push(text); } });
    pyodide.setStderr({ batched: function (text) { lines.push(text); } });
    post({ type: "started", id: msg.id });

    if (msg.mode === "tests") {
      try {
        pyodide.globals.set("__cs_user_code", msg.code);
        pyodide.globals.set("__cs_tests_json", JSON.stringify(msg.tests));
        pyodide.globals.set("__cs_fn_name", msg.fnName);
        pyodide.globals.set(
          "__cs_spec_json",
          JSON.stringify({
            argTypes: msg.argTypes || [],
            returnType: msg.returnType || null,
            outputArg: typeof msg.outputArg === "number" ? msg.outputArg : null,
          })
        );
        var raw = await pyodide.runPythonAsync(HARNESS);
        var parsed = JSON.parse(String(raw));
        post({
          type: "done",
          id: msg.id,
          fatal: parsed.fatal || null,
          results: parsed.results || [],
          logs: lines.join("\n"),
        });
      } catch (err) {
        post({ type: "done", id: msg.id, fatal: cleanError((err && err.message) || err), results: [], logs: lines.join("\n") });
      }
      return;
    }

    var error = null;
    try {
      await pyodide.runPythonAsync(msg.code);
    } catch (err) {
      error = cleanError((err && err.message) || err);
    }
    post({ type: "done", id: msg.id, output: lines.join("\n"), error: error });
  }

  // One run at a time, in order.
  return function handle(msg) {
    if (!msg || msg.type !== "run") return;
    queue = queue.then(
      function () { return execute(msg); },
      function () { return execute(msg); }
    );
  };
}
`.replace("__HARNESS__", () => JSON.stringify(PYTHON_HARNESS));

// Runs inside the sandboxed iframe. Starts the runner in a Web Worker (so a
// runaway loop can always be stopped by removing the frame), and falls back
// to running it directly in the frame if this browser can't create one.
export const HOST_SOURCE = String.raw`
(function (RUNNER_SOURCE, WORKER_OPTIONS) {
  var mode = "pending";
  var queue = [];
  var worker = null;
  var inlineHandle = null;

  function toParent(msg) { parent.postMessage(msg, "*"); }

  function send(msg) {
    if (mode === "worker") worker.postMessage(msg);
    else if (mode === "inline") inlineHandle(msg);
    else if (mode === "broken") toParent({ type: "fatal", message: "The code runner couldn't start in this browser." });
    else queue.push(msg);
  }

  function flush() {
    var pending = queue;
    queue = [];
    for (var i = 0; i < pending.length; i++) send(pending[i]);
  }

  function useInline() {
    if (mode === "inline" || mode === "broken") return;
    if (worker) {
      try { worker.terminate(); } catch (e) {}
      worker = null;
    }
    try {
      var createRunner = new Function(RUNNER_SOURCE + "\nreturn createRunner;")();
      inlineHandle = createRunner(toParent);
      mode = "inline";
    } catch (e) {
      mode = "broken";
    }
    flush();
  }

  try {
    var workerSource =
      RUNNER_SOURCE +
      "\nvar __handle = createRunner(function (m) { self.postMessage(m); });" +
      "\nself.onmessage = function (e) { __handle(e.data); };" +
      "\nself.postMessage({ type: '__booted' });";
    // Chrome refuses module workers from blob: URLs inside an opaque-origin
    // frame like this one, but accepts them from data: URLs (which also get
    // their own, separate opaque origin). Classic workers keep using blob:.
    var workerUrl =
      WORKER_OPTIONS.type === "module"
        ? "data:text/javascript;charset=utf-8," + encodeURIComponent(workerSource)
        : URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    worker = new Worker(workerUrl, WORKER_OPTIONS);
    worker.onmessage = function (e) {
      var data = e.data;
      if (data && data.type === "__booted") {
        if (mode === "pending") {
          mode = "worker";
          flush();
        }
        return;
      }
      toParent(data);
    };
    worker.onerror = function (e) {
      if (mode === "pending") {
        if (e && e.preventDefault) e.preventDefault();
        useInline();
      } else {
        toParent({ type: "fatal", message: "The code runner stopped unexpectedly." });
      }
    };
    setTimeout(function () { if (mode === "pending") useInline(); }, 3000);
  } catch (e) {
    useInline();
  }

  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    send(e.data);
  });

  toParent({ type: "ready" });
})(__RUNNER_SOURCE__, __WORKER_OPTIONS__);
`;

// The full HTML document loaded into the sandboxed iframe for one runner.
// moduleWorker starts the runner in a module worker (needed for Python).
export function buildSandboxDocument(runnerSource: string, options: { moduleWorker?: boolean } = {}): string {
  // "</" is escaped so the embedded source can never close the script tag.
  const embedded = JSON.stringify(runnerSource).replace(/<\//g, "<\\/");
  const workerOptions = JSON.stringify(options.moduleWorker ? { type: "module" } : {});
  return "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><script>" +
    HOST_SOURCE.replace("__RUNNER_SOURCE__", () => embedded).replace("__WORKER_OPTIONS__", () => workerOptions) +
    "</script></body></html>";
}