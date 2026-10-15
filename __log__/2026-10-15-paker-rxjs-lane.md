# Paker RxJS adapter lane — typed event pipelines (R1–R5)

```json
{
  "task": "paker-rxjs-lane",
  "status": "done",
  "links": ["workplans/workplan_rxjs.md", "workplans/workplan_paker_library.md", "workplans/workplan_actions.md", "workplans/workplan_utils.md"],
  "date": "2026-10-15"
}
```

Lane R implementation: `rxjs` decorates a value cell, a store, or either wrapped in
actions with typed event methods whose bodies are RxJS operator pipelines. Each event
method call constructs a fresh stream starting from the payload and applies the
declared operator array in order, returning `void` (R1); `forward.EVENT(mapper)` maps
the current stream value, checks the mapper's return against EVENT's payload type at
compile time, and triggers a fresh run of EVENT's own pipeline (R2); `skipOn(NAME)` is
a stream-local terminator that arms when a value reaches its array position and, from
there downstream, unsubscribes the run on any emission of NAME — later operators never
execute, committed upstream effects are not reverted, other runs and NAME's own
handlers proceed (R3, R4); the wrapped state/action/subscription/hook surface behaves
as unwrapped, re-render scoping intact (R5). Sole importer of RxJS (ADR-0002);
consumed only the published `@paker/value`, `@paker/store`, `@paker/actions` entry
contracts plus the type-only `@paker/utils` brand.

What changed and why. `src/adapters/rxjs/types.ts` carries the lane's type contract:
`EventSurface<E>` preserves declared payload tuples verbatim and pins method results to
`void` (no result handle — observation belongs to subscriptions, per the lane decision);
`ForwardSurface<E>` exposes exactly the same-factory event names and types the mapper's
return against each event's payload; `EventKit<E>` types `skipOn` against the same map
(an unknown name in `forward`, `skipOn`, or at a call site is a compile failure —
witnessed with live `@ts-expect-error` directives, and the mapper's stream-value input
is `any` because heterogeneous array types are not tuple-reduced: the check that bites
is the return type, which is what the contract demands). The kit's generics reproduce
the actions lane's intrinsic inference cycle, so per the parent ruling of 2026-10-15,
forward/skipOn-using factories pin the event map with a return annotation — the shipped
witnesses pin them — while kit-free factories infer with zero annotations (R1, R5
witnesses prove the unpinned leg). `src/adapters/rxjs/events.ts` is the procedural
decorator: a module-level `constructing` run token set for the synchronous
construct-and-subscribe window (RxJS subscribes the whole chain synchronously until an
async boundary) lets `skipOn` stages capture the run they belong to — arming stays
position-scoped because only a value reaching the stage subscribes nothing new — while
nested `forward`-triggered runs save and restore the token so each stage captures its
own run. An event invocation is an emission: `emit` notifies other runs' armed
terminators before the invoked run is constructed, which is what makes "the named
event's own handlers still run" (R3) and self-kill-by-birth impossible. Termination is
an unsubscribe of the run's own `Subscription` — silent whole-chain teardown; listener
detachers are added to the same Subscription at arm time, so completion, error, and
termination all detach, and nothing dangles past a run's life. `index.ts` is the thin
entry: one generic signature over `P extends Brand<unknown>`, result `P &
EventSurface<E>` — the inner brand passes through structurally (ADR-0003) and all three
accepted primitive forms (value, store, either-with-actions, witnessed on every leg
including actions-decorated value) wrap uniformly without per-primitive overloads; the
decorated instance is a fresh callable whose hook call delegates to the wrapped
primitive (Object.assign copy pattern from actions — wrapped primitive never mutated,
same cell objects, collision shadowing follows the actions ruling).
`InferEvents`/`InferEventPayload` re-exports deferred to the utils lane exactly as
value/store/actions deferred theirs — local conditional-reader witnesses in
`branding.test.ts` stand in.

Unsubscribe hygiene / stream lifetime (documented decision, no scenario demanded it,
computed-cell lifetime precedent followed): event runs own their subscriptions; a run
closes on natural completion, error, or `skipOn` termination — its `Subscription`
teardown cascades (pending timers and inner observables are killed, proven with staggered
fake timers) — so no dispose API exists and none is invented. Mid-run errors terminate
that run silently without host-channel noise; authors compose error handling (`catchError`
etc.) inside the array, matching the R4 "the author composes policy inside the array"
decision. Time control chose `vi.useFakeTimers` + `advanceTimersByTimeAsync` over
TestScheduler: the scenarios test event/run interleaving around real operator boundaries,
not the virtual-time precision of time-based operators themselves, which testing-guide
scopes TestScheduler to. R2/R3 legs run real stubbed fetch promises; R3/R4/hygiene legs
are deterministic fake-timer scripts.

Ambiguities found and resolved (stated, not stalled): (1) skipOn's arming moment — the
plan pins "from its position downstream"; armed-at-subscription would kill runs whose
value had not yet reached the entry (breaking R4's staggered-survival leg), so arming
happens when the first stream value passes the stage's position; the spec-example shape
(skipOn after `switchMap(fetch)`) is witnessed in R4 where emission during run 2's
fetch never reaches run 2's unarmed position. (2) skipOn's `detach` cannot ride an
operator-chain `finalize` — the payload source segment completes immediately while the
run lives on in a downstream async stage — detachers instead attach to the run's own
Subscription (a first-cut `finalize` implementation leaked listeners and failed the R3
termination witnesses; the lifecycle holder replaced it). (3) forward's mapped value
also flows downstream as the new stream value (it is a map stage); the trigger is a
side effect of passing through — matching "maps the stream value … and triggers" with
nothing else observable returned. (4) Event payload stream-start with multiple declared
parameters: the stream starts from the first payload value (zero-parameter events start
from `undefined`) — the spec's payloads are single values; documented in `events.ts`.
(5) Demo-lane headroom (not this lane): demo files sit outside `src/adapters/rxjs/`, so
the `rxjs-confined` rule will reject a direct `rxjs` operator import there; the demo
lane must either take operators through a deliberate adapter re-export or amend the
guard config consciously — decision left to that lane per "deviation requires changing
the guard config deliberately". (6) Ruling-compliant forward to a zero-parameter event
types its mapper payload as `unknown` (conditional-inference default) — every return
compiles, runtime passes the mapped value into the parameter-less declaration, harmless;
no scenario demands more.

Gates: `npm test` 80/80; `npm run typecheck` clean; `npm run lint:arch` green with
teeth spot-proven (scratch `src/value/teeth-probe.scratch.ts` importing rxjs → `error
rxjs-confined: src/value/teeth-probe.scratch.ts → node_modules/rxjs/dist/cjs/index.js`,
exit 1; deleted → `✔ no dependency violations found`, exit 0); `npm run coverage` 100%
statements/branches/functions/lines with `src/adapters/rxjs` fully covered and other
lanes unchanged.
