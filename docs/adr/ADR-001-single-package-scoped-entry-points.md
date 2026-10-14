# ADR-001: Single package with scoped entry points

Status: accepted

## Context

The Paker specification shows imports that look like separate packages (`@paker/value`, `@paker/store`, `@paker/actions`, `@paker/adapters/rxjs`) and demands tree-shakability by design. The repository is one small TypeScript library with a single test stack. A real multi-package monorepo would add workspace tooling, per-package versioning, and cross-package publishing concerns that the current requirement does not ask for.

## Decision

Ship one package. The spec's scoped names are treated as module identities: each gets its own side-effect-free entry module, mapped by TypeScript path aliases so every spec example compiles verbatim (`@paker/adapters/rxjs` etc. resolve to the corresponding entry module). One `package.json`, one vitest run, one typecheck.

## Consequences

- Positive: minimal tooling; imports match the spec; entry-point boundaries keep the tree-shakable structure honest (no cross-entry internal imports).
- Negative: if the project later publishes the scoped names as real npm packages, entries must split into workspace packages — the behavioral contracts stay package-independent, so only packaging changes.
- Publishing layout is deferred; nothing in this plan depends on a published artifact.

## Alternatives considered

- Multi-package monorepo: rejected — workspace/versioning machinery with no current requirement; violates "build only what is asked".
- Single entry point (`@paker/paker`): rejected — all composition code would sit behind one barrel, weakening the tree-shakability-by-design guarantee and the spec's per-primitive import identity.
