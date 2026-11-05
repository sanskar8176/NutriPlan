import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": root,
      // `server-only` throws outside a React Server Components bundler; stub it for unit tests.
      "server-only": path.resolve(root, "tests/mocks/server-only.ts"),
    },
  },
});
