import { defineConfig } from "vite";

/**
 * Dev-server config for the demo (npm run demo:dev). Root is demo/ itself;
 * the @paker/* entry aliases mirror ADR-0001 so the spec's import strings
 * resolve to the library sources. The offline network edge is static: the
 * dev server serves demo/public/api/users — the two-user witness — so
 * /api/users answers without internet (workplan_demo.md, Decisions).
 */

const path = (rel: string) => new URL(rel, import.meta.url).pathname;

export default defineConfig({
  root: path("."),
  resolve: {
    alias: {
      "@paker/value": path("../src/value/index.ts"),
      "@paker/store": path("../src/store/index.ts"),
      "@paker/actions": path("../src/actions/index.ts"),
      "@paker/adapters/rxjs": path("../src/adapters/rxjs/index.ts"),
      "@paker/utils": path("../src/utils/index.ts"),
    },
  },
});
