# Paker actions lane — forward-annotation ruling (plan amendment + witness)

```json
{
  "task": "paker-actions-forward-annotation-ruling",
  "status": "done",
  "links": ["workplans/workplan_paker_library.md", "workplans/workplan_actions.md", "workplans/workplan_rxjs.md"],
  "date": "2026-10-15"
}
```

Verification of the lane's forward-circularity finding came back confirmed, and the parent-plan owner ruled: the map-type return annotation is the canonical form for forward-using factories. This entry records the ruling round; the lane implementation itself was untouched — the shipped typing already enforced exactly the ruled behavior (homomorphic constraint → unpinned forward-using factories fail loudly, pinned ones resolve fully strict), so the amendment brings the plans to the proven reality rather than changing code.

What changed and why. Parent Decisions now carry the ruling bullet: forward-using factories declare an explicit map-type return annotation, with the empirical rationale (cycle forward ← action map ← factory return ← factory body ← forward is intrinsic; verified on TypeScript 7.0.2, 2026-10-15) and the scope extension to RxJS adapter event factories — the adapter lane inherits the same cycle, so `workplan_rxjs.md` Decisions gained the matching event-map bullet. The actions workplan's `forward` decision was amended to close with the pinning rule: pinned factories get full precision, unpinned forward-using factories fail LOUDLY (map resolves to `{}`), never silently widened; its API Contract accepts-line now names the annotation requirement. Verification proved no single-signature shape compiles forward-using spec factories verbatim while retaining the A5/A7 compile guarantees — candidates curried-site, `NoInfer`, permissive-record, and `ReturnType`-projection were all rejected or unsafe: permissive constraints silently widen the whole decorated surface (probe-verified: unknown names compiled on pinned-shape instances), vacuous ones break legitimate calls, self-referential aliases are illegal TS. One annotation line buys back full precision, type-level only, runtime identical.

Also recorded as lane decisions from INFO findings of the same verification round: computed cells are not wrappable — both entry overloads reject read-only primitives because an apply protocol committing returned values contradicts computed's no-write contract (parent `@paker/actions` Fails segment amended); action names colliding with wrapped-API members shadow the copied surface of the decorated instance while the wrapped primitive itself stays untouched (code witness added to `actions.test.ts`: an action named `get` shadows the read on the decorated copy, runs the apply protocol instead, and the original primitive's `get` keeps its read semantics); async detection is native-Promise-only (`instanceof Promise`) so a non-Promise thenable commits as an ordinary value, acceptable because in-spec `async` factories always return native Promises. Runtime witnesses were otherwise unchanged; all gates re-run green on the amended plans.
