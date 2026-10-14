# dependency-cruiser architecture guard

```json
{
  "task": "depcruise-arch-guard",
  "status": "done",
  "links": ["dependency-cruiser.json", "workplans/workplan_paker_library.md"],
  "date": "2026-10-14"
}
```

dependency-cruiser added as the architecture guard: `npm run lint:arch` mechanically enforces the import boundaries agreed in the parent workplan's Modularity → Boundaries section — RxJS importable only inside `src/adapters/rxjs` (ADR-0002), cross-module imports of `value`/`store`/`actions`/adapter/`utils` entry-point-only (tree-shakability + no-internals coupling), `src/utils` reachable from runtime code via type-only imports exclusively (ADR-0003 branding), `demo/` terminal (nothing imports it; deletable wholesale), and no module cycles. The guard pins layout identities (`src/{value,store,actions,utils,adapters/rxjs}/index.ts` + `demo/`) so lane implementers follow a fixed structure and deviation requires a deliberate config change. AGENTS.md Project facts and the parent workplan (Decisions bullet, tree-shaking risk mitigation) updated to record the guard.

Rules were self-tested with scratch probes (value internal cross-import, demo import from src, rxjs import outside the adapter, runtime import of utils — each caught by its rule; a type-only utils import from store and an rxjs import inside the adapter — each correctly not caught). All probe files deleted before commit; post-cleanup `npm run lint:arch` and `npm run typecheck` both exit 0.

Version corrections made against dependency-cruiser 18.6.0 (recorded because they diverge minimally from the planned config text):

- `rxjs-confined` `to` rewritten as `{ "path": "^node_modules[/\\\\]rxjs([/\\\\]|$)" }` — the old nested `module.path` shape is rejected by the 18.x schema, and 18.x matches `to.path` against resolved dependency paths, so the bare-specifier regex was inert.
- `options.parser: "swc"` + devDependency `@swc/core` — the repo pins `typescript@^7` (native compiler, no JS compiler API), which is outside depcruise's supported TS transpiler range (`>=2 <7`); without a fallback parser depcruise silently cruised zero `.ts` files. swc is the tool's own documented fallback; `parser: "swc"` also keeps `import type` attribution correct (without the explicit setting, type-only imports misclassify as value imports and `utils-type-only` false-positives). The `missing-typescript-transpiler` warning banner persists (triggered by the approved `tsConfig`/`tsPreCompilationDeps` options) but does not affect the exit code; revisit when depcruise ships typescript@>=7 support.
- `options.doNotFollow: { "path": "^node_modules" }` — `depcruise .` otherwise recurses third-party packages and floods `no-circular` with node_modules-internal cycles (and crashes the swc parser on third-party `.d.ts` files). npm dependencies stay in the graph as leaves, so `rxjs-confined` still matches.
- `lint:arch` script carries `--config dependency-cruiser.json` — 18.x auto-discovery only looks for dot-prefixed `.dependency-cruiser.*` names; the un-dotted `dependency-cruiser.json` filename stays (referenced verbatim from AGENTS.md and the workplan).
