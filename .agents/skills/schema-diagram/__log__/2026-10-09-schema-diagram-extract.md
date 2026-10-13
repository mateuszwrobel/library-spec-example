```json
{"task": "schema-diagram skill — extract the never-rot schema-doc pattern from todo-test1 into the template: language-agnostic SKILL.md, copy-paste pre-commit gate snippet, Go/SQLite reference implementation, per-language adaptation notes", "status": "done", "date": "2026-10-09", "links": {"source-commits": ["46ef139", "7c54e03"], "skill": ".agents/skills/schema-diagram/SKILL.md"}}
```

What changed and why:

- **`.agents/skills/schema-diagram/SKILL.md`** — new skill, dir form respected.
  Distills the pattern proven in todo-test1 (commits `46ef139` whole feature,
  `7c54e03` note-line extension) into language-agnostic steps: throwaway
  materialization through the app's own store-open, dialect introspection,
  deterministic render, make target, feature-detecting regenerate-and-cmp
  pre-commit gate, and the five design decisions that make the doc structurally
  unable to rot. Adaptation notes cover Go+SQLite, SQLAlchemy, Prisma, sqlc,
  diesel, EntityFramework, and server-side dialects; the verification pattern
  (byte-quoted golden behavior without golden files, expectations built from
  the owning module's API) is stated generically.
- **`resources/pre-commit-schema-gate.sh`** — verbatim copy of the source
  `.githooks/pre-commit` (one added header line naming the adaptation knobs);
  kept byte-functional, executable mode preserved.
- **`resources/go-sqlite-example/`** — verbatim copies of `cmd/db-diagram/`
  main.go/main_test.go at source HEAD plus a README marking them as a
  non-standalone reference that imports the app's own packages by design.
- **`AGENTS.md`** — one line under Project layout pointing at the skill.

Why extracted: the source feature is repo-specific plumbing; the transferable
asset is the pattern plus two directly reusable artifacts (hook snippet,
reference generator). The template user ports the pattern to any store that
can be materialized and introspected.
