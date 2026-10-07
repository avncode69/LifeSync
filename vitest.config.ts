import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/api/**/*.test.ts", "apps/web/src/lib/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    maxWorkers: 2,
  },
});
