# dependency-cruiser architecture guard

```json
{
  "task": "depcruise-arch-guard",
  "status": "in-progress",
  "links": ["dependency-cruiser.json", "workplans/workplan_paker_library.md"],
  "date": "2026-10-14"
}
```

Implementing: dependency-cruiser added as the mechanical architecture guard for the workplan's Modularity → Boundaries rules (RxJS confined to the adapter per ADR-0002, entry-only cross-module imports, `src/utils` reachable type-only per ADR-0003, demo terminal, no cycles). Rules self-tested with scratch probes. Narrative completes when status flips to done.
