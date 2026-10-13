# [EXAMPLE] Log entry shape — copy this file per task

> This file teaches the format. Real entries: one file per task, named `<YYYY-MM-DD>-<slug>.md`, co-located with the module's `__log__/` dir. Never edit or append to an existing entry; write your own.

```json
{
  "status": "done",
  "links": {
    "workplan": ".agents/skills/tdd-workplan/SKILL.md",
    "commit": "a1b2c3d"
  }
}
```

Added a small feature: a config flag that lets callers disable the cache incrementally. Why: follow-up requests need the toggle behavior isolated, and the flag keeps the cache path testable without a second code path. The change is small and self-contained; the commit message and tests carry the detail. Links listed only because they were actually known at write time.