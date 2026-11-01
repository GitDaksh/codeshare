import { describe, expect, it } from "vitest";
import { JS_RUNNER_SOURCE, PYODIDE_BASE, PYTHON_RUNNER_SOURCE, SANDBOX_CSP, buildSandboxDocument } from "@/lib/sandboxRunners";

// The policy as a map: directive -> its sources.
const policy = new Map(
  SANDBOX_CSP.split(";").map((part) => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources] as const;
  }),
);

describe("the sandbox's Content Security Policy", () => {
  it("blocks everything not listed", () => {
    expect(policy.get("default-src")).toEqual(["'none'"]);
    expect(SANDBOX_CSP).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(SANDBOX_CSP).not.toContain("http:");
  });

  it("lets code reach only the Python runtime's server", () => {
    const pyodide = new URL(PYODIDE_BASE).origin;
    expect(pyodide).toBe("https://cdn.jsdelivr.net");
    expect(policy.get("connect-src")).toEqual([pyodide, "blob:", "data:"]);
  });

  it("allows what the runners need: inline host, eval for the code, WebAssembly for Python, workers", () => {
    const scripts = policy.get("script-src")!;
    for (const needed of ["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", "blob:", "data:"]) expect(scripts).toContain(needed);
    expect(policy.get("worker-src")).toEqual(["blob:", "data:"]);
  });

  it("is the first thing in every sandbox document", () => {
    for (const [source, options] of [[JS_RUNNER_SOURCE, {}], [PYTHON_RUNNER_SOURCE, { moduleWorker: true }]] as const) {
      const html = buildSandboxDocument(source, options);
      const head = html.slice(0, html.indexOf("</head>"));
      expect(head).toBe(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">`);
      expect(SANDBOX_CSP).not.toContain('"');
    }
  });

  it("downloads Python from the same place the policy allows", () => {
    expect(PYTHON_RUNNER_SOURCE).toContain(`var PYODIDE_BASE = ${JSON.stringify(PYODIDE_BASE)};`);
    expect(PYTHON_RUNNER_SOURCE).not.toContain("__PYODIDE_BASE__");
  });
});
