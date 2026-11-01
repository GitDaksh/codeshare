// Gets everything ready for the browser tests, without touching the real
// app or server:
//   dist/server.cjs   the real server, with Clerk swapped for a test stand-in
//   dist/*.mjs        game helpers the tests use (from the app's own code)
//   .app/             a copy of the app with Clerk swapped the same way
// Tests sign in as "alice", "bob" and so on: the stand-ins read a cookie (the
// app) or a "test:<name>" token (the API). Nothing here is ever deployed.
//
// E2E_OFFLINE=1 also makes the copy work without internet: local fonts
// instead of Google Fonts, and the code editor served from node_modules
// instead of its CDN.
import { build } from "esbuild";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const E2E = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(E2E, "..");
const CLIENT = join(REPO, "client");
const SERVER = join(REPO, "server");
const APP = join(E2E, ".app");
const DIST = join(E2E, "dist");

export async function prepare({ offline = process.env.E2E_OFFLINE === "1" } = {}) {
  await buildServer();
  await buildHelpers();
  mirrorApp({ offline });
}

async function buildServer() {
  await build({
    entryPoints: [join(SERVER, "src/server.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: join(DIST, "server.cjs"),
    // Everything else comes from server/node_modules (run.mjs sets NODE_PATH).
    packages: "external",
    alias: {
      "@clerk/express": join(E2E, "stubs/server/clerk-express.js"),
      "@clerk/backend": join(E2E, "stubs/server/clerk-backend.js"),
    },
    logLevel: "error",
  });
}

async function buildHelpers() {
  for (const name of ["four", "pairs"]) {
    await build({
      entryPoints: [join(E2E, `helpers/${name}.ts`)],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: join(DIST, `${name}.mjs`),
      alias: { "@": CLIENT },
      nodePaths: [join(CLIENT, "node_modules")],
      logLevel: "error",
    });
  }
}

// Not copied (from the app's top folder): installed or built files, its own
// Next config (replaced below) and its unit tests. Nor are local .env files.
const SKIP = new Set(["node_modules", ".next", "next.config.ts", "next-env.d.ts", "tsconfig.tsbuildinfo", "test", "vitest.config.mts"]);
// Files this script makes in the copy, which syncing must leave alone.
const OURS = new Set(["node_modules", ".next", "next.config.ts", "next-env.d.ts", ".env.local", "__stubs__", "app/tmpfonts", "public/monaco"]);

function walk(root, dir, visit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(root, path);
    if (root === CLIENT && (SKIP.has(rel) || name.startsWith(".env"))) continue;
    if (root === APP && OURS.has(rel)) continue;
    if (lstatSync(path).isDirectory()) walk(root, path, visit);
    else visit(rel, path);
  }
}

function sameFile(a, b) {
  return existsSync(b) && statSync(a).size === statSync(b).size && readFileSync(a).equals(readFileSync(b));
}

function mirrorApp({ offline }) {
  mkdirSync(APP, { recursive: true });
  // Copy new and changed files; remove files the app no longer has.
  const seen = new Set();
  walk(CLIENT, CLIENT, (rel, path) => {
    seen.add(rel);
    const dest = join(APP, rel);
    if (sameFile(path, dest)) return;
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(path, dest);
  });
  walk(APP, APP, (rel, path) => {
    if (!seen.has(rel)) rmSync(path);
  });

  // The app's packages, as installed for the real app.
  if (!existsSync(join(APP, "node_modules"))) symlinkSync(join(CLIENT, "node_modules"), join(APP, "node_modules"), "dir");

  mkdirSync(join(APP, "__stubs__"), { recursive: true });
  for (const name of ["clerk-nextjs.tsx", "clerk-nextjs-server.ts"]) {
    copyFileSync(join(E2E, "stubs/client", name), join(APP, "__stubs__", name));
  }

  writeFileSync(
    join(APP, "next.config.ts"),
    `// Made by e2e/scripts/prepare.mjs: the app with Clerk swapped for a test stand-in.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // The repository, so the linked node_modules (in client/) resolve.
    root: ${JSON.stringify(REPO)},
    resolveAlias: {
      "@clerk/nextjs/server": "./__stubs__/clerk-nextjs-server.ts",
      "@clerk/nextjs": "./__stubs__/clerk-nextjs.tsx",
    },
  },
  // The real app is type-checked in CI; the stand-ins don't match Clerk's types.
  typescript: { ignoreBuildErrors: true },
  devIndicators: false,
};

export default nextConfig;
`,
  );

  writeFileSync(
    join(APP, ".env.local"),
    [
      `NEXT_PUBLIC_API_URL=${process.env.E2E_API_URL || "http://localhost:5055"}`,
      // A placeholder: the stand-in never talks to Clerk.
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
      "NEXT_TELEMETRY_DISABLED=1",
      "",
    ].join("\n"),
  );

  if (offline) patchForOffline();
}

function patchForOffline() {
  // Fonts: Next's bundled Geist files instead of downloading from Google.
  const fonts = join(APP, "app/tmpfonts");
  mkdirSync(fonts, { recursive: true });
  const nextFonts = join(CLIENT, "node_modules/next/dist/next-devtools/server/font");
  copyFileSync(join(nextFonts, "geist-latin.woff2"), join(fonts, "geist.woff2"));
  copyFileSync(join(nextFonts, "geist-mono-latin.woff2"), join(fonts, "mono.woff2"));
  const layoutPath = join(APP, "app/layout.tsx");
  const layout = readFileSync(layoutPath, "utf8")
    .replace('import { Geist, JetBrains_Mono } from "next/font/google";', 'import localFont from "next/font/local";')
    .replace('const geist = Geist({ subsets: ["latin"], variable: "--font-display" });', 'const geist = localFont({ src: "./tmpfonts/geist.woff2", variable: "--font-display" });')
    .replace(
      'const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });',
      'const jetbrainsMono = localFont({ src: "./tmpfonts/mono.woff2", variable: "--font-mono" });',
    );
  if (!layout.includes("localFont")) throw new Error("E2E_OFFLINE: couldn't switch the app to local fonts (app/layout.tsx changed?)");
  writeFileSync(layoutPath, layout);

  // The code editor: served from node_modules instead of its CDN.
  if (!existsSync(join(APP, "public/monaco"))) symlinkSync(join(CLIENT, "node_modules/monaco-editor/min"), join(APP, "public/monaco"), "dir");
  const editorPath = join(APP, "components/CodeEditor.tsx");
  const editor = readFileSync(editorPath, "utf8").replace(
    'import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";',
    'import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";\nloader.config({ paths: { vs: "/monaco/vs" } });',
  );
  if (!editor.includes("loader.config")) throw new Error("E2E_OFFLINE: couldn't serve the editor locally (components/CodeEditor.tsx changed?)");
  writeFileSync(editorPath, editor);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await prepare();
  console.log("Ready: dist/ and .app/");
}
