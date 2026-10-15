# Workplan: Paker actions builder (lane A)

> Scenario card
> **Name:** actions
> **Scenarios owned:** parent A1–A7
> **Contracts exposed:** actions decorator contract (see API partial) — consumed by rxjs adapter, utils, demo
> **Contracts consumed:** value cell contract (V), store contract (S) — the wrapped primitive; utils branding convention (type-level only)
> **Assumptions about siblings:** wrapped primitives keep their full API under decoration; store property cells arrive in the factory argument as `$`-suffixed cells; utils reads this decorator's branded type; the adapter will decorate instances already wrapped by actions.

## Goal

As a library consumer, I want `actions` to decorate a value or store with reusable, fully typed action methods without changing the wrapped primitive's API, so repeated state transitions live in one place and compose through type-safe `forward`. Observable outcome: the spec's value-actions and store-actions examples run as written.

## Acceptance Criteria

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

## Decisions

- Apply rule (restates parent for this lane): a returned defined value applies once — next value for a value-wrapped primitive, partial patch for a store-wrapped one; a returned nothing never applies, so direct writes are the mutation path and exactly one notification results (A2, A3, A4). Rejected: typed commit wrappers — spec factory bodies have none.
- Action methods always return `void`; async ones return `Promise<void>` resolving after the result is applied (A6). Observation of results happens through subscriptions. Rejected: returning the applied value — double signal path.
- Async apply ordering: pre-resolution state is untouched and subscribers silent; the promise returned by the method completes after the commit (A6). Rejected: optimistic apply — spec says results commit "after the promise resolves".
- `forward` is a same-factory-only surface with original parameter types (A5); calling a forwarded void action from a value action returns nothing, so the outer action commits nothing extra — composition runs through the inner action's own apply (A5 witness: `incrementBy` delegates fully to `setCounter`). Forward-using factories pin the action map with a return annotation (parent decision); non-forward factories infer precisely with zero annotations. An unpinned forward-using factory fails LOUDLY (map resolves to `{}`, call sites error) — never silently widened.
- Store patches apply through whole-state setter semantics while preserving per-key firing (S2 contract consumed): a patch touching only `data` notifies `data$`, not `counter$` (A4).
- Errors thrown inside an action propagate synchronously; an async action's rejection propagates through the returned `Promise<void>` without applying anything. No retry or error-state modeling (not in spec).
- Action names colliding with wrapped-API members shadow the copied surface of the decorated instance; the wrapped primitive itself is untouched. Collision witness pinned in tests.
- Async detection is native-Promise-only (`instanceof Promise`); a non-Promise thenable returned from an action commits as an ordinary value. In-spec usage (`async` factories) always returns native Promises.

## Assumptions

- The wrapped primitive's contract is stable enough to decorate without mutation of its API surface (A1). If wrong: the decorator becomes the fix point, not the primitive.
- Patch objects for stores are checked against the store state shape at compile time only; runtime shape trust. If wrong (runtime validation expected): out of spec.

## Risks

- `undefined` returns are indistinguishable from "no return" (parent risk, enforced here): an intentional `value<undefined>` set via action return is impossible. Mitigation: direct `set` remains; documented rule.
- Async apply racing with concurrent direct writes can interleave commits. Impact: last-writer-wins without ordering guarantee. Mitigation: spec models actions as serialized user calls; documented, tests pin the simple interleaving (A6).

## Open Questions

- None.

## API

### Entry point

| Entry | Exports |
|---|---|
| `@paker/actions` | `actions` decorator; `InferActions`, `InferActionParameters`, `InferActionResult` re-exports |

### Contract

As parent API partial §`@paker/actions` — accepts a value or store plus an action factory receiving (primitive-cells, forward); factories that use `forward` carry an explicit action-map return annotation; returns wrapped API plus per-action methods returning void/Promise<void>; compile-time name/parameter checks; apply protocol per Decisions.

## Modularity

### Behavior Analysis

One behavior: translating an action's result into a state transition (the apply protocol) and exposing a typed same-factory call surface (`forward`). Changes when the apply model changes, independent of cell mechanics or object decomposition.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| apply protocol + forward typing | value or store | `actions` (this) | decorator semantics change independently of cell mechanics; tucking into value would give value two reasons to change |

### Internal Architecture

Procedural decorator: resolve declared action keys, bind methods, run apply protocol per result. No DDD ceremony — the domain is a protocol.

### Boundaries

Consumes value/store entry contracts only; exposes the decorated-instance contract (wrapped API + methods + branding) to adapter/utils/demo; never imports RxJS.
