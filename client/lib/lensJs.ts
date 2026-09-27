// Lens for JavaScript and TypeScript.
//
// The user's code is rewritten (instrumented) with Babel so that it reports
// every step itself: before each statement it hands the runtime a small
// function that reads the variables in scope, functions report when they're
// entered and left, and returns report their value. The rewritten program
// runs in the regular JavaScript sandbox, and the runtime prints the same
// recording format as the Python tracer, so the rest of Lens (player,
// memory view, sharing) works unchanged. TypeScript types are stripped in
// the same pass, so every line stays where it was.

import type { NodePath, PluginObj, types as BabelTypes } from "@babel/core";

type BabelStandalone = typeof import("@babel/standalone");
type BabelApi = typeof import("@babel/core");
type Statement = BabelTypes.Statement;

// ---------- The runtime (runs inside the sandbox) ----------

// Plain text: no backticks or "${" (String.raw keeps it exactly as written).
// It's evaluated in the sandbox, where "console" is the runner's console.
const LENS_JS_RUNTIME = String.raw`var __lens = (function (realConsole) {
  "use strict";
  var MAX_STEPS = 1000;
  var MAX_ITEMS = 60;
  var MAX_OBJECTS = 250;
  var MAX_FRAMES = 30;
  var MAX_TEXT = 100;
  var MAX_OUTPUT = 20000;
  var MARKER = "__CODESHARE_LENS__";
  // Thrown to end a run at the step limit.
  var STOP = { lensStop: true };
  var GLOBAL_OBJECT = typeof globalThis !== "undefined" ? globalThis : self;

  var steps = [];
  var stack = [];
  var output = "";
  var clipped = false;
  var stopped = false;
  var truncated = false;
  var finished = false;
  var quiet = 0;
  var error = null;
  var globalFrame = null;
  var failing = null;
  var failingLine = null;
  var ids = new WeakMap();
  var nextId = 1;
  var toSource = Function.prototype.toString;
  var hasOwn = Object.prototype.hasOwnProperty;

  function clip(text) {
    return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT - 1) + "…" : text;
  }

  // The same formatting as the Run button, so output looks identical.
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

  function describeError(err) {
    if (err instanceof Error) return err.name + ": " + err.message;
    return "Uncaught " + format(err, 1, new WeakSet());
  }

  function write() {
    if (stopped) return;
    var parts = [];
    for (var i = 0; i < arguments.length; i++) parts.push(format(arguments[i], 0, new WeakSet()));
    var text = parts.join(" ") + "\n";
    var room = MAX_OUTPUT - output.length;
    if (room <= 0) {
      clipped = true;
      return;
    }
    if (text.length > room) {
      text = text.slice(0, room);
      clipped = true;
    }
    output += text;
  }

  // ---------- Values ----------

  function primitive(value) {
    if (value === undefined) return ["none", "undefined"];
    if (value === null) return ["none", "null"];
    switch (typeof value) {
      case "boolean":
        return ["bool", value ? "true" : "false"];
      case "number":
        return [Number.isInteger(value) ? "int" : "float", Object.is(value, -0) ? "-0" : String(value)];
      case "bigint":
        return ["int", clip(String(value) + "n")];
      case "string":
        return ["str", clip(JSON.stringify(value))];
      case "symbol":
        return ["other", clip(String(value))];
    }
    return null;
  }

  function sourceOf(fn) {
    try {
      return toSource.call(fn);
    } catch (e) {
      return "";
    }
  }

  function paramsOf(fn) {
    var src = sourceOf(fn);
    if (/\[native code\]/.test(src)) return "…";
    var open = src.indexOf("(");
    var arrow = src.indexOf("=>");
    if (arrow !== -1 && (open === -1 || arrow < open)) return clip(src.slice(0, arrow).replace(/^async\s+/, "").trim());
    if (open === -1) return "";
    var depth = 0;
    for (var i = open; i < src.length; i++) {
      var ch = src[i];
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) return clip(src.slice(open + 1, i).replace(/\s+/g, " ").trim());
      }
    }
    return "";
  }

  function describe(id, value, ref) {
    var i;
    if (typeof value === "function") {
      if (/^class[\s{]/.test(sourceOf(value))) return { id: id, k: "class", name: value.name || "anonymous" };
      return { id: id, k: "func", name: value.name || "anonymous", params: paramsOf(value) };
    }
    if (Array.isArray(value)) {
      var items = [];
      for (i = 0; i < value.length && i < MAX_ITEMS; i++) items.push(ref(value[i]));
      return { id: id, k: "list", items: items, more: Math.max(0, value.length - MAX_ITEMS) };
    }
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      var typed = [];
      for (i = 0; i < value.length && i < MAX_ITEMS; i++) typed.push(ref(value[i]));
      return { id: id, k: "list", cls: value.constructor.name, items: typed, more: Math.max(0, value.length - MAX_ITEMS) };
    }
    if (value instanceof Map) {
      var entries = [];
      value.forEach(function (v, k) {
        if (entries.length < MAX_ITEMS) entries.push([ref(k), ref(v)]);
      });
      return { id: id, k: "dict", cls: "Map", entries: entries, more: Math.max(0, value.size - MAX_ITEMS) };
    }
    if (value instanceof Set) {
      var members = [];
      value.forEach(function (v) {
        if (members.length < MAX_ITEMS) members.push(ref(v));
      });
      return { id: id, k: "set", cls: "Set", items: members, more: Math.max(0, value.size - MAX_ITEMS) };
    }
    if (value instanceof Error) return { id: id, k: "other", text: clip(value.name + ": " + value.message) };
    if (value instanceof Date) return { id: id, k: "other", text: isNaN(value.getTime()) ? "Invalid Date" : value.toISOString() };
    if (value instanceof RegExp) return { id: id, k: "other", text: clip(String(value)) };
    if (value instanceof Promise) return { id: id, k: "other", text: "Promise" };
    if (value instanceof WeakMap) return { id: id, k: "other", text: "WeakMap" };
    if (value instanceof WeakSet) return { id: id, k: "other", text: "WeakSet" };

    var proto = Object.getPrototypeOf(value);
    var cls = proto === null || proto === Object.prototype ? "Object" : (proto.constructor && proto.constructor.name) || "Object";
    var keys = Object.keys(value);
    var fields = [];
    for (i = 0; i < keys.length && fields.length < MAX_ITEMS; i++) {
      // Only plain data: reading a getter could run the user's code.
      var desc = Object.getOwnPropertyDescriptor(value, keys[i]);
      if (desc && "value" in desc) fields.push([keys[i], ref(desc.value)]);
    }
    var shape = "obj";
    if (hasOwn.call(value, "next") && keys.length >= 2) shape = "lnode";
    else if (hasOwn.call(value, "left") && hasOwn.call(value, "right")) shape = "tnode";
    return { id: id, k: shape, cls: cls, fields: fields };
  }

  // ---------- Steps ----------

  function snapshot(chain, extra) {
    var heap = [];
    var index = new Map();
    var queue = [];
    function ref(value) {
      var shown = primitive(value);
      if (shown) return shown;
      var id = ids.get(value);
      if (!id) {
        id = "o" + nextId++;
        ids.set(value, id);
      }
      if (!index.has(id)) {
        if (index.size >= MAX_OBJECTS) return ["other", "…"];
        index.set(id, heap.length);
        heap.push(null);
        queue.push([id, value]);
      }
      return ["ref", id];
    }
    var frames = [];
    for (var i = 0; i < chain.length; i++) {
      var frame = chain[i];
      var vars = [];
      if (frame.get) {
        try {
          frame.get(function (name, value) {
            if (name === "this" && (value === undefined || value === null || value === GLOBAL_OBJECT)) return;
            vars.push([name, ref(value)]);
          });
        } catch (e) {}
      }
      if (extra && i === chain.length - 1) vars.push(["return value", ref(extra.value)]);
      frames.push({ name: frame.name, line: frame.line, vars: vars });
    }
    for (var q = 0; q < queue.length; q++) {
      var item = queue[q];
      try {
        heap[index.get(item[0])] = describe(item[0], item[1], ref);
      } catch (e) {
        heap[index.get(item[0])] = { id: item[0], k: "other", text: "?" };
      }
    }
    return { frames: frames, heap: heap };
  }

  function record(event, line, extra, exc) {
    if (steps.length >= MAX_STEPS) {
      truncated = true;
      stopped = true;
      throw STOP;
    }
    var chain = stack.slice();
    if (!chain.length) return;
    var hidden = 0;
    if (chain.length > MAX_FRAMES) {
      hidden = chain.length - MAX_FRAMES;
      chain = [chain[0]].concat(chain.slice(hidden + 1));
    }
    var snap = snapshot(chain, extra);
    var step = { line: line, event: event, frames: snap.frames, heap: snap.heap, out: output.length };
    if (hidden) step.hidden = hidden;
    if (exc !== undefined) step.exc = exc;
    steps.push(step);
  }

  function inactive() {
    return quiet > 0 || finished;
  }

  var api = {
    console: { log: write, info: write, warn: write, error: write, debug: write, trace: write, table: write, dir: write },

    // The program's own frame.
    g: function () {
      globalFrame = { name: "Global", line: null, get: null };
      stack.push(globalFrame);
      return globalFrame;
    },

    // A statement is about to run; "get" reads the variables in scope.
    s: function (line, get) {
      if (inactive()) return;
      if (stopped) throw STOP;
      var frame = stack[stack.length - 1];
      if (!frame) return;
      frame.line = line;
      frame.get = get;
      record("line", line);
    },

    // A function was called.
    c: function (name, line) {
      if (inactive()) return null;
      if (stopped) throw STOP;
      var frame = { name: name, line: line, get: null };
      stack.push(frame);
      return frame;
    },

    // A function is returning; the value passes straight through.
    r: function (frame, value) {
      if (!frame || inactive()) return value;
      if (stopped) throw STOP;
      record("return", frame.line, { value: value });
      return value;
    },

    // A function is done (runs even when it throws).
    l: function (frame) {
      if (!frame) return;
      var at = stack.lastIndexOf(frame);
      if (at !== -1) stack.splice(at, 1);
    },

    // An exception is passing through a function.
    x: function (frame, err) {
      if (!frame || inactive() || stopped || err === STOP) return;
      if (failing !== err) {
        failing = err;
        failingLine = frame.line;
      }
      record("exception", frame.line, null, describeError(err));
    },

    // await / yield: the frame steps off the stack while it waits, and back
    // on when it resumes.
    p: function (frame, value) {
      api.l(frame);
      return value;
    },
    w: function (frame, value) {
      if (frame && !finished) stack.push(frame);
      return value;
    },

    // Test helpers build their input without recording steps.
    q: function (fn) {
      quiet++;
      try {
        return fn();
      } finally {
        quiet--;
      }
    },

    // Replaced by the program when a test is visualized: finds the user's
    // own ListNode / TreeNode class.
    u: function () {
      return undefined;
    },

    // A top-level block finished: its variables stay visible at the end,
    // like Python's globals (this is how a visualized test's result stays
    // on screen).
    k: function (get) {
      if (inactive() || !globalFrame) return;
      globalFrame.keep = get;
    },

    // The program reached its last line.
    e: function (get) {
      if (inactive() || stopped || !globalFrame) return;
      var keep = globalFrame.keep;
      globalFrame.get = !keep
        ? get
        : function (visit) {
            var seen = new Set();
            get(function (name, value) {
              seen.add(name);
              visit(name, value);
            });
            keep(function (name, value) {
              if (!seen.has(name)) visit(name, value);
            });
          };
      api.done();
    },

    done: function () {
      if (finished || stopped || !globalFrame) return;
      stack = [globalFrame];
      try {
        record("end", null);
      } catch (e) {}
      finished = true;
    },

    fail: function (err) {
      if (finished) return;
      if (err === STOP || stopped) {
        truncated = true;
        finished = true;
        return;
      }
      var line = failing === err ? failingLine : globalFrame ? globalFrame.line : null;
      error = { line: typeof line === "number" ? line : null, message: describeError(err) };
      if (globalFrame) {
        stack = [globalFrame];
        try {
          record("exception", globalFrame.line, null, error.message);
        } catch (e) {}
      }
      finished = true;
    },

    finish: function () {
      finished = true;
      var json;
      try {
        json = JSON.stringify({ steps: steps, stdout: output, error: error, truncated: truncated, outputClipped: clipped });
      } catch (e) {
        json = JSON.stringify({
          steps: [],
          stdout: output,
          error: { line: null, message: "Lens couldn't save this recording." },
          truncated: false,
          outputClipped: clipped,
        });
      }
      realConsole.log(MARKER + json);
    },
  };
  return api;
})(console);
`;

// ---------- The instrumenter ----------

const HIDDEN_NAME = /^__l/;
// Bindings that exist at runtime (not TypeScript-only names).
const RUNTIME_KINDS = new Set(["var", "let", "const", "hoisted", "param"]);
const LOOPS = new Set(["ForStatement", "WhileStatement", "DoWhileStatement", "ForInStatement", "ForOfStatement"]);

type Visible = { name: string; pos: number };

function lensPlugin(options: { resolve: string[] }) {
  return (api: BabelApi): PluginObj => {
    const t = api.types;
    // Nodes this plugin created or already handled.
    const done = new WeakSet<object>();

    const lens = (method: string) => t.memberExpression(t.identifier("__lens"), t.identifier(method));
    const frame = () => t.identifier("__lf");
    const statement = (code: string) => {
      const node = api.template.statement.ast(code) as Statement;
      done.add(node);
      return node;
    };

    // The variables visible at a position, from the innermost block out to
    // the enclosing function (or the program), in declaration order.
    function visibleNames(path: NodePath, position: number, everything = false): Visible[] {
      const stop = path.scope.getFunctionParent() ?? path.scope.getProgramParent();
      const seen = new Set<string>();
      const found: Visible[] = [];
      let scope: typeof path.scope | null = path.scope;
      while (scope) {
        for (const [name, binding] of Object.entries(scope.bindings)) {
          if (seen.has(name)) continue;
          seen.add(name);
          if (HIDDEN_NAME.test(name) || binding.kind === "module" || binding.kind === "local") continue;
          const pos = binding.identifier.start ?? 0;
          // Not declared yet: a let/const would throw, a var is just undefined.
          const hoisted = binding.kind === "hoisted" || binding.kind === "param";
          if (!everything && !hoisted && pos > position) continue;
          if (!RUNTIME_KINDS.has(binding.kind)) continue;
          found.push({ name, pos });
        }
        if (scope === stop) break;
        scope = scope.parent;
      }
      return found.sort((a, b) => a.pos - b.pos);
    }

    function usesThis(path: NodePath) {
      const fn = path.getFunctionParent();
      return !!fn && !fn.isArrowFunctionExpression();
    }

    // (__lv) => { try { __lv("i", i) } catch {} ... }. Every read is guarded:
    // a let/const can still be uninitialized, and nothing may break a step.
    function getter(names: Visible[], withThis: boolean) {
      const body: Statement[] = names.map(({ name }) => {
        const read = t.expressionStatement(
          t.callExpression(t.identifier("__lv"), [t.stringLiteral(name), t.identifier(name)]),
        );
        return t.tryStatement(t.blockStatement([read]), t.catchClause(null, t.blockStatement([])));
      });
      if (withThis) {
        const read = t.expressionStatement(
          t.callExpression(t.identifier("__lv"), [t.stringLiteral("this"), t.thisExpression()]),
        );
        body.push(t.tryStatement(t.blockStatement([read]), t.catchClause(null, t.blockStatement([]))));
      }
      const fn = t.arrowFunctionExpression([t.identifier("__lv")], t.blockStatement(body));
      done.add(fn);
      return fn;
    }

    function stepCall(path: NodePath, line: number, position: number) {
      const call = t.callExpression(lens("s"), [
        t.numericLiteral(line),
        getter(visibleNames(path, position), usesThis(path)),
      ]);
      done.add(call);
      return call;
    }

    // Runs inside the user's code (not a user function), so generated
    // functions and blocks there are left alone.
    function isGenerated(path: NodePath) {
      return !path.node.loc || done.has(path.node);
    }

    function wrapInBlock(path: NodePath) {
      if (!path.node || path.isBlockStatement()) return;
      path.replaceWith(t.blockStatement([path.node as Statement]));
    }

    function skipsStep(node: Statement) {
      if (t.isFunctionDeclaration(node) || t.isEmptyStatement(node)) return true;
      if (LOOPS.has(node.type) && node.type !== "DoWhileStatement") return true;
      return t.isLabeledStatement(node) && LOOPS.has(node.body.type);
    }

    // A step before every statement in a list. Statements sharing a line
    // with their if / loop / case header don't get a second step.
    function instrumentList(paths: NodePath<Statement>[], headerLine: number | null) {
      for (const stmt of paths) {
        const node = stmt.node;
        if (!node.loc || done.has(node) || node.start == null) continue;
        done.add(node);
        if (skipsStep(node)) continue;
        if (headerLine !== null && node.loc.start.line === headerLine) continue;
        const step = t.expressionStatement(stepCall(stmt, node.loc.start.line, node.start));
        done.add(step);
        stmt.insertBefore(step).forEach((inserted) => inserted.skip());
      }
    }

    function keyName(key: BabelTypes.Node, computed: boolean) {
      if (computed) return "[computed]";
      if (t.isIdentifier(key)) return key.name;
      if (t.isStringLiteral(key) || t.isNumericLiteral(key)) return String(key.value);
      if (t.isPrivateName(key)) return "#" + key.id.name;
      return "anonymous";
    }

    function inferredName(path: NodePath): string | null {
      const parent = path.parentPath;
      if (!parent) return null;
      const node = parent.node;
      if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) return node.id.name;
      if (t.isAssignmentExpression(node)) {
        if (t.isIdentifier(node.left)) return node.left.name;
        if (t.isMemberExpression(node.left)) return keyName(node.left.property, node.left.computed);
      }
      if (
        (t.isObjectProperty(node) || t.isClassProperty(node) || t.isClassPrivateProperty(node)) &&
        node.value === path.node
      ) {
        return keyName(node.key, "computed" in node ? !!node.computed : false);
      }
      if (t.isCallExpression(node) && t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
        return node.callee.property.name + " callback";
      }
      return null;
    }

    function frameName(path: NodePath<BabelTypes.Function>): string {
      const node = path.node;
      if ((t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id) return node.id.name;
      if (t.isClassMethod(node) || t.isClassPrivateMethod(node) || t.isObjectMethod(node)) {
        const key = keyName(node.key, "computed" in node ? !!node.computed : false);
        const method =
          node.kind === "get"
            ? "get " + key
            : node.kind === "set"
              ? "set " + key
              : node.kind === "constructor"
                ? "constructor"
                : key;
        if (t.isObjectMethod(node)) return method;
        const classPath = path.parentPath?.parentPath;
        const className =
          classPath && (classPath.isClassDeclaration() || classPath.isClassExpression())
            ? (classPath.node.id?.name ?? inferredName(classPath))
            : null;
        return className ? className + "." + method : method;
      }
      return inferredName(path) ?? "anonymous";
    }

    // The function (not the program) a node belongs to, if it's traced.
    function tracedFunction(path: NodePath) {
      const fn = path.getFunctionParent();
      return fn && fn.node.loc && !done.has(fn.node) ? fn : null;
    }

    return {
      visitor: {
        Function: {
          enter(path) {
            if (isGenerated(path)) return;
            // Expression-bodied arrows get a block, so they have a return step.
            if (path.isArrowFunctionExpression() && !t.isBlockStatement(path.node.body)) {
              const expr = path.node.body;
              const ret = t.returnStatement(expr);
              ret.loc = expr.loc;
              ret.start = expr.start;
              path.get("body").replaceWith(t.blockStatement([ret]));
            }
          },
          exit(path) {
            if (isGenerated(path)) return;
            const node = path.node;
            const body = node.body;
            if (!t.isBlockStatement(body)) return;
            const line = node.loc!.start.line;
            const last = body.body[body.body.length - 1];
            const falls = !last || !(t.isReturnStatement(last) || t.isThrowStatement(last));
            const tryBody = [...body.body];
            if (falls) tryBody.push(statement("__lens.r(__lf, void 0);"));
            const wrapped = t.blockStatement(
              [
                statement("const __lf = __lens.c(" + JSON.stringify(frameName(path)) + ", " + line + ");"),
                t.tryStatement(
                  t.blockStatement(tryBody),
                  t.catchClause(
                    t.identifier("__le"),
                    t.blockStatement([statement("__lens.x(__lf, __le);"), statement("throw __le;")]),
                  ),
                  t.blockStatement([statement("__lens.l(__lf);")]),
                ),
              ],
              body.directives,
            );
            done.add(node);
            node.body = wrapped;
            path.skip();
          },
        },

        ReturnStatement: {
          exit(path) {
            if (done.has(path.node) && !path.node.loc) return;
            // Top-level returns end the program; they aren't a function's return.
            if (!tracedFunction(path) || done.has(path.node.argument ?? {})) return;
            const value = t.callExpression(lens("r"), [
              frame(),
              path.node.argument ?? t.unaryExpression("void", t.numericLiteral(0)),
            ]);
            done.add(value);
            path.node.argument = value;
          },
        },

        AwaitExpression: {
          exit(path) {
            if (done.has(path.node)) return;
            if (path.getFunctionParent() && !tracedFunction(path)) return;
            const inner = t.awaitExpression(t.callExpression(lens("p"), [frame(), path.node.argument]));
            done.add(inner);
            path.replaceWith(t.callExpression(lens("w"), [frame(), inner]));
            path.skip();
          },
        },

        YieldExpression: {
          exit(path) {
            if (done.has(path.node) || !tracedFunction(path)) return;
            const arg = path.node.argument ?? t.unaryExpression("void", t.numericLiteral(0));
            const inner = t.yieldExpression(t.callExpression(lens("p"), [frame(), arg]), path.node.delegate);
            done.add(inner);
            path.replaceWith(t.callExpression(lens("w"), [frame(), inner]));
            path.skip();
          },
        },

        // Bodies that aren't blocks become blocks, so their statements get steps.
        "ForStatement|WhileStatement|DoWhileStatement|ForInStatement|ForOfStatement": {
          enter(path) {
            if (!isGenerated(path)) wrapInBlock(path.get("body") as NodePath);
          },
        },

        IfStatement: {
          enter(path) {
            if (isGenerated(path)) return;
            wrapInBlock(path.get("consequent"));
            if (path.node.alternate) wrapInBlock(path.get("alternate") as NodePath);
          },
        },

        // for / while / do-while: a step on the loop line before every test.
        "ForStatement|WhileStatement|DoWhileStatement": {
          exit(path) {
            const node = path.node as BabelTypes.ForStatement | BabelTypes.WhileStatement | BabelTypes.DoWhileStatement;
            if (!node.loc || done.has(node.test ?? node)) return;
            const line =
              node.type === "DoWhileStatement" && node.test.loc ? node.test.loc.start.line : node.loc.start.line;
            const position = node.test?.start ?? node.body.start ?? node.start ?? 0;
            const test = t.sequenceExpression([stepCall(path, line, position), node.test ?? t.booleanLiteral(true)]);
            done.add(test);
            node.test = test;
          },
        },

        // for...of / for...in: a step on the loop line as each pass starts.
        "ForInStatement|ForOfStatement": {
          exit(path) {
            const node = path.node as BabelTypes.ForInStatement | BabelTypes.ForOfStatement;
            if (!node.loc || !t.isBlockStatement(node.body) || done.has(node.body)) return;
            done.add(node.body);
            const bodyPath = path.get("body") as NodePath<BabelTypes.BlockStatement>;
            const step = t.expressionStatement(stepCall(bodyPath, node.loc.start.line, node.body.start ?? 0));
            done.add(step);
            bodyPath.unshiftContainer("body", step).forEach((inserted) => inserted.skip());
          },
        },

        BlockStatement: {
          exit(path) {
            if (done.has(path.node) && !path.node.loc) return;
            const parent = path.parentPath;
            if (!parent || (parent.isFunction() && isGenerated(parent))) return;
            const header =
              parent.isIfStatement() || LOOPS.has(parent.node.type) ? (parent.node.loc?.start.line ?? null) : null;
            instrumentList(path.get("body"), header);
            if (parent.isProgram() && path.node.loc) {
              const keep = t.expressionStatement(
                t.callExpression(lens("k"), [getter(visibleNames(path, Infinity, true), false)]),
              );
              done.add(keep);
              path.pushContainer("body", keep).forEach((inserted) => inserted.skip());
            }
          },
        },

        SwitchCase: {
          exit(path) {
            instrumentList(path.get("consequent"), path.node.loc?.start.line ?? null);
          },
        },

        Program: {
          exit(path) {
            instrumentList(path.get("body"), null);
            const end = t.expressionStatement(
              t.callExpression(lens("e"), [getter(visibleNames(path, Infinity, true), false)]),
            );
            done.add(end);
            path.pushContainer("body", end).forEach((inserted) => inserted.skip());

            const prologue = [statement("const __lf = __lens.g();")];
            if (options.resolve.length) {
              // Lets code outside the user's program (the test helpers, the
              // complexity meter) reach the user's own functions and classes.
              prologue.push(
                statement(
                  "__lens.u = function (name) { " +
                    options.resolve
                      .map((name) => `try { if (name === ${JSON.stringify(name)}) return ${name}; } catch (e) {} `)
                      .join("") +
                    "};",
                ),
              );
            }
            path.unshiftContainer("body", prologue).forEach((inserted) => inserted.skip());
          },
        },
      },
    };
  };
}

// ---------- Building the program ----------

export type LensJsProgram = { program: string } | { error: { line: number | null; message: string } };

const PARSER_OPTS = { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true };
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function syntaxError(err: unknown): { line: number | null; message: string } {
  const e = err as { loc?: { line?: unknown }; message?: unknown } | null;
  const line = typeof e?.loc?.line === "number" ? e.loc.line : null;
  const first = String(e?.message ?? "This code couldn't be read.").split("\n")[0];
  const message = first.replace(/^[^:]*main\.(?:ts|js):\s*/, "").replace(/\s*\(\d+:\d+\)\s*$/, "");
  return { line, message: message.startsWith("SyntaxError") ? message : `SyntaxError: ${message}` };
}

// The user's code, instrumented to call a Lens runtime (__lens). "resolve"
// lists names that code outside the program can look up with __lens.u(name).
// One pass: TypeScript's types are stripped while the code is instrumented,
// so every step keeps its original line, and code the TypeScript transform
// generates (enums, parameter properties) has no line of its own and isn't
// stepped through. Throws on code that can't be read.
export function instrumentJsWith(
  Babel: BabelStandalone,
  code: string,
  options: { typescript?: boolean; resolve?: string[] } = {},
): string {
  return (
    Babel.transform(code, {
      filename: options.typescript ? "main.ts" : "main.js",
      presets: options.typescript ? [["typescript", { allExtensions: true }]] : [],
      plugins: [lensPlugin({ resolve: (options.resolve ?? []).filter((name) => IDENTIFIER.test(name)) })],
      babelrc: false,
      configFile: false,
      sourceType: "script",
      parserOpts: PARSER_OPTS,
    }).code ?? ""
  );
}

// Synchronous core (Babel passed in), so it can be tested outside the browser.
export function buildJsTraceProgramWith(
  Babel: BabelStandalone,
  code: string,
  options: { typescript?: boolean; setup?: string } = {},
): LensJsProgram {
  try {
    const instrumented = instrumentJsWith(Babel, code, {
      typescript: options.typescript,
      // Test helpers build inputs with the user's own node classes.
      resolve: options.setup ? ["ListNode", "TreeNode"] : [],
    });

    const program = [
      LENS_JS_RUNTIME,
      "await (async function () {",
      "const console = __lens.console;",
      options.setup ?? "",
      "try {",
      "await (async function () {",
      instrumented,
      "})();",
      "__lens.done();",
      "} catch (__le) {",
      "__lens.fail(__le);",
      "}",
      "})();",
      "__lens.finish();",
    ].join("\n");
    return { program };
  } catch (err) {
    return { error: syntaxError(err) };
  }
}

export async function buildJsTraceProgram(
  code: string,
  options: { typescript?: boolean; setup?: string } = {},
): Promise<LensJsProgram> {
  const Babel = await import("@babel/standalone");
  return buildJsTraceProgramWith(Babel, code, options);
}