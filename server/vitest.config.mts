import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const stub = (name: string) => fileURLToPath(new URL(`./test/stubs/${name}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Clerk is swapped for small stand-ins, so tests sign in with
    // "test:<name>" tokens instead of real accounts.
    alias: {
      "@clerk/express": stub("clerk-express.ts"),
      "@clerk/backend": stub("clerk-backend.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // The integration tests share one test database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
