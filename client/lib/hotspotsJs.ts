import type { NodePath, PluginObj, types as BabelTypes } from "@babel/core";
import {
  HOTSPOTS_BUDGET,
  HOTSPOTS_MARKER,
  HOTSPOTS_MAX_FLOWS,
  HOTSPOTS_SAMPLES,
  HOTSPOTS_SLICES,
  type HotspotsProgram,
} from "@/lib/hotspots";
import { syntaxError } from "@/lib/lensJs";

type BabelStandalone = typeof import("@babel/standalone");
type BabelApi = typeof import("@babel/core");

// The counter the instrumented code calls: __hs.t(line) before every
// statement. It stays as cheap as possible (it can run millions of times),
// stops the program at the step or time budget, and keeps an evenly spaced
// sample of the run for the timeline. __lens is a small stand-in for the two
// Lens functions the Practice input helpers use (see lensPractice.ts): u()
// finds the room's own node classes, and q() builds inputs without counting.
function runtime(lastLine: number): string {
  const budget = HOTSPOTS_BUDGET.javascript;
  return String.raw`var __hs = (function (realConsole) {
  var LAST = ${lastLine}, MAX_EVENTS = ${budget.events}, MAX_MS = ${budget.ms}, MAX_SAMPLES = ${HOTSPOTS_SAMPLES};
  var counts = new Map(), flows = new Map(), samples = [], stride = 1, prev = 0, total = 0, paused = 0;
  var stopped = false, truncated = false, error = null, start = 0, elapsed = 0, out = 0;
  function Stop() {}
  function quiet() {
    return function () {
      out += 1;
    };
  }
  var console = { log: quiet(), info: quiet(), warn: quiet(), error: quiet(), debug: quiet(), table: quiet(), dir: quiet() };
  function slices(list, parts) {
    var result = [];
    var size = list.length;
    var count = Math.min(parts, size);
    for (var index = 0; index < count; index++) {
      var seen = new Map(), best = 0, bestCount = 0;
      for (var at = Math.floor((index * size) / count), end = Math.floor(((index + 1) * size) / count); at < end; at++) {
        var value = list[at], next = (seen.get(value) || 0) + 1;
        seen.set(value, next);
        if (next > bestCount) {
          best = value;
          bestCount = next;
        }
      }
      result.push(best);
    }
    return result;
  }
  return {
    console: console,
    lines: [],
    p: function (step) {
      paused += step;
    },
    begin: function () {
      start = performance.now();
    },
    t: function (line) {
      if (stopped) throw new Stop();
      if (paused || line > LAST) return;
      total++;
      counts.set(line, (counts.get(line) || 0) + 1);
      if (prev && prev !== line) {
        var key = prev * 65536 + line;
        flows.set(key, (flows.get(key) || 0) + 1);
      }
      prev = line;
      if (total % stride === 0) {
        samples.push(line);
        if (samples.length >= MAX_SAMPLES) {
          var kept = [];
          for (var i = 0; i < samples.length; i += 2) kept.push(samples[i]);
          samples = kept;
          stride *= 2;
        }
      }
      if ((total & 1023) === 0 && (total >= MAX_EVENTS || performance.now() - start > MAX_MS)) {
        stopped = true;
        truncated = true;
        throw new Stop();
      }
    },
    fail: function (err) {
      if (err instanceof Stop || stopped) {
        truncated = true;
        return;
      }
      var name = err && err.name ? String(err.name) : "Error";
      var message = err && err.message !== undefined ? String(err.message) : String(err);
      error = { line: prev || null, message: name + ": " + message };
    },
    finish: function () {
      elapsed = performance.now() - start;
      var busiest = [];
      flows.forEach(function (count, key) {
        var from = Math.floor(key / 65536), to = key % 65536;
        if (to !== from + 1) busiest.push([from, to, count]);
      });
      busiest.sort(function (a, b) {
        return b[2] - a[2];
      });
      var pairs = [];
      counts.forEach(function (count, line) {
        pairs.push([line, count]);
      });
      pairs.sort(function (a, b) {
        return a[0] - b[0];
      });
      realConsole.log(
        ${JSON.stringify(HOTSPOTS_MARKER)} +
          JSON.stringify({
            counts: pairs,
            executable: this.lines,
            flows: busiest.slice(0, ${HOTSPOTS_MAX_FLOWS}),
            timeline: slices(samples, ${HOTSPOTS_SLICES}),
            total: total,
            truncated: truncated,
            ms: Math.round(elapsed * 100) / 100,
            error: error,
          }),
      );
    },
  };
})(console);
var __lens = {
  u: function () {
    return undefined;
  },
  q: function (build) {
    __hs.p(1);
    try {
      return build();
    } finally {
      __hs.p(-1);
    }
  },
};
`;
}

const PARSER_OPTS = { allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true };

// Inserts __hs.t(line) before every statement, counts loop headers on every
// iteration (as Python's tracer does), and makes expression-bodied arrow
// functions count each call. Statements the TypeScript transform generates
// have no line of their own and aren't counted.
function hotspotsPlugin(lines: Set<number>, resolve: string[]) {
  return ({ types: t, template }: BabelApi): PluginObj => {
    const ours = new WeakSet<BabelTypes.Node>();
    const tick = (line: number) => {
      lines.add(line);
      const call = t.callExpression(t.memberExpression(t.identifier("__hs"), t.identifier("t")), [t.numericLiteral(line)]);
      ours.add(call);
      return call;
    };
    const tickStatement = (line: number) => {
      const statement = t.expressionStatement(tick(line));
      ours.add(statement);
      return statement;
    };
    const lineOf = (node: BabelTypes.Node | null | undefined) => node?.loc?.start.line ?? null;
    const asBlock = (path: NodePath<BabelTypes.Statement>) => {
      if (!path.isBlockStatement()) path.replaceWith(t.blockStatement([path.node]));
    };
    // for / while / do-while: the header line counts every time its test runs.
    const countEachTest = (path: NodePath<BabelTypes.ForStatement | BabelTypes.WhileStatement | BabelTypes.DoWhileStatement>) => {
      asBlock(path.get("body") as NodePath<BabelTypes.Statement>);
      const line = lineOf(path.node);
      if (line === null || ours.has(path.node)) return;
      ours.add(path.node);
      const test = path.node.test ?? t.booleanLiteral(true);
      path.node.test = t.sequenceExpression([tick(line), test]);
    };
    // for-in / for-of: the header line counts once per pass.
    const countEachPass = (path: NodePath<BabelTypes.ForInStatement | BabelTypes.ForOfStatement>) => {
      asBlock(path.get("body") as NodePath<BabelTypes.Statement>);
      const line = lineOf(path.node);
      if (line === null || ours.has(path.node)) return;
      ours.add(path.node);
      (path.get("body") as NodePath<BabelTypes.BlockStatement>).unshiftContainer("body", tickStatement(line));
    };

    return {
      name: "codeshare-hotspots",
      visitor: {
        Program: {
          exit(path) {
            if (!resolve.length) return;
            // Lets the Practice input helpers reach the room's own classes.
            const body = resolve
              .map((name) => `try { if (name === ${JSON.stringify(name)}) return ${name}; } catch (e) {}`)
              .join(" ");
            const lookup = template.statement.ast(`__lens.u = function (name) { ${body} };`);
            ours.add(lookup);
            path.unshiftContainer("body", lookup).forEach((inserted) => inserted.skip());
          },
        },
        IfStatement(path) {
          asBlock(path.get("consequent"));
          const alternate = path.get("alternate");
          if (alternate.node) asBlock(alternate as NodePath<BabelTypes.Statement>);
        },
        ForStatement: (path) => countEachTest(path),
        WhileStatement: (path) => countEachTest(path),
        DoWhileStatement: (path) => countEachTest(path),
        ForInStatement: (path) => countEachPass(path),
        ForOfStatement: (path) => countEachPass(path),
        WithStatement(path) {
          asBlock(path.get("body"));
        },
        ArrowFunctionExpression(path) {
          const body = path.node.body;
          if (t.isBlockStatement(body)) return;
          const result = t.returnStatement(body);
          result.loc = body.loc;
          path.get("body").replaceWith(t.blockStatement([result]));
        },
        Statement: {
          exit(path) {
            const node = path.node;
            if (ours.has(node) || t.isBlockStatement(node) || t.isEmptyStatement(node)) return;
            if (!(path.listKey === "body" || path.listKey === "consequent")) return;
            // Type-only declarations never run.
            if (t.isTSInterfaceDeclaration(node) || t.isTSTypeAliasDeclaration(node) || t.isTSDeclareFunction(node)) return;
            if ((node as { declare?: boolean }).declare) return;
            const line = lineOf(node);
            if (line === null) return;
            path.insertBefore(tickStatement(line));
          },
        },
      },
    };
  };
}

export type HotspotsJsProgram = { program: string } | { error: { line: number | null; message: string } };

// Synchronous core (Babel passed in), so it can be tested outside the browser.
export function buildHotspotsJsWith(
  Babel: BabelStandalone,
  program: HotspotsProgram,
  options: { typescript?: boolean } = {},
): HotspotsJsProgram {
  try {
    const lines = new Set<number>();
    const instrumented =
      Babel.transform(program.code, {
        filename: options.typescript ? "main.ts" : "main.js",
        presets: options.typescript ? [["typescript", { allExtensions: true }]] : [],
        plugins: [hotspotsPlugin(lines, program.setup ? ["ListNode", "TreeNode"] : [])],
        babelrc: false,
        configFile: false,
        sourceType: "script",
        parserOpts: PARSER_OPTS,
      }).code ?? "";

    const executable = [...lines].filter((line) => line <= program.lastLine).sort((a, b) => a - b);
    const source = [
      runtime(program.lastLine),
      `__hs.lines = ${JSON.stringify(executable)};`,
      "await (async function () {",
      "const console = __hs.console;",
      program.setup,
      "__hs.begin();",
      "try {",
      "await (async function () {",
      instrumented,
      "})();",
      "} catch (__he) {",
      "__hs.fail(__he);",
      "}",
      "})();",
      "__hs.finish();",
    ].join("\n");
    return { program: source };
  } catch (err) {
    return { error: syntaxError(err) };
  }
}

export async function buildHotspotsJs(program: HotspotsProgram, options: { typescript?: boolean } = {}): Promise<HotspotsJsProgram> {
  const Babel = await import("@babel/standalone");
  return buildHotspotsJsWith(Babel, program, options);
}