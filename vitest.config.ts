import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    restoreMocks: true,
    coverage: {
      provider: "v8",
    },
  },
});
