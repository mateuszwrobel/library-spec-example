# Lockfile repair: rolldown native binding entries

```json
{
  "task": "lockfix-rolldown-bindings",
  "status": "done",
  "links": ["package-lock.json"],
  "date": "2026-10-15"
}
```

npm's optional-dependencies bug class stripped the entire optional tier from the committed lock — every `@rolldown/binding-*` platform package (plus `lightningcss-*`, `fsevents`) was absent — so a clean `npm ci` produced vitest that died at startup walking rolldown's native-binding fallback chain, and plain `npm install` on that lock no-ops ("up to date"), refusing to re-materialize the missing edges. Full regen (delete lock, `npm install`) was rejected: it drifted 4 resolutions (rolldown 1.2.13→1.2.14, react/react-dom 19.3.0→19.3.1, @oxc-project/types 0.153.0→0.154.0), violating the resolved-versions-identical constraint. Targeted fix instead: transiently re-declared `rolldown@1.2.13` to arborist (`npm install --package-lock-only --os=linux --cpu=x64 rolldown@1.2.13`) so npm itself wrote its 15 optional binding entries at the locked version with real registry metadata, then reverted the transient package.json/lock-root dependency and spliced only the binding blocks back into the committed lock, byte-identical existing entries, 0 version moves. Verified from clean: `npm ci` selects `binding-linux-x64-gnu`, 28/28 tests, typecheck and depcruise green. The value lane's `--no-save` workaround stays uncommitted — the binding enters the lock only as the optional platform entry it always should have been; `lightningcss-*`/`fsevents` entries remain absent (out of scope, not needed by this harness).
