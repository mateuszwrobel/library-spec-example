# Lockfile repair: rolldown native binding entries

```json
{
  "task": "lockfix-rolldown-bindings",
  "status": "in-progress",
  "links": ["package-lock.json"],
  "date": "2026-10-15"
}
```

npm's optional-dependencies bug class dropped every `@rolldown/binding-*` platform package from the committed lock, so a clean `npm ci` installed vite/vitest without the native rolldown binding and vitest died at startup; regenerating the lock so the optional platform entries are recorded and standard install resolves them on linux-x64, without touching any dependency version or committing the value lane's `--no-save` workaround.
