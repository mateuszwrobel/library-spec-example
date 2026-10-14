# Workplan: Paker value primitive (lane V)

> Scenario card
> **Name:** value
> **Scenarios owned:** parent V1–V11
> **Contracts exposed:** value cell contract (see API partial) — consumed by store, actions, rxjs adapter, utils, demo
> **Contracts consumed:** utils branding convention (type-level only, authored in workplan_utils.md); runtime: none
> **Assumptions about siblings:** store will build per-key cells from this contract; actions/adapter will decorate instances of it without changing it; utils will read its branded type; demo will render components calling it as a hook.

## Goal

As a library consumer, I want a single reactive cell — `value` — holding one piece of state with read, write, reset, subscribe, computed derivation, immutable key operations for arrays/objects, and direct use as a React hook, so simple state needs a primitive with zero boilerplate and no selectors. Observable outcome: the spec's value examples run as written.

## Acceptance Criteria

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

## Decisions

- Notification rule: subscribers fire on change only; an attach never delivers immediately; equality skip by SameValueZero (parent decision, restated here because this module enforces it). Rejected: emit-on-subscribe — it duplicates the hook read and complicates effect logic.
- `previousValue` in notifications is the previously-emitted value; the first emission after creation reports the initial value as `previousValue`. Rationale: matches V2's (5, 0) witness and gives subscribers the actual before/after pair.
- Computed cells are the same cell type with write methods absent at the type level (V7); dependencies are other cells; recomputation happens when any dependency changes. Rejected: explicit `computed(...)` factory — the spec uses the `value(deps, fn)` form.
- Key operations exist when the state is an array or object; `setKey` produces a new collection without touching the previously-read one (V9); a key added by `setKey` notifies subscribers attached to that previously-absent key (V10, V11); reading an absent key returns `undefined`.
- React hook form: calling the cell inside a component subscribes for the component lifetime and unmount cleans up automatically (V8). The returned cleanup of `subscribe` is the manual path for effects (V4).
- The branded type this cell carries is defined by the utils branding contract so `InferValue` reads it through wrappers; value implements its side without importing utils' internals (ADR-0003).

## Assumptions

- React 19 and the installed test stack provide hook-bridge testing (RTL). If wrong: hook scenarios need re-targeting but the cell contract is unchanged.
- The `User` type is a fixture, not a library model. If wrong: none material — generic throughout.

## Risks

- Hook bridge misuse can cause tearing/extra renders. Impact: V8/D scenarios flaky. Mitigation: follow the installed-stack guidance (render real components, assert through DOM).
- SameValueZero skipping hides intentional no-op writes from middleware-style observers later. Impact: post-MVP middleware sees fewer calls. Mitigation: middleware is out of scope; the rule is a documented behavior (V3).

## Open Questions

- None.

## API

### Entry point

| Entry | Exports |
|---|---|
| `@paker/value` | `value` factory (direct/initializer and computed forms); `InferValue` re-export |

### Contract

As parent API partial §`@paker/value` — accepts initial value | initializer fn | (dep cells, derive fn); returns a cell with get/getInitial/set/reset/subscribe/getKey/setKey/subscribeKey/hook-call; computed cells lack write APIs at compile time; per-instance isolation; change-only notification with equality skip.

## Modularity

### Behavior Analysis

One behavior: the reactive cell (hold state, notify on change, derive, bridge to React). Computed, key ops, and the hook bridge change for the same reason — cell notification/observation mechanics — so they live here, not in extra modules.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| reactive cell + notification | — | `value` (this) | root primitive; no modules exist yet |
| computed derivation | `value` | — | shares the notification reason to change |
| key ops | `value` | — | collection reads/writes are cell state mechanics |
| React hook bridge | `value` | — | one public behavior of the cell; no second reason to change today |

### Internal Architecture

Functional reactive closures; no domain ceremony — the domain is one cell. Internal architecture (sub-file split, hook mechanism choice) is left to the implementer.

### Boundaries

New module; consumed only through its entry contract by store/actions/adapter/utils/demo; imports no sibling internals; never imports RxJS (ADR-0002).
