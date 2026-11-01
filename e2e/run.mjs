// Runs the browser tests from start to finish:
//   1. prepares the test copies of the server and the app (scripts/prepare.mjs)
//   2. empties the test database
//   3. starts the API and the app (a production build; --dev for next dev)
//   4. runs every suite, one at a time; a failed suite gets one more try
//   5. stops everything and prints a summary (exit code 1 if anything failed)
//
// Usage: node run.mjs [--dev] [suite ...]    e.g. node run.mjs four snake
// Needs MongoDB at E2E_MONGODB_URI (default mongodb://127.0.0.1:27017/codeshare-e2e).
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepare } from "./scripts/prepare.mjs";

const E2E = fileURLToPath(new URL(".", import.meta.url));
const REPO = join(E2E, "..");
const SERVER = join(REPO, "server");
const APP = join(E2E, ".app");
const LOGS = join(E2E, "logs");
const NEXT = join(REPO, "client/node_modules/next/dist/bin/next");

const API = process.env.E2E_API_URL || "http://localhost:5055";
const BASE = process.env.E2E_APP_URL || "http://localhost:3000";
const MONGODB_URI = process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:27017/codeshare-e2e";
// How long one suite may run before it's stopped (each normally takes under
// two minutes).
const SUITE_TIMEOUT_MS = Number(process.env.E2E_SUITE_TIMEOUT_MS) || 240_000;

const SUITES = [
  "room-regression",
  "framework",
  "landing-games",
  "hover-jitter",
  "keys-guard",
  "keyword-bitflip",
  "keyword-online",
  "quizzes",
  "racer-solo",
  "reactions",
  "four",
  "pairs",
  "snake",
];

const args = process.argv.slice(2);
const dev = args.includes("--dev");
const chosen = args.filter((arg) => !arg.startsWith("--"));
for (const name of chosen) if (!SUITES.includes(name)) throw new Error(`Unknown suite "${name}". Suites: ${SUITES.join(", ")}`);
const suites = chosen.length ? chosen : SUITES;

mkdirSync(LOGS, { recursive: true });
const running = [];

function start(label, command, commandArgs, options) {
  const log = createWriteStream(join(LOGS, `${label}.log`));
  // Its own process group, so stopping it stops anything it started.
  const child = spawn(command, commandArgs, { ...options, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  running.push(child);
  return child;
}

function stopAll() {
  for (const child of running) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
}
process.on("exit", stopAll);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

function finish(label, command, commandArgs, options) {
  return new Promise((resolve, reject) => {
    const child = start(label, command, commandArgs, options);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code}); see e2e/logs/${label}.log`))));
  });
}

async function responds(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function waitUntilUp(url, label, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await responds(url)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} didn't start within ${ms / 1000}s; see e2e/logs/`);
}

async function emptyDatabase() {
  // The server's own MongoDB driver.
  const { MongoClient } = createRequire(join(SERVER, "package.json"))("mongodb");
  const client = await MongoClient.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    for (const collection of await client.db().collections()) await collection.deleteMany({});
  } finally {
    await client.close();
  }
}

function runSuite(name) {
  return new Promise((resolve) => {
    let output = "";
    // Its own process group too, so a suite that hangs is stopped together
    // with the browser it started.
    const child = spawn(process.execPath, [join(E2E, "tests", `${name}.mjs`)], {
      cwd: E2E,
      env: { ...process.env, E2E_API_URL: API, E2E_APP_URL: BASE },
      detached: true,
    });
    running.push(child);
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    }, SUITE_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      running.splice(running.indexOf(child), 1);
      const summary = /(\d+) passed, (\d+) failed/.exec(output);
      const passed = summary ? Number(summary[1]) : 0;
      const failed = summary ? Number(summary[2]) : 0;
      const ok = code === 0 && !!summary && failed === 0 && /page errors: none/.test(output);
      resolve({ ok, passed, failed, output, timedOut: code === null });
    });
  });
}

const startedAt = Date.now();
for (const [url, label] of [[API, "the test API"], [BASE, "the test app"]]) {
  if (await responds(url)) throw new Error(`Something is already running at ${url}, where ${label} should start. Stop it first: the tests start their own.`);
}

console.log("Preparing the test copies of the server and the app…");
await prepare();
await emptyDatabase();

console.log("Starting the API…");
start("api", process.execPath, [join(E2E, "dist/server.cjs")], {
  cwd: E2E,
  env: {
    ...process.env,
    NODE_PATH: join(SERVER, "node_modules"),
    MONGODB_URI,
    PORT: new URL(API).port || "5055",
    CLIENT_URL: BASE,
    CLERK_SECRET_KEY: "test",
  },
});
await waitUntilUp(`${API}/health`, "The API", 30_000);

const appEnv = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
const port = new URL(BASE).port || "3000";
// Always from a clean slate: what an earlier build or dev run left behind can
// leak stale classes into Tailwind's CSS.
rmSync(join(APP, ".next"), { recursive: true, force: true });
if (dev) {
  console.log("Starting the app (next dev)…");
  start("app", process.execPath, [NEXT, "dev", "-p", port], { cwd: APP, env: appEnv });
} else {
  console.log("Building the app (next build)…");
  await finish("app-build", process.execPath, [NEXT, "build"], { cwd: APP, env: appEnv });
  console.log("Starting the app (next start)…");
  start("app", process.execPath, [NEXT, "start", "-p", port], { cwd: APP, env: appEnv });
}
await waitUntilUp(BASE, "The app", 180_000);

const lines = [];
let allOk = true;
let checks = 0;
for (const name of suites) {
  const began = Date.now();
  let result = await runSuite(name);
  let note = "";
  if (!result.ok) {
    writeFileSync(join(LOGS, `${name}.first-try.txt`), result.output);
    result = await runSuite(name);
    note = result.ok ? " (passed on the second try)" : "";
  }
  writeFileSync(join(LOGS, `${name}.txt`), result.output);
  checks += result.passed;
  allOk &&= result.ok;
  const failures = result.output.split("\n").filter((line) => line.startsWith("✗")).slice(0, 8);
  const errors = result.ok ? "" : (result.output.split("page errors:")[1] || "").trim().slice(0, 500);
  const line =
    `${result.ok ? "PASS" : "FAIL"} ${name}: ${result.passed} passed, ${result.failed} failed, ${Math.round((Date.now() - began) / 1000)}s${note}` +
    (result.timedOut ? "\n    (timed out)" : "") +
    (failures.length ? `\n    ${failures.join("\n    ")}` : "") +
    (errors && errors !== "none" ? `\n    page errors: ${errors}` : "");
  console.log(line);
  lines.push(line);
}

const summary = `\n${allOk ? "All suites passed" : "Some suites FAILED"}: ${checks} checks in ${suites.length} suites, ${Math.round((Date.now() - startedAt) / 1000)}s`;
console.log(summary);
writeFileSync(join(LOGS, "summary.txt"), lines.join("\n") + "\n" + summary + "\n");
process.exit(allOk ? 0 : 1);
