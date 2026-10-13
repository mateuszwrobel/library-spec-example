# Port four downstream-consumer improvements: log backfill, literal guard, parallel decomposition, save path

```json
{
  "status": "done"
}
```

Four approved improvements ported from findings in a downstream consumer project. (1) Backfill `__log__` entries for five unlogged commits (56adbcd, bd22468+714c742 as one task, 99cf622, 6efd7bd) — the engineering-log ledger had gaps at the exact commits that wired the log and fixed agent-def loading. (2) Illustrative-literals guard: tdd-workplan states scenario values are witnesses of a behavior class, coder must never branch on or hardcode example literals from scenario values — closes the Goodhart gap where implementing the literals passes the plan but misses the behavior. (3) Parallel decomposition format: sub-workplans for parallel lanes lead with a scenario card (exclusive scenario ownership, contracts, sibling assumptions); the parent plan carries a dependency ledger per card — behavioral prerequisites only, keeping the behavior/implementation dividing line intact; modular-planner gains Step 8 pointing at it. (4) Workplans save to `workplans/` at repo root instead of littering the root.
