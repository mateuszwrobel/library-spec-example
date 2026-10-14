# Workplan: Paker utility types (lane U)

> Scenario card
> **Name:** utils
> **Scenarios owned:** parent U1–U6
> **Contracts exposed:** branding contract (how a composed instance carries its type identity through wrappers) + the seven `Infer*` utilities; each primitive entry re-exports its own helpers
> **Contracts consumed:** type surfaces of value, store, actions, rxjs adapter (compile-time only — zero runtime imports)
> **Assumptions about siblings:** every wrapper module carries the branding defined here; wrapper modules do not define their own competing type projections; demo and tests consume the spec's import strings.

## Goal

As a library consumer, I want type-only utilities (`InferValue`, `InferState`, `InferActions`, `InferActionParameters`, `InferActionResult`, `InferEvents`, `InferEventPayload`) that read a composed Paker instance through any wrapper stack, so signatures, payloads, and state shapes are available without hand-writing types. Observable outcome: every type assertion in the spec's utility-types section holds, and unknown names fail at compile time.

## Acceptance Criteria

Type-level acceptance: each scenario is proven by compile-time assertions — expected resolutions pinned, wrong usages pinned as failures (failing-name cases assert as compile-time errors, never widening to `any`).

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

## Decisions

- Branding contract: every wrapper's instance type carries the inner primitive's type identity structurally (a phantom brand each module adds to its return type), so `Infer*` helpers are conditional-type readers that unwrap any wrapper order. Defined once in `utils`; wrapper modules implement their side. Rejected: runtime metadata objects — type-only needs, zero runtime cost, and wrappers cannot smuggle values through generics that way. Rejected: independent per-entry `Infer` definitions — two owners of the same projection drift.
- Name parameters are constrained to inferred keys; an unknown name is a compile-time failure at the helper call, never `any` (U5). This is also the guarantee `forward` borrows in lanes A and R.
- `InferActions` preserves async-ness: an async action reads as `(...) => Promise<void>` per A's return rule (U2 witness `loadUsers(): Promise<void>`); result helpers read the action method's return type.
- Computed cells infer their derived data type via `InferValue` (U1 witness `total$` → number).
- Helpers are re-exported from each primitive entry so the spec's import strings compile verbatim (parent decision restated).
- Verification harness: compile-time assertions run inside vitest tests (type-only module has no runtime statements); wrong-name cases asserted via expect-compile-error mechanism or `@ts-expect-error` inline checks.

## Assumptions

- Wrapper modules (V, S, A, R) carry the branding per this contract. If wrong (a wrapper omits it): that wrapper's U6 slice fails and the fix lands in the wrapper lane, not here.
- TypeScript version installed (7.x in devDependencies) supports the needed conditional-type patterns. If wrong: pinned type witnesses may need syntax adaptation, not behavior change.

## Risks

- Deep conditional-type unwrapping is the highest-difficulty surface for a small implementation model (parent risk). Impact: subtle misinference (e.g. labels lost). Mitigation: spec's expected types appear verbatim as pinned witnesses in U1–U4.
- `@ts-expect-error` usage can mask real errors elsewhere. Mitigation: each expect-error pins exactly one failing statement, nothing more.

## Open Questions

- None.

## API

### Entry point

| Entry | Exports |
|---|---|
| `@paker/utils` | `InferValue`, `InferState`, `InferActions`, `InferActionParameters`, `InferActionResult`, `InferEvents`, `InferEventPayload` (+ branding contract internals) |

### Contract

Type-only: accepts `typeof` any composed instance and name keys constrained to inferred members; returns value/state/action/event projections preserving labels, optionality, async returns; fails at compile time on unknown names; wrapper-transparent (identical results at any wrapper depth).

## Modularity

### Behavior Analysis

One behavior: wrapper-transparent type extraction. Changes when the branding mechanism changes, independent of every runtime module's behavior.

### Module Placement

| Behavior | Fits Existing Module | New Module | Reason |
|---|---|---|---|
| branding + Infer* projections | spread across V/S/A/R | `utils` (this) | cross-cutting single convention with one owner beats four local definitions; each runtime module keeps only its re-export line |

### Internal Architecture

Type-level only — conditional/mapped types, zero runtime code. Nothing else fits this problem.

### Boundaries

Imports no runtime code from any module; wrapper modules import only the brand shape (type-level) from here; coverage gate excludes this module (no runtime statements to cover) — recorded so the 100% gate is honest.
