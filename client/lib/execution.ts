export type ExecutionResult = {
  output: string;
  error: string | null;
  durationMs: number;
};

const EXECUTION_TIMEOUT_MS = 5000;
const PYODIDE_VERSION = "314.0.6";

export function runJavaScript(code: string): Promise<ExecutionResult> {
  const start = performance.now();

  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const logs: string[] = [];
    let settled = false;

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      iframe.remove();
    }

    function handleMessage(e: MessageEvent) {
      if (e.source !== iframe.contentWindow || settled) return;

      if (e.data?.type === "log") {
        logs.push(e.data.text);
      } else if (e.data?.type === "done") {
        settled = true;
        cleanup();
        resolve({
          output: logs.join("\n"),
          error: e.data.error || null,
          durationMs: performance.now() - start,
        });
      }
    }

    window.addEventListener("message", handleMessage);

    const runnerScript = `
      const send = (type, payload) => parent.postMessage({ type, ...payload }, "*");
      console.log = (...args) => send("log", { text: args.map(String).join(" ") });
      console.error = (...args) => send("log", { text: args.map(String).join(" ") });
      try {
        ${code}
        send("done", {});
      } catch (err) {
        send("done", { error: err.message });
      }
    `;

    iframe.srcdoc = `<script>${runnerScript}<\/script>`;

    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          output: logs.join("\n"),
          error: `Execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s (possible infinite loop)`,
          durationMs: EXECUTION_TIMEOUT_MS,
        });
      }
    }, EXECUTION_TIMEOUT_MS);
  });
}

export async function runTypeScript(code: string): Promise<ExecutionResult> {
  try {
    const Babel = await import("@babel/standalone");
    const result = Babel.transform(code, {
      presets: ["typescript"],
      filename: "code.ts",
    });
    return await runJavaScript(result.code ?? "");
  } catch (err) {
    return {
      output: "",
      error: err instanceof Error ? err.message : "TypeScript compilation failed",
      durationMs: 0,
    };
  }
}

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr: (options: { batched: (text: string) => void }) => void;
};

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadingPromise: Promise<PyodideInterface> | null = null;

function loadPyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the Python runtime"));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    await loadPyodideScript();
    const pyodide = await window.loadPyodide!({
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodideLoadingPromise;
}

export async function runPython(code: string): Promise<ExecutionResult> {
  const start = performance.now();
  try {
    const pyodide = await getPyodide();
    const logs: string[] = [];
    pyodide.setStdout({ batched: (text) => logs.push(text) });
    pyodide.setStderr({ batched: (text) => logs.push(text) });

    await pyodide.runPythonAsync(code);

    return { output: logs.join("\n"), error: null, durationMs: performance.now() - start };
  } catch (err) {
    return {
      output: "",
      error: err instanceof Error ? err.message : "Python execution failed",
      durationMs: performance.now() - start,
    };
  }
}