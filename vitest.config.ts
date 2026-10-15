import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@paker/value": "/src/value/index.ts",
      "@paker/store": "/src/store/index.ts",
      "@paker/actions": "/src/actions/index.ts",
      "@paker/utils": "/src/utils/index.ts",
    },
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**"],
    },
  },
});
