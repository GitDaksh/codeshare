// Shared helpers for the browser tests.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");

// Where the app and the API run during the tests (run.mjs starts both).
export const BASE = process.env.E2E_APP_URL || "http://localhost:3000";
export const API = process.env.E2E_API_URL || "http://localhost:5055";
// Screenshots the tests take along the way (handy when one fails).
export const SHOTS = fileURLToPath(new URL("../shots", import.meta.url));
mkdirSync(SHOTS, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A request to the API as a test user ("alice" → user_alice), or signed out.
export async function api(user, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer test:${user}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text };
  }
}

// A signed-in (or signed-out, user = null) browser context. The app's Clerk
// stand-in reads the "cs-test-user" cookie.
export async function contextFor(browser, user, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  if (user) await context.addCookies([{ name: "cs-test-user", value: user, url: BASE }]);
  return context;
}

// Counts checks and collects page errors. done() prints the summary that
// run.mjs reads, and fails the process if anything went wrong.
export function tracker() {
  let passed = 0,
    failed = 0;
  const errors = [];
  return {
    check(name, ok, detail = "") {
      console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
      ok ? passed++ : failed++;
    },
    watch(page, label) {
      page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !/Download the React DevTools|favicon/.test(m.text())) errors.push(`${label} console: ${m.text().slice(0, 300)}`);
      });
    },
    errors,
    done() {
      console.log(`\n${passed} passed, ${failed} failed`);
      if (errors.length) console.log("page errors:\n  " + [...new Set(errors)].slice(0, 15).join("\n  "));
      else console.log("page errors: none");
      const ok = failed === 0 && errors.length === 0;
      if (!ok) process.exitCode = 1;
      return ok;
    },
  };
}

// Logs failed API responses (status >= 400) for a page.
export function watchResponses(page, sink) {
  page.on("response", (r) => {
    if (r.status() >= 400) sink.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`);
  });
}
