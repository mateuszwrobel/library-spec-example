# Paker actions lane — typed action methods + apply protocol (A1–A7)

```json
{
  "task": "paker-actions-lane",
  "status": "done",
  "links": ["workplans/workplan_actions.md", "workplans/workplan_paker_library.md", "workplans/workplan_store.md", "workplans/workplan_value.md", "workplans/workplan_utils.md"],
  "date": "2026-10-15"
}
```

Lane A implementation: `actions` decorates a value cell or a store with fully typed
action methods without changing the wrapped primitive's API (A1), running the apply
protocol on each call — a returned defined value applies once (next value for
value-wrapped, partial patch merged onto the current snapshot for store-wrapped), a
returned nothing never applies so direct writes stay the mutation path with exactly
one notification (A2–A4); async results apply after the promise resolves, and the
method's `Promise<void>` completes only after the commit (A6); `forward` is the
same-factory call surface with original parameter types and void/Promise<void>
results so composed actions never double-apply (A5); unknown names and wrong
parameter types are compile-time failures, parameter labels and optionality are
preserved (A7). Consumed only the published `@paker/value` + `@paker/store` entry
contracts plus the type-only `@paker/utils` brand; no RxJS, no runtime import of any
sibling internal.

What changed and why. `src/actions/types.ts` carries the lane's type contract:
`ActionsSurface<A>` maps a declared action map to its method surface — parameter
tuples preserved verbatim through `infer P` (labels and optionality survive at call
sites), results mapped by the return rule (raw return is a Promise → `Promise<void>`,
otherwise `void`) — and it types both the decorated instance's methods and the
factory's `forward` argument, because forwarding must leak nothing for the outer
action to commit (A5's "composition runs through the inner action's own apply").
`DecoratedValue`/`DecoratedStore` intersect the wrapped contract with the surface, so
the inner `Brand<TData>`/`Brand<TState>` passes through structurally (ADR-0003) and
the action methods are own typed members. `src/actions/actions.ts` is the procedural
decorator: a throwing factory propagates before anything is bound; the apply strategy
is fixed once at decoration by a contract-capability probe — only the value contract
carries `setKey` (stores surface state keys as `$`-suffixed cells and have no key
ops), so `"setKey" in primitive` distinguishes value from store without shape
guessing; commit applies a defined result once (value: `set(result)` — the cell's own
updater form consumes updater-returning actions so "the return wins as next value,
no recursion" falls out for free; store: `set({...get(), ...patch})` — per-key
firing, changed-key silence, equal-merge total silence, and the once-per-operation
store-level notification are inherited from the S2/S6 contract, not re-implemented);
a thenable result defers the commit until after resolution and the method's returned
promise settles only after it, async rejection propagating through that promise with
nothing applied; `forward` is literally the bound-method object, filled after the
factory returns, so forwarded calls hit the inner action's own apply and the outer
commits nothing extra. The decorated instance is a fresh callable: its hook call
delegates to the primitive's hook call, the wrapped API (including the same `$`-cell
objects) is copied as own properties, and the wrapped primitive is never mutated —
the cell stays the single owner of state lifecycle. `InferActions`/
`InferActionParameters`/`InferActionResult` re-exports are deferred to the utils lane
exactly as value deferred `InferValue` and store deferred `InferState` (code comment
in `index.ts`); the local conditional-reader witness in `branding.test.ts` stands in.
Parent-plan alignment landed first as its own commit: the parent Decisions store
notification bullet now carries the store lane's per-operation ruling wording
(replacing the stale "once per property change" phrasing) so consumed-contract text
matches what S shipped.

Tests: `actions.test.ts` (A1 API-preservation witnesses on real composed value and
store instances including key ops, V3 skip, cleanup and shared-state identity; A2
single-notification count; A3 value and updater-return apply; A4 async patch merged
onto the current snapshot with data$-once/counter$-silent/store-once counts plus the
equal-merge total-silence and stable-identity legs, and a sync patch leg; A5 one-write
chain through forward with final-state and notification counts, plus async forward
chain; A6 untouched-and-silent pre-resolution, applied-after-await with immediate
get(), async direct-write resolving undefined, sync method void; A7 parameter-tuple
Equals witnesses, optionality at call sites, async reads as `Promise<void>`; error
behavior: sync action throw, async rejection, throwing factory — each propagates with
nothing applied), `hook.test.tsx` (A1 hook-call legs via RTL: decorated value re-render
from an event-handler action; decorated store whole-hook re-renders on patches while
property hooks stay scoped, S5 rules holding under decoration), `branding.test.ts`
(brand passthrough readers for value/store/cells, hook-call signature reachable,
action surface exact, decoration adds own members without mutating the wrapped
primitive). Compile-failure witnesses are never-invoked `@ts-expect-error` blocks —
the typecheck gate proves the directives live.

Ambiguities found and resolved (stated, not stalled): (1) The forward-in-body
generic-inference cycle: `forward: ActionsSurface<A>` with `A` inferred from the same
factory's return is genuinely circular — the installed TS (7.x) checks the factory
body before `A` fixes, so `A` falls back to its constraint. Empirically probed six
constraint shapes; the lane ships the homomorphic `A extends { [K in keyof A]:
AnyAction }` because its fallback resolves `A` to `{}` — a forward-using factory that
does not pin its map type fails to compile LOUDLY ("property does not exist") instead
of silently widening to an index signature (a `Record<string, …>` constraint does
exactly that silent widening, defeating A5/A7). Consequence: factories that compose
through `forward` declare their map type as the factory's return annotation (proven
strict in both statement and expression positions, including wrong-name and
wrong-type errors inside the body); factories that never touch `forward` infer
precisely with zero annotations (A2–A4/A6/A7/branding witnesses all unannotated).
This is an inference-engine limitation, not a behavior change: the compile-time
guarantee holds exactly where the plan demands it. Documented in types.ts + index.ts.
(2) A3's "updater-form action returning a value": implemented as the action returning
an updater function, which the value contract's `set` updater form consumes — the
updater's return wins as the next value with no re-entry into the apply protocol; no
extra machinery. (3) Store-vs-value apply discrimination had no published marker
(brands are phantom); resolved by the `setKey` contract-capability probe above —
deterministic given the two entry contracts (S's `$`-suffix rule guarantees a state
key can never produce a colliding `setKey` member). (4) A store-wrapped action
returning a non-object: unmodeled by the spec; the merge spreads whatever object-like
shape arrives and the store contract keeps it silent when nothing changes — runtime
shape trust per the lane assumption, no validation invented. (5) A thenable-returning
action whose resolved value is undefined commits nothing (same "returned nothing
never applies" rule applied to the async leg), witnessed with an async direct-write
action. (6) The lane brief's quoted parent-bullet text differed from the actual
file wording; applied the instructed replacement to the real "once per property
change" sentence and kept every other byte identical.
