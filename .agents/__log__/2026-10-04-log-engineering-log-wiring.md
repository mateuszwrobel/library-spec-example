# Wire __log__ engineering-log into orchestrator/coder + example entry

```json
{
  "status": "done",
  "links": {
    "commit": "6efd7bd"
  }
}
```

Made the `__log__` ledger an enforced part of the delegation loop instead of AGENTS.md prose nobody was bound to. `coder` gained an Engineering-log section: one entry per task co-located with the changed module, created with status `in-progress` as the first commit in its worktree, flipped to `done` with completed prose in the final commit, never editing another entry. `orchestrator` gained a Log step in its loop — every delegated unit carries an entry, and one stuck at `in-progress` is a stall detector to interrogate. AGENTS.md gained the ownership rules: the owning lane writes and completes its entry (the status flip is the only allowed edit), and entries are ledger material, not memory — truth stays in git history, memory derives from the ledger. Added `2026-10-04-log-example.md` teaching the file shape, since agents copy existing entries and none existed. Why: without a writer bound into the loop the log directory stayed empty exactly when parallel lanes needed cross-lane visibility.
