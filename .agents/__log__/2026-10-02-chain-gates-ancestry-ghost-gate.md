# Chain gates ancestry-first + ghost-gate tool-check

```json
{
  "status": "done",
  "links": {
    "commit": "99cf622"
  }
}
```

Named two gate-trust failure classes and wired detection into doctrine and watchers. Chain gates are ancestry-first: a green CI conclusion or a landed-head sentinel only UNLOCKS the next stage — landing is proven only by `git merge-base --is-ancestor` of the commit on the remote default branch, never asserted from sentinel presence. Ghost-gate: a run concluding success with zero executed jobs (all skipped/absent), a required check wired to nothing, or a sentinel written without the gate running — detected tool-checked via `gh run view --json jobs`, never inferred from a green mark; verdict is `GHOST-GATE`, never success. Landed in four places: `ci-watcher` def (report rules), `long-drill` skill (laws 22–23), `watch-ci.sh` (terminal verdict now counts executed jobs — success with jobs prints `gate=unlocked` exit 0, zero jobs prints `ghost-gate` exit 1, gh failure keeps the success path rather than fabricating a ghost), and `watch-git.sh` (`.final` sentinel re-labeled as unlocking the next gate; landed claims require the ancestry check). Why: watchers previously reported "landed"/success from conclusions and sentinel files alone, which mislabels a chain whenever a gate is skipped or a merge never happened.
