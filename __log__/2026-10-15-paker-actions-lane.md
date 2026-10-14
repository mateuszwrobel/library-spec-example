# Paker actions lane — typed action methods + apply protocol (A1–A7)

```json
{
  "task": "paker-actions-lane",
  "status": "in-progress",
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
contracts plus the type-only `@paker/utils` brand; no RxJS.
