# Paker value lane — reactive cell primitive (V1–V15)

```json
{
  "task": "paker-value-lane",
  "status": "in-progress",
  "links": ["workplans/workplan_value.md"],
  "date": "2026-10-14"
}
```

Lane V implementation started: reactive `value` cell primitive with read/write/reset/subscribe, computed derivation via `value([deps], fn)`, immutable key operations with dot-delimited deep paths (leaf+ancestor firing, silent equal-value no-op), and a callable-as-hook React bridge. Also authors the utils branding contract types (type-only entry `src/utils/index.ts`) per workplan_utils.md so every value/computed instance carries its inner data type for wrapper-transparent inference. Tests derived test-first from scenarios V1–V15.
