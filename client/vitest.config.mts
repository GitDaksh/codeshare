import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");

// Unit tests for the app's plain logic (games, the test judge, the code
// sandbox's policy). No browser: npm test runs them in Node.
export default defineConfig({
  resolve: {
    // The same "@/…" imports as the app (tsconfig.json paths).
    alias: [{ find: /^@\//, replacement: `${root}/` }],
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
