# Wire modular-planner/modular-reviewer into agent graph; fix skill path rot

```json
{
  "status": "done",
  "links": {
    "task": "wire modular-planner/reviewer into agent graph; fix path rot"
  }
}
```

Wired the two orphaned modular skills into the agent graph and fixed stale path references. `orchestrator` now loads `skills/modular-planner` first for multi-module features, so planner output (module boundaries and contracts) feeds the per-module `skills/tdd-workplan` runs instead of the skill sitting unloaded. `code-verifier` gained the modularity lens: when a diff touches module boundaries or adds behavior, it applies the `skills/modular-reviewer` checks with its BLOCK/WARN/INFO severities — previously only `reviewer` saw that lens. Both modular skills pointed their prerequisite at `.agent/skills/modular-design-principles.md`, a flat-file layout this repo does not use; references now follow the `skills/<skill-id>` style used elsewhere, and bare `tdd-workplan.md` mentions point at the skill id or the real template path under `.agents/skills/tdd-workplan/`.
