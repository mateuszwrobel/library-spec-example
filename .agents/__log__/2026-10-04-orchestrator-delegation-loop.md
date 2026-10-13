# Orchestrator self-sufficient delegation loop + approved-model policy

```json
{
  "status": "done",
  "links": {
    "commit": "56adbcd"
  }
}
```

Rewrote `orchestrator` so delegation cannot be skipped or stalled. The vague "delegate everything" prose became a mandatory per-task loop — Understand, Plan, Spawn, Verify, Land, CI — with parallelism guidance (independent units as background spawns, dependent units wait). Added an approved-model policy: every spawn passes an explicit model, and when AGENTS.md's `<SUBAGENT_MODEL>` placeholder is unfilled the session's active model is the approved one — a missing placeholder must never stall delegation, resolve the model then spawn. Roster of repo subagents moved into its own section with one-line role summaries. Why: in a fresh consumer checkout the placeholder is routinely unfilled, and the old wording left the orchestrator no rule for what to launch with, so delegation either stalled or silently used an unapproved default.
