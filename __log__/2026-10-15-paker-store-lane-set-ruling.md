# Paker store lane: set takes full state — parent-plan ruling

```json
{
  "task": "paker-store-lane-set-ruling",
  "status": "done",
  "links": ["src/store/store.ts", "workplans/workplan_store.md"],
  "date": "2026-10-15"
}
```

`Partial<T>` store-level `set` rejected per parent-plan owner ruling: the spec witness pins whole-state replacement (`userStore$.set({ data: [], counter: 1 })` — "Replaces the entire state") and the API contract says "whole-state set". Patch semantics at the store level would pre-empt the actions lane's own apply protocol (A4) — that merge belongs in actions, not here. Store signature is now `set(next: T)`: full state object typed, replaces the entire state. Established internals kept verbatim: per-changed-key SameValueZero silent rule (unchanged keys never notify), exactly one store-level notification per operation, `Object.hasOwn` iteration over the store's own key set (harmless guard retained, now witnessed through a cast for untyped JS callers missing keys).

Tests updated to the pinned signature: S2 legs converted from partial patches to full replacements — one leg replaces with an unchanged (same-reference) key to keep the SVZ-silence witness, one fully-equal replacement asserts total silence and stable snapshot identity, plus the untyped-caller guard leg; the partial-argument compile failure is pinned by a new `@ts-expect-error` witness in the type-safety block; the S5 hook file's equal-valued leg now reuses one array reference so it stays genuinely silent. Workplan Decisions line tightened (ruling 2, reconciliation accepted): whole-state `subscribe` now reads "once per store-level operation (set / reset / single-key write)" with the multi-key one-notification clarification, replacing the older "once per property change" wording; the S5 tail of the same line preserved.
