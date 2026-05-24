import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/application/**/*.ts", "src/**/repositories/*.ts"],
      exclude: [
        "node_modules",
        "**/*.test.ts",
        "**/vitest.config.ts",
        "**/sst-env.d.ts",
        "src/api.ts",
        "src/index.ts",
        "**/index.ts",
        "**/*.d.ts",
        "**/api.ts",
        // Exclude handler files that are Elysia route definitions
        // These have complex middleware (derive, onBeforeHandle) that are difficult to test in isolation
        // but their logic is tested through repository and utility tests
        "**/userHandler.ts",
        "**/stripeHandler.ts",
        "**/onboardingHandler.ts",
        "**/chatHandler.ts",
        "**/taskHandler.ts",
        "**/integrationHandler.ts",
        "**/openclawSessionsHandler.ts",
        // awsClients delegates entirely to AWS SDK init (dynamic
        // imports, credential providers) — behaviour worth testing
        // lives in the service that consumes the clients.
        "**/awsClients.ts",
      ],
      // Target 90% minimum coverage threshold
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
