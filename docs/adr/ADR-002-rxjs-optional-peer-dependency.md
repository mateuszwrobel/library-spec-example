# ADR-002: RxJS is an optional peer dependency confined to the adapter entry point

Status: accepted

## Context

The spec makes RxJS an optional integration: "optional RxJS integration", first-class features for value/store/actions that never mention it, and tree-shakability by design. The repository already lists `rxjs` as a devDependency.

## Decision

`@paker/adapters/rxjs` is the only module allowed to import RxJS. RxJS is declared as an optional peer dependency for consumers; within this repository it stays a devDependency used by adapter code paths, tests, and demo. No other module references RxJS types or operators.

## Consequences

- Positive: apps that never import the adapter carry no RxJS in their graph; the adapter's surface (event streams, `skipOn`, `forward`) is the only coupling point; versions of React/vitest stack stay untouched.
- Negative: the adapter entry requires the consumer to install RxJS; missing peer produces a clear module-resolution failure, acceptable and conventional.
- Type contracts of events (`InferEvents`, `InferEventPayload`) must not leak RxJS types into other modules' signatures.

## Alternatives considered

- Hard dependency: rejected — forces RxJS on every consumer, contradicts the feature list.
- Hand-rolled operator mini-library inside the adapter: rejected — forecasting an abstraction the spec does not ask for; the spec explicitly shows standard RxJS operators in event pipelines.
- Adapter as a separate npm package now: rejected — packaging decision deferred to ADR-001; same behavioral contract either way.
