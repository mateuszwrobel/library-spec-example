# Paker workplan: nested key paths

```json
{
  "task": "paker-workplan-nested-key-paths",
  "status": "in-progress",
  "links": ["workplans/workplan_paker_library.md", "workplans/workplan_value.md", "workplans/workplan_store.md"],
  "date": "2026-10-14"
}
```

Approved scope expansion recorded in the workplan set: key operations accept dot-delimited nested paths (leaf + ancestor firing, silent equal-value no-op, intermediates created, primitives replaced, undefined on missing reads, index segments for arrays). New scenarios V12–V15 and S6; decisions, API contract, risks, ledger ranges updated; utils records no path typing. Data classes pinned to spec-only (Map/Set opaque, no witnesses); identity-based dedupe reaffirmed. User answers from 2026-10-14 discussion are the source.
