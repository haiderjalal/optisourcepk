import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit and security regression tests. Node environment only: the code under
 * test is server code (route handlers, server actions, the data access layer).
 *
 * `@/` matches the path alias in tsconfig.json. `server-only` throws when it is
 * imported outside a Server Component, so tests replace it with an empty module.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
      {
        find: "server-only",
        replacement: fileURLToPath(
          new URL("./tests/setup/server-only.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
