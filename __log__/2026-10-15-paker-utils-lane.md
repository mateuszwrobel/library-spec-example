# paker utils lane — wrapper-transparent Infer* helpers

```json
{
  "task": "paker-utils-lane",
  "status": "in-progress",
  "links": ["workplans/workplan_utils.md", "docs/adr/0003-type-branding-for-wrapper-transparent-inference.md"],
  "date": "2026-10-15"
}
```

Lane U: the seven `Infer*` type utilities in `src/utils` (single owner, ADR-0003), the actions/adapter sides of the branding contract (phantom `ActionsBrand`/`EventsBrand` carried by the two `Decorated*` types), and the deferred entry re-exports flagged by the value/store/actions/rxjs lanes.
