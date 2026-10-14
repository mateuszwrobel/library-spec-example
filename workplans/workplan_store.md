# Workplan: Paker store primitive (lane S)

> Scenario card
> **Name:** store
> **Scenarios owned:** parent S1–S6
> **Contracts exposed:** store contract (see API partial) — consumed by actions, rxjs adapter, utils, demo
> **Contracts consumed:** value cell contract (V) — per-key cells are values; utils branding convention (type-level only)
> **Assumptions about siblings:** value cells deliver change-only notifications with per-key firing semantics; actions will receive this store's property cells directly in its factory argument; adapter/utils read the same property cells.

## Goal

As a library consumer, I want `store` to turn every property of an object state into an independent value cell while still offering whole-state read/write/subscribe, so object state gets atomic subscriptions and re-renders without selectors, yet whole-state operations stay available. Observable outcome: the spec's store examples run as written.

## Acceptance Criteria

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

### Scenario: S6 — Deep paths through store property cells
Given userStore$ = store with { data: [u1, u2], counter: 0 }, u1 = { id: 1, profile: { city: "KRK" } }, and subscribers attached to data$, counter$, and the whole store
When userStore$.data$.setKey("0.profile.city", "WAW") is called
Then the data$ subscriber fires with (newArray, oldArray)
And the counter$ subscriber is not called
And the whole-store subscriber fires exactly once
And userStore$.data$.getKey("0.profile.city") returns "WAW"

## Decisions

- Property access naming: each state property `k` is exposed as `k$` (spec's `counter$`, `data$`), each a full value cell (S1). Rejected: raw property names — they would collide with the whole-state methods and lose the cell identity.
- Whole-state `set` applies per changed key so untouched/unmodified keys stay silent (S2). Rejected: bulk-fire every key — violates the atomic guarantee.
- Whole-state `subscribe` fires once per store-level operation (set / reset / single-key write) with (current, previous) whole-state snapshots (S2, S3) — a multi-key `set` or `reset` is one operation, one notification, while each actually-changed key cell also fires once; store hook-call re-renders on any property change; property hook re-renders only for its key (S5).
- Initializer form mirrors value (per-instance fresh state), enabling SSR/test isolation (S1 witness uses the initializer form).
- `reset` restores every property to initial (S4); `getInitial` returns the complete initial state object at any time.
- Store notification pairs reported as plain state snapshots (not cell tuples) because the store's own subscribers observe whole state; the per-key tuples remain owned by the value cells.
- Deep path operations through property cells follow value's path rules (V12–V15); a path write inside one property notifies the whole-store subscriber exactly once per property change — path fan-out inside the cell does not multiply store-level notifications (S6).

## Assumptions

- Value cells behave per lane V's contract (equality skip, cleanup, computed). If wrong: store re-derives nothing on its own — behavior defects land in V's lane.
- State properties are data (serializable or reference values); nested objects are treated as opaque values for equality purposes. If wrong (deep-reactivity expected): out of spec — the spec's key ops live on value collections, not store nesting.

## Risks

- Dual notification paths (per-key cells + whole-state view) can double-notify listeners on whole-state `set`. Impact: store subscriber count surprises. Mitigation: S2 pins the exact expectation — per-key subscribers each fire once, whole-store subscriber fires once.
- Property name collisions between state keys and store methods (e.g. a key named `get`). Mitigation: the cell suffix convention (`get` vs `get$`) keeps the namespaces disjoint; a `$`-suffixed key clashing is a compile-time duplicate-key failure by shape construction.

## Open Questions

- None.

## API

### Entry point

| Entry | Exports |
|---|---|
| `@paker/store` | `store` factory (state object | initializer fn); `InferState` re-export |

### Contract

As parent API partial §`@paker/store` — whole-state get/getInitial/set/reset/subscribe/hook-call plus `$`-suffixed per-key value cells; per-key firing preserved under whole-state set.

## Modularity

### Behavior Analysis

One behavior: decomposition and aggregation of object state into per-key cells with a coherent whole-state view. Changes when object-state modeling changes, not when cell mechanics change.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| object→cells decomposition + whole-state view | value | `store` (this) | distinct reason to change; value stays a single-cell concern |

### Internal Architecture

Functional: a map from property names to value cells plus a derived whole-state view. No persistence, no domain ceremony.

### Boundaries

Consumes only the value entry contract; exposes the store contract to actions/adapter/utils/demo.
