# Paker demo lane followup — spec-atomic restoration + counter-only S5 witness

```json
{
  "task": "paker-demo-lane-atomic-fidelity",
  "status": "done",
  "links": ["demo/StoreView.tsx", "demo/store.test.tsx"],
  "date": "2026-10-15"
}
```

Verification of the demo lane blocked on F1c: the D2 re-render-scoping witness was circular — it proved S5 scoping on `AtomicStoreComponent` only because the component had been shaped away from the spec (its users display read via a non-reactive `data$.get()` instead of a hook). Ruling (verifier option 2): restore the spec component verbatim and carry the scoping leg on a dedicated extra witness.

What changed and why. `AtomicStoreComponent` is restored to the SPEC shape: it calls BOTH `userStore$.counter$()` and `userStore$.data$()` as hooks and renders "{counter} ({users} users)" — per-property subscriptions ARE the atomic behavior, not the absence of them; the `data$.get()` read and its staleness rationale are deleted. A new `CounterOnlyComponent` (labeled in code as the counter-only subscriber — S5 scoping leg) subscribes the single counter property cell and renders its value; `StorePage` now shows Whole, spec-Atomic, and CounterOnly side by side.

The D2 test witnesses re-scope accordingly: incrementCounter leg — all three components show the new counter value and each Profiler commits +1; data-only leg (`data$.set` through the published cell contract) — the whole-store hook re-renders, the spec-atomic re-renders too (it is a data$ subscriber and shows "2 users" live), while the counter-only subscriber's commit count stays unchanged — the S5 scoping leg, now non-circular because the scoping claim rests on the counter-only component's own single-cell subscription, not on a deviation from the spec component. The stale-"(0 users)" assertions, which encoded the deviation, are removed. `app.test.tsx` routing legs are unaffected (the /store leg keeps asserting the whole-store copy, which still renders).

Gates: `npm test` 90/90 (20 files — leg count unchanged, D2 re-scoped in place); `npm run typecheck` clean; `npm run lint:arch` green, no violations; `npm run coverage` src 100% (12 files fully covered), demo absent from the table — no gate drift. Supersedes the atomic-read decision recorded in `__log__/2026-10-15-paker-demo-lane.md` (that entry stands as history, untouched per append-only).
