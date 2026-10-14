# Workplan: Paker state-management library (parent)

## Goal

As a React developer, I want to manage application state through a small set of composable, tree-shakable primitives and builders — `value`, `store`, `actions`, and an RxJS event adapter — so that each problem uses the right solution while the API stays standardized, fully type-safe, selector-free, and boilerplate-minimal. The observable outcome: every example in the Paker 1.0.0 specification compiles and behaves as documented (atomic re-renders, per-instance SSR isolation, typed actions and events, inferred utility types), proven by a demo app and a 100%-coverage gate on all library sources. Delivered as one TypeScript package with scoped entry points (ADR-001), middleware excluded per spec (post-MVP).

## Acceptance Criteria

Scenarios below are owned exclusively by the lane named in their section header. Lane IDs (V/S/A/R/U/D) appear in each sub-workplan's scenario card.

### Coverage gate (owned by parent plan)

### Scenario: 100% coverage gate
Given all library modules are implemented
When the repository coverage harness runs (vitest + v8)
Then library sources report 100% coverage
  And the demo app is excluded from the gate

### Value (lane V)

### Scenario: V1 — Initializer factories isolate instances
Given valueA = value(() => []) and valueB = value(() => []) created from the same initializer function
When valueA.set([1])
Then valueB.get() returns []
  And valueA.getInitial() returns the array its initializer produced at creation

### Scenario: V2 — Read, write, and subscribe reports pair
Given counter$ = value(0) with an attached subscriber
When counter$.set(5)
Then get() returns 5
  And the subscriber receives (5, 0)
When counter$.set(current => current + 1)
Then get() returns 6
  And the subscriber receives (6, 5)

### Scenario: V3 — Set equal to current does not notify
Given counter$ = value(5) with an attached subscriber
When counter$.set(5)
Then the subscriber is not called

### Scenario: V4 — Subscribe does not fire immediately and cleanup works
Given counter$ = value(0)
When a subscriber attaches
Then it has not been called yet
When counter$.set(1)
Then it receives (1, 0)
When the value returned by subscribe() is called
And counter$.set(2)
Then it is not called again

### Scenario: V5 — Reset and getInitial
Given counter$ = value(3) after set(10)
Then getInitial() returns 3
When reset()
Then get() returns 3
  And subscribers receive (3, 10)

### Scenario: V6 — Computed reacts to every dependency
Given counter$ = value(0), users$ = value<User[]>([]) and total$ = value([counter$, users$], (counter, users) => counter + users.length)
When counter$.set(2)
Then total$.get() returns 2
  And total$ subscribers receive the recomputed total
When users$.set([{}, {}, {}] as User[])
Then total$.get() returns 5

### Scenario: V7 — Computed exposes read APIs only
Given total$ as a computed value over counter$ and users$
When total$ is called in a component
Then it reads like a value: get(), subscribe(), callable as a React hook, and key-targeted reads where the data supports them
  And it exposes no set, setKey, or reset, and an attempt to use them is a compile-time failure

### Scenario: V8 — Callable as a React hook
Given a component that calls counter$()
Then it renders the current value without a selector
When counter$.set is called from an event handler
Then the component re-renders with the new value

### Scenario: V9 — Array key operations are immutable
Given users$ = value([a, b, c])
When users$.setKey(1, d)
Then getKey(1) returns d
  And get() returns [a, d, c] as a new array while the previously returned array still reads [a, b, c]

### Scenario: V10 — subscribeKey fires only for its key
Given users$ = value([a, b]) with a key-targeted subscriber on index 1
When setKey(0, z)
Then the key-1 subscriber is not called
When setKey(1, y)
Then it receives (y, b)
When getKey(5)
Then it returns undefined
  And a subscriber attached to the absent index 5 fires when setKey(5, n) later adds it

### Scenario: V11 — Object key operations
Given settings$ = value({ theme: "dark", locale: "en" })
When setKey("theme", "light")
Then getKey("theme") returns "light"
  And the full state reads as an object with locale untouched
When setKey("missing", 1)
Then getKey("missing") returns 1 and the add notifies key-targeted subscribers for "missing"

### Store (lane S)

### Scenario: S1 — Property cells are full value primitives
Given userStore$ = store<{ data: User[]; counter: number }>(() => ({ data: [], counter: 0 })) with attached subscribers on counter$ and data$
When userStore$.counter$.set(1)
Then counter$ subscribers receive (1, 0)
  And data$ subscribers are not called
  And userStore$.get() returns { data: [], counter: 1 }

### Scenario: S2 — Whole-store set applies per changed key
Given userStore$ as in S1
When userStore$.set({ data: [u1, u2], counter: 3 })
Then get() returns the replacement state
  And the data$ subscriber receives ([u1, u2], [])
  And the counter$ subscriber receives (3, 0)
  And the whole-store subscriber receives (current, previous) snapshots

### Scenario: S3 — Whole-store subscribe fires for any property
Given a whole-store subscriber attached
When userStore$.counter$.set(2)
Then it receives ({ data: [], counter: 2 }, { data: [], counter: 0 })

### Scenario: S4 — Store reset restores every property
Given userStore$ with data$ and counter$ modified from initial
When userStore$.reset()
Then every property is back to its initial value
  And getInitial() returns the complete initial state object

### Scenario: S5 — Store and property hooks scope re-renders
Given a component calling userStore$() and a component calling userStore$.counter$()
When data$ changes only
Then the whole-store component re-renders
  And the counter-only component does not

### Actions (lane A)

### Scenario: A1 — Decorated primitives keep their full API
Given counter$ = actions(value(0), factory) and userStore$ = actions(store(...), factory)
Then get, set, reset, getInitial, subscribe, hook calls, and property cells behave exactly as undecorated

### Scenario: A2 — Direct writes are the mutation path for void-returning actions
Given a setCounter action whose body calls value$.set(next) and returns nothing
When setCounter(7) runs
Then get() returns 7
  And subscribers receive exactly one notification for the call

### Scenario: A3 — Returning a value applies it as the next value
Given an increment action returning value$.get() + 1 with no direct set
When increment() runs
Then get() returns the incremented value

### Scenario: A4 — Returning a patch applies partial store state
Given a loadUsers action returning { data: users }
When it resolves
Then data$ holds users
  And counter$ is untouched

### Scenario: A5 — Forward reaches only declared actions
Given incrementBy returning forward.setCounter(value$.get() + amount)
When incrementBy(5) runs
Then setCounter executes with the composed value
  And names not declared by the same factory are not reachable through forward, and using one is a compile-time failure

### Scenario: A6 — Async actions apply after the promise resolves
Given loadCounter fetches from a stubbed endpoint and returns a number
When the action method is called without awaiting
Then the primitive still reads the pre-call value
  And subscribers are not notified
When the call is awaited and the fetch settles
Then the returned value is applied
  And the action method itself always returns void, synchronously and for async actions

### Scenario: A7 — Action name and parameter type checks
Given a decorated value or store
When an action method is called with a wrong parameter type or an undeclared name
Then it is a compile-time failure
  And parameter labels and optional parameters are preserved at call sites

### RxJS adapter (lane R)

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

### Utility types (lane U)

### Scenario: U1 — InferValue and InferState
Given counter$ plain, total$ computed, userStore$ with actions and events
Then InferValue<typeof counter$> is number
  And InferValue<typeof total$> is number
  And InferState<typeof userStore$> is { data: User[]; counter: number }

### Scenario: U2 — InferActions preserves call signatures
Given userStore$ decorated with the spec's actions
Then InferActions gives { setCounter(nextCounter: number): void; increment(): void; incrementBy(amount: number): void; loadUsers(): Promise<void> }
  And parameter labels and optional parameters are preserved

### Scenario: U3 — InferActionParameters and InferActionResult
Given typeof userStore$ and the name "incrementBy"
Then InferActionParameters gives [amount: number]
  And InferActionResult<typeof userStore$, "loadUsers"> is Promise<void>

### Scenario: U4 — InferEvents and InferEventPayload
Given typeof userStore$ from the spec's RxJS example
Then InferEvents gives { FETCH(amount: number): void; RECEIVE_USERS(users: User[]): void }
  And InferEventPayload for "FETCH" is number and for "RECEIVE_USERS" is User[]

### Scenario: U5 — Unknown names fail at compile time
Given userStore$ as in U1
When an unknown action or event name is passed to InferActions, InferActionParameters, InferActionResult, InferEvents, or InferEventPayload
Then resolution is a compile-time failure
  And helpers never silently widen to any

### Scenario: U6 — Utilities work through wrappers
Given the same helper applied to the primitive, actions-decorated, and actions+rxjs-decorated instances
Then each returns identical inferred types

### Demo app (lane D)

### Scenario: D1 — Counter example behaves as specified
Given the spec's Component rendered in the demo app
Then the button shows "0 (0 users, 0 total)"
When clicked once
Then it shows "1 (0 users, 1 total)"

### Scenario: D2 — Store components demonstrate atomic subscriptions
Given the spec's WholeStoreComponent and AtomicStoreComponent over one decorated store
When incrementCounter runs
Then both show the new counter value
  And re-renders are scoped per the S5 scenario

### Scenario: D3 — RxJS example renders fetched users
Given the spec's Users component with a stubbed fetch endpoint
When FETCH(5) is triggered
Then the page shows "2 users" for the two-user stub response

## Decisions

- Single package with scoped entry points, mapped by TypeScript path aliases (ADR-001) — Rationale: one package.json, one test run, spec import strings kept as module identities. Rejected: monorepo of packages because per-publish versioning and workspace tooling are not needed for one coherent library.
- RxJS is an optional peer dependency, imported only by `@paker/adapters/rxjs` (ADR-002) — Rejected: hard dependency because apps without the adapter should never pull RxJS.
- Inference utilities are defined once in `utils` (the branding-contract owner) and re-exported from each primitive entry so the spec's import strings work verbatim — Rationale: one branding convention to implement, spec-faithful imports. Rejected: per-entry independent definitions because two owners of the same type projection drift apart.
- Subscribe notification rule: fires on change, not on attach; skip when the new value is equal to the current by SameValueZero (covers primitives and reference equality) — Rejected: always-notify because `set` with an identical value is not a change; the spec says subscribers "run whenever the value changes".
- Action apply rule: returning a defined value applies it — next value for `value`, partial patch for `store`; returning nothing never applies; async actions apply after resolution; action methods always return `void` (async actions return `Promise<void>`) — Rejected: typed commit/patch wrapper objects because they add ceremony the spec's factory bodies do not have; Rejected: exposing the applied value as the action return because state observation belongs to subscriptions, not call results.
- Store whole-state `set` applies per changed key so key-targeted subscribers fire only for keys whose values actually change; whole-store subscribers fire once per property change — Rejected: one bulk notification because it breaks the atomic-subscription guarantee the store promises.
- Computed values are derived cells: same read and subscription APIs, no write APIs (V7) — Rejected: exposing `reset` on computed because there is no independent initial state to reset to.
- `skipOn` terminates the current stream from its position downstream; already-executed upstream effects are not reverted; other streams are unaffected (R3, R4) — Rejected: whole-run rollback because tap-style effects are irreversible by design in RxJS.
- `forward` (actions and adapter) is restricted to names declared by the same factory, with original parameter/payload types (A5, R2, U5) — no runtime guards; event and action methods are plain callable methods, type-checked at compile time.
- Values and stores are callable as React hooks; effect subscriptions return their cleanup (V8, S5) — this is the standardized React integration; no provider or context is required.
- Selector-free by construction: atomic property cells, key-targeted subscriptions, and computed cells cover observation needs; no selector API exists — Rationale: feature list "No selectors needed -> emitted by design".
- Tree-shakability contract: each scoped entry point is side-effect-free on import; the `value` module never imports RxJS (verified by the structure guarantee in Risks) — Rejected: bundle-size assertion tests for now because no bundler harness exists in the repo.
- 100% coverage gate on library sources, demo app excluded — Rationale: feature "100% test coverage" targets the library contract; demo is example code.
- SSR is delivered as instance isolation: initializer factories produce fresh per-instance state; the library owns no request scope — apps create per request. Rejected: built-in request-context module because the spec provides none.
- Middleware absent from this plan entirely — Rejected: reserving abstraction points for middleware because forecasting abstractions violates modular principle 9 (spec marks it post-MVP; a future wrapper module adds it when specced).

> Decomposition: all Open Questions below are resolved, so this plan is decomposed into the six lane sub-workplans listed in the Dependency Ledger.

## Assumptions

- The repository stays one package now; scoped entry points exist as path-mapped module identities (ADR-001). Depends: all lanes' import paths. If wrong (publish as separate packages): entry points must be split into workspace packages; contracts here are package-independent, so behavior survives.
- Stack: TypeScript, React 19, RxJS 7, vitest + RTL as already declared in `package.json`. Depends: every lane's test plan. If wrong (version upgrades): API contracts here are version-agnostic; only React-bridge internals would need re-check.
- Spec examples are the normative behavior source: names (`get`, `set`, `setKey`, `getKey`, `subscribe`, `subscribeKey`, `reset`, `getInitial`, `forward`, `skipOn`, `$` cell suffixes) are contractual. Depends: API partial, all scenarios. If wrong (renamed): scenarios and demo examples must be updated together.
- Hook support on values and stores is the only React integration required; no provider, context, or wrapper component. Depends: V8, S5, demo. If wrong: demo components gain a provider and re-render scoping changes.
- A `User` type exists in the demo and test fixtures only; the library holds no domain models. Depends: S, R, D lanes' witnesses. If wrong: none material — types are generic throughout.
- Test witnesses use stubbed fetch (per testing-guide: mock external boundaries only). Depends: A6, R2, D3. If wrong (real network): scenarios become flaky; behavior unchanged.

## Risks

- Type-level inference through wrapper chains is the hardest surface to satisfy (U, A, R). Impact: `Infer*` utilities resolve wrong or widen to `any`. Mitigation: branded-type contract defined in U's module; each wrapper lane delivers its own type-level scenarios alongside behavior; U verifies end-to-end composition last (dependency ledger).
- Tree-shaking could silently regress if an entry point imports another module's internals. Impact: RxJS or unused primitives leak into bundles. Mitigation: entry points depend only on other modules' published contracts (API partial), never internals; the value module never imports RxJS; reviewed at module-placement gate.
- Applying `undefined` is indistinguishable from "no return value" in actions. Impact: cannot intentionally set `value<undefined>` via an action return. Mitigation: documented rule (returning nothing never applies); `set(undefined)` remains available through the direct API.
- Subscription cleanup misuse: forgetting the returned cleanup in effects. Impact: leaked listeners. Mitigation: the subscribe call returns cleanup and the documented pattern (return in `useEffect`) is a scenario (V4).
- Advanced generic inference is error-prone for small implementation models. Impact: lane U or wrapper branding mis-implemented. Mitigation: lane workplans carry self-contained type contracts; verification includes compile-time failing-name scenarios (U5, A5, R2).

## Open Questions

- None — all resolved by Decisions and ADRs. Implementation is unblocked.

## API

The library's public surface is its entry-point contract set. Data ownership per contract in the API partial below; the Modularity section maps contracts to modules.

### Entry points

| Entry point | Purpose | Public surface (behavioral) |
|---|---|---|
| `@paker/value` | Reactive single-value cell + computed cells | `value`; read/write/subscribe/reset/getInitial; key ops on collections; callable as hook; `InferValue`-friendly type |
| `@paker/store` | Object state decomposed into per-key value cells | `store`; whole-state ops + `$`-suffixed property cells; callable as hook |
| `@paker/actions` | Decorate value or store with typed actions | `actions`; action methods; `forward`; apply rule per Decisions |
| `@paker/adapters/rxjs` | Decorate with typed event pipelines | `rxjs`; event methods; `forward`; `skipOn`; preserves wrapped APIs |
| `@paker/utils` | Type-only inference utilities — owner of the branding contract | `InferValue`, `InferState`, `InferActions`, `InferActionParameters`, `InferActionResult`, `InferEvents`, `InferEventPayload` |

Each primitive entry also re-exports its own helpers from `utils` so the spec's import strings compile verbatim: `InferValue` from `@paker/value`, `InferState` from `@paker/store`, `InferActions`/`InferActionParameters`/`InferActionResult` from `@paker/actions`, `InferEvents`/`InferEventPayload` from `@paker/adapters/rxjs`.

### Contracts

#### `@paker/value`
- Accepts: initial value; or an initializer function producing per-instance state; or a computed form of (dependency cells, derive function).
- Returns: a cell — `get()`, `getInitial()`, `set(nextOrUpdater)`, `reset()`, `subscribe((current, previous))` returning cleanup, `getKey(keyOrIndex)`, `setKey(keyOrIndex, next)`, `subscribeKey(key, (current, previous))` returning cleanup, callable as a React hook.
- Fails: compile-time rejection of `set`/`setKey`/`reset` on computed cells.
- Guarantees: per-instance state isolation; notification on change only (SameValueZero skip); equal-value sets never notify; subscribers receive current with previously-emitted value.

#### `@paker/store`
- Accepts: state object; or initializer function producing per-instance state.
- Returns: store — whole-state `get`/`getInitial`/`set`/`reset`/`subscribe`/hook-call; each state property exposed as a `$`-suffixed value cell with the full value contract.
- Fails: compile-time rejection of property names not in the state shape.
- Guarantees: per-key notification firing (unchanged keys stay silent); property cells are independent value instances; whole-state `set` preserves per-key firing.

#### `@paker/actions`
- Accepts: a value or store primitive; an action factory receiving the primitive (its cells for stores) and `forward`.
- Returns: the wrapped primitive's full API plus one callable method per declared action; methods return `void` (or `Promise<void>` for async).
- Fails: compile-time unknown action names and wrong parameter types; `forward` limited to same-factory names.
- Guarantees: direct writes apply immediately; returning a defined value applies once (value or patch); async applies after resolution; `undefined` returns never apply.

#### `@paker/adapters/rxjs`
- Accepts: value, store, or either decorated with actions; an event factory receiving the primitive's cells/action methods and a `{ forward, skipOn }` kit. Each event declaration maps a payload signature to an operator array.
- Returns: wrapped API plus one callable event method per declared event; event methods return `void`.
- Fails: compile-time unknown event names in calls, `forward`, or `skipOn`; mapped stream value type-checked against target event payload.
- Guarantees: per-invocation independent streams; `skipOn` terminates only its own stream from its position downstream; operator arrays run in declared order with the payload as the stream's starting value.

#### `@paker/utils`
- Accepts: `typeof` any composed instance; action/event names constrained to inferred keys.
- Returns: value/state/action/event type projections preserving parameter labels, optional parameters, and async return types.
- Fails: compile-time on names not present in the instance; never widens to `any`.
- Guarantees: identical results through any wrapper stack (wrapper-transparent via the branding contract).

### Data Models / DTOs

| Field | Type | Constraints | Description |
|---|---|---|---|
| none | — | — | Library is generic over consumer state; `User` exists only in demo/test witnesses. |

## UI

### Mockups

Simple markdown mockups (no image-generation source was named). States come from the D and S scenarios only.

| Page State | Mockup | Reference |
|---|---|---|
| Demo gallery, initial | `PAKER DEMO — /counter → [0 (0 users, 0 total)]` `/store → [counter: 0 · users: 0]` `/users → [0 users]` | `workplans/workplan_demo.md` (D1–D3) |
| Counter after click | `[/counter → 1 (0 users, 1 total)]` | scenario D1 |
| RxJS users after fetch | `[/users → 2 users]` | scenario D3 |

### UI Harness Inventory

| Surface | Present | Where | Plan Action |
|---|---|---|---|
| Component exploration | no | — | create as the demo app gallery page (its own lane; the project's own equivalent counts) |
| Design system | no | — | reference: none needed; demo markup stays unstyled per Decisions |
| E2E (browser-driven) | no | — | reference: behavior proof runs through the installed vitest+jsdom+RTL harness; browser e2e is not added (would forecast tooling the spec does not require) |

## Modularity

### Behavior Analysis

The repository has no library modules today (template + test stack only). Gate answer — Rewrite/Extend/Extract: no existing module is touched by any behavior, so nothing needs rewriting or extraction-first; every module below is new from day one. Each behavior has a distinct reason to change.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| Reactive cell: state ownership, change notification, per-instance isolation | no existing module | `value` (V) | Hides the reactive-cell design decision; everything else composes cells |
| Computed derivation over dependency cells | `value` | — | Same reason to change as cell notification mechanics (read/subscribe APIs of derived cells) |
| Collection key-targeted read/subscribe/immutable write | `value` | — | Same reason to change as cell state mechanics |
| React hook bridge over cells | `value` | — | Changes when React integration surface changes; single public behavior of cells ("callable as hook") |
| Object-state decomposition into per-key cells + whole-state view | no existing module | `store` (S) | Hides decomposition/aggregation mechanics of object state |
| Action apply protocol + typed forward | no existing module | `actions` (A) | Hides "how an action's result becomes a state transition"; changes independent of cell mechanics |
| Event streams, skipOn, typed event forward | no existing module | `rxjs adapter` (R) | Hides event-to-operator-stream lifecycle; its own reason to change |
| Wrapper-transparent type extraction + branding contract | no existing module | `utils` (U) | Hides the type-level branding decision; consumed by all wrapper modules' type contracts |
| Spec example components as observable behavior harness | no existing module | `demo app` (D) | Integration surface; changes when examples/spec presentation change |

No module is a passthrough: each hides a nameable decision and deleting any boundary would change observable behavior. No two modules hide the same concern (notification mechanics live only in `value`; decomposition only in `store`; apply-protocol only in `actions`; stream lifecycle only in `adapter`; branding only in `utils`).

### Internal Architecture

- `value` — functional/reactive closures; no domain ceremony (domain is trivial: a cell).
- `store` — functional map of state properties to value cells plus a derived whole-state view.
- `actions` — procedural decorator with a small apply protocol.
- `rxjs adapter` — functional stream composition over RxJS operators.
- `utils` — type-level module; zero runtime code.
- `demo app` — minimal components over the public contracts only; examples are the behavior.

### Boundaries

- New modules: `value`, `store`, `actions`, `rxjs adapter`, `utils`, `demo app`.
- No shared mutable state across boundaries: each cell's lifecycle belongs to the instance that created it; wrappers delegate through published contracts and never mutate cells behind a sibling's back. Composition root: the innermost primitive created by the user's factory call is the single owner of state lifecycle.
- Depends-on (contracts, never concrete internals): `store → value`; `actions → value, store`; `rxjs → value, store, actions`; `utils → branding contract of every wrapper`; `demo → published entry points only`.
- Rejected: a shared `core` module below `value` — with a single concrete consumer it would be a passthrough and violates "depend on contracts, not concrete types"; if a second reactive primitive ever appears, extraction gets its own workplan then.
- Every module is independently testable: lane scenarios exercise only that lane's published contract; cross-lane behavior is proven in the lanes that consume (S, A, R, U, D per the ledger).

## Dependency Ledger

| Card | Depends on (behavioral prerequisites) | Integration touchpoint | Blocked? |
|---|---|---|---|
| `workplan_value.md` (V1–V11) | none — root primitive | consumed by S, A, R, U, D via value contract | unblocked |
| `workplan_store.md` (S1–S5) | V — value cells observable | property cells appear in A, R, U, D | blocked until V lands |
| `workplan_actions.md` (A1–A7) | V, S — wrapped primitives observable | decorated instances consumed by R, U, D | blocked until V and S land |
| `workplan_rxjs.md` (R1–R5) | V, S, A — composed instances observable | composed rxjs-decorated store consumed by U, D | blocked until A (and V, S) land |
| `workplan_utils.md` (U1–U6) | branding contract defined here; runtime types of V, S, A, R | end-to-end wrapper stack | blocked until A and R land |
| `workplan_demo.md` (D1–D3) | R (rxjs + actions + store composed) | full stack rendered in components; coverage gate closes | blocked until R and U land |
