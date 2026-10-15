# Workplan: Paker RxJS adapter (lane R)

> Scenario card
> **Name:** rxjs-adapter
> **Scenarios owned:** parent R1–R5
> **Contracts exposed:** adapter decorator contract (see API partial) — consumed by utils, demo
> **Contracts consumed:** value cell contract (V), store contract (S), actions decorated-instance contract (A); utils branding convention (type-level only)
> **Assumptions about siblings:** decorated instances keep their APIs and can be wrapped further; action methods called inside operators follow A's apply rule; utils reads the adapter's branded event types; the demo renders components reading adapter-preserved atomic hooks.

## Goal

As a library consumer, I want the `rxjs` adapter to decorate a value, store, or actions-decorated instance with typed event methods whose bodies are RxJS operator pipelines, so event-driven flows (fetch → receive → commit) compose with existing actions while the wrapped primitive keeps every state, action, subscription, and React behavior. Observable outcome: the spec's RxJS example runs as written.

## Acceptance Criteria

### Scenario: R1 — Event method runs its operator array
Given userStore$ = rxjs(primitive, factory) with FETCH: (amount: number) => [tap(...), switchMap(...)]
When userStore$.FETCH(5) is called
Then the operators run in declared order on a stream carrying the payload 5
  And the event method returns void
  And the same event can be called again to run a fresh stream

### Scenario: R2 — forward maps the stream value into another declared event
Given a FETCH pipeline ending in forward.RECEIVE_USERS((users) => users) and RECEIVE_USERS: (users: User[]) => [tap(() => data$.set(users))]
When FETCH resolves users from a stubbed endpoint
Then RECEIVE_USERS runs with them
  And data$ holds the users
  And forward accepts only events declared by the same factory, checked at compile time

### Scenario: R3 — skipOn terminates the current stream
Given a FETCH pipeline containing skipOn('OTHER_ACTION')
When OTHER_ACTION emits after skipOn's position in the stream
Then the FETCH stream is terminated: later operators do not run
  And effects that already executed upstream are not reverted
  And OTHER_ACTION's own handlers still run

### Scenario: R4 — Runs are independent
Given FETCH(1) and FETCH(2) called while both pipelines are in flight
Then each carries its own payload through its own operators
  And one stream terminating via skipOn does not affect the other

### Scenario: R5 — Adapter preserves wrapped APIs and React behavior
Given userStore$ = rxjs(actions(store(...), actionFactory), eventFactory)
Then state, action, subscription, and hook APIs behave as unwrapped
  And atomic hook subscriptions still scope re-renders (a Users component reading userStore$.data$() re-renders only when data changes)

## Decisions

- Event declaration form: each factory key maps a payload signature to an operator array; the event method pipes a stream starting from the payload through the array in order (R1). Rejected: raw ObservableFactory per event — the spec's array form is the contract.
- `forward.EVENT(mapper)` behaves as a pipeline stage: it maps the current stream value, checks it against the target event's payload type at compile time, and triggers a fresh run of the target event's pipeline with the mapped payload (R2). It returns nothing else observable.
- `skipOn(NAME)` is a stream-local terminator placed as an array entry: from its position downstream, the current run stops and nothing later executes; already-run upstream effects are irreversible (RxJS semantics respected); other runs and the named event's own handlers proceed (R3, R4). Rejected: whole-run rollback — impossible for side-effecting operators.
- Event methods return `void`; observation happens through the wrapped primitive's subscriptions (no selector, no result handle). Rejected: returning the run's Observable — leaks RxJS into the API surface for consumers outside this adapter.
- Concurrent same-event calls are independent runs (R4); no automatic dedupe or switchMap-between-runs policy — the author composes that inside the array if wanted. Rejected: built-in latest-wins — an opinion the spec doesn't state.
- Only this module imports RxJS (ADR-0002); `InferEvents`/`InferEventPayload` type projections must contain no RxJS types.
- Forward-using event factories declare an explicit event-map return annotation (parent decision, 2026-10-15: same intrinsic inference cycle as actions); non-forward factories infer without annotations.
- skipOn arm moment (verification WARN-2, recorded 2026-10-15; parent decision): the terminator arms when a value passes its stage (position-scoped per run) — an event emission BEFORE the stream reaches skipOn's position does not affect that run; consistent with per-run independence and the non-affectation clause of R4.
- Adapter error policy (verification WARN-2, recorded 2026-10-15; parent decision): a mid-run error terminates that run silently (no result handle exists — event methods return void); authors needing error semantics compose `catchError` within the operator array. No retry/revert invented (spec silent).

## Assumptions

- Time-dependent pipeline behavior is testable with the installed stack (`vi.useFakeTimers`, RxJS `TestScheduler` per testing-guide). If wrong: virtual-time scenarios need another harness.
- Network edges in tests use stubbed fetch (external boundary). If wrong: R2/D3 witnesses change, behavior does not.

## Risks

- Stream-vs-action interleaving: `tap(() => incrementBy(amount))` inside a stream commits via A's apply rule mid-flight; later `skipOn` cannot undo it. Impact: confusing partial updates if authors misplace `skipOn`. Mitigation: R3 pins the exact semantics; documentation follows the scenario.
- Independent-run model (R4) can produce out-of-order commits when two runs resolve at different times. Impact: last-resolved wins. Mitigation: documented; authors add ordering operators inside the array — the spec shows `switchMap` as the example's own ordering choice.

## Open Questions

- None.

## API

### Entry point

| Entry | Exports |
|---|---|
| `@paker/adapters/rxjs` | `rxjs` decorator; `InferEvents`, `InferEventPayload` re-exports |

### Contract

As parent API partial §`@paker/adapters/rxjs` — accepts value | store | either-with-actions plus an event factory receiving primitive cells/action methods and a `{ forward, skipOn }` kit; returns wrapped API plus per-event methods (`void`); compile-time event-name checks; per-run independent streams; skipOn terminates from its position.

## Modularity

### Behavior Analysis

One behavior: event-to-operator-stream lifecycle (run construction, inter-run independence, cross-event triggers via forward/skipOn). Changes when stream/event semantics change, independent of cell mechanics or the action apply protocol.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| typed event streams | actions | `rxjs adapter` (this) | stream lifecycle is a distinct reason to change from the action apply protocol; ADR-0002 confines the RxJS coupling here |

### Internal Architecture

Functional stream composition over RxJS operators; thin translation between the event-kit surface and operator placement. No DDD, no CRUD.

### Boundaries

Consumes value/store/actions entry contracts; exposes decorated instance to utils/demo; sole importer of RxJS.
