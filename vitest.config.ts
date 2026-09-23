import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // The model tests fit and backtest on the committed tables; under coverage they run slower.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // Every library module counts, imported by a test or not, so an untested module shows up
      // as a zero rather than as an absence (ENHANCEMENTS §6.2).
      include: ["src/lib/**/*.ts"],
      reporter: ["text-summary", "json-summary"],
      // Floors a little under what the suite reaches today: they catch a drop, not a plateau.
      thresholds: { statements: 84, branches: 72, functions: 82, lines: 87 },
    },
  },
});
