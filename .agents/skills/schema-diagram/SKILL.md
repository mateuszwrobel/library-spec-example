# Skill: Schema Diagram That Cannot Rot

## Description
A committed schema diagram (a Mermaid erDiagram in a doc like `docs/db-schema.md`) that is structurally incapable of going stale: it is generated from the LIVE database schema — the app materializes its own schema by opening its own store against a throwaway temp database, then introspects what the database actually holds through the dialect's introspection facilities — never restated from model structs or annotations. The generated doc is committed, and a feature-detecting pre-commit hook regenerates it to a temp file and byte-compares against the committed one, blocking any commit whose diagram drifted. Drift is impossible at generation time (the database is the source of truth) and staleness is impossible at commit time (the gate compares), with no CI job involved.

## Trigger
Use this skill when:
- A project persists a schema and wants a committed, never-stale schema diagram in its docs
- A committed schema doc exists and has started rotting (edited by hand, drifting from migrations)
- Wiring a freshness gate for a generated doc into pre-commit without a CI job

## Workflow (the pattern)

### a. Dev-only generator tool
A small tool (own command/package, dev-facing) that:
1. Creates a throwaway temp database (mktemp dir/file; removed on exit — real data files are never touched).
2. Opens it through the application's OWN store-open path — the same code path production uses to create/migrate the database. The app owns the schema; the tool copies no schema text.
3. Introspects the resulting live schema via the dialect's introspection facilities (SQLite: `PRAGMA table_info` / `index_list` / `index_info` / `foreign_key_list` plus the stored DDL in `sqlite_master` for facts pragmas cannot report, e.g. CHECK text, AUTOINCREMENT; other dialects: their catalog/information_schema/reflection equivalents).
4. Renders the diagram deterministically so the same schema regenerates byte-identical output every run: tables ordered by name, columns in declaration order, indexes in introspection-result order, no timestamps, no map-iteration order anywhere.

### b. Task-runner target
A make target (or task-runner equivalent, e.g. `make db-diagram`) runs the tool and writes the committed doc. The doc is tool-owned: schema changes land in the app's schema code, the diagram regenerates, never by hand.

### c. Feature-detecting pre-commit gate
A pre-commit hook (snippet: `resources/pre-commit-schema-gate.sh`) that:
- Feature-detects first: if the generator tool or the committed doc does not exist in this repo, `exit 0` silently — the snippet is safe to copy into repos without the feature.
- Regenerates the diagram to a `mktemp` file and `cmp`s it against the committed doc.
- On mismatch, blocks the commit with the stated remedy printed to stderr: "run 'make db-diagram' and stage docs/db-schema.md".
- Never auto-stages, never mutates the working tree, never bypasses. Comparison reads the working tree, so a schema edit is caught whether or not the author regenerated.

### d. Committed generated doc
The generated doc is committed and is tool-owned output — never hand-edited; the make target is the one way it changes.

## Design decisions worth preserving

1. **Diagram from the LIVE schema, never from structs or struct tags.** The app's own store-open path is the source of truth. Model annotations drift from databases as a matter of course; a database introspected after the app's own migration path cannot drift, because there is nothing second to keep in sync.
2. **Committed output + regenerate-and-cmp pre-commit gate = freshness at commit time, no CI job needed.** The doc stays reviewable in diffs (the diagram is part of history), the hook enforces freshness where the damage would happen, and CI carries no extra lane.
3. **Note-line extension point for facts a schema cannot show.** Some truths live in code, not in the database (e.g. "column X is validated against the built-in constant list <names>"). Render them as extra note lines on the owning table, with the values read from the owning module's exported list (e.g. its `Names()`-style API) at generation time — zero hardcoded strings in the generator, so a change to the constants moves the doc and nothing else needs editing.
4. **Feature-detecting hook.** The gate opens with existence checks (tool dir present, doc present) and exits 0 otherwise, so the same snippet is safe to copy into any repo before the feature exists; wiring it in is zero-risk.
5. **Throwaway materialization.** The generator works on a temp database it creates and deletes. It never opens or touches real data files — safe to run on any machine, any time, with no side effects.

## Per-language adaptation notes

The pattern needs exactly two capabilities: a programmatic store-open that produces a real database, and introspection of it.

- **Go + SQLite** — reference implementation in `resources/go-sqlite-example/`: `board.Open` on a temp path, then PRAGMA introspection; notes from `users.Names()`.
- **Python + SQLAlchemy** — `create_engine("sqlite:///:temp:")` + `metadata.create_all(bind)` (or run the app's migration step), then `sqlalchemy.inspect(engine)` / `MetaData.reflect` for tables, columns, keys, indexes; render from that.
- **Node + Prisma** — point `url` at a temp SQLite file, run the app's own `prisma migrate deploy` (or `db push`) path, then `prisma db pull` introspection into a throwaway schema, or query `information_schema` / PRAGMAs directly.
- **sqlc / other SQL-first codegen** — the migrations ARE the source of truth; open a temp database through the app's migration runner and introspect. Do not render from the generated Go/TS structs.
- **diesel (Rust)** — run `diesel migration run` against a temp database, introspect via `information_schema`/PRAGMAs or a connection executing catalog queries; never from `#[derive(Queryable)]` shapes.
- **Entity Framework (.NET)** — `dbContext.Database.Migrate()` (or `EnsureCreated`) against a temp file/database, then `IModel`/`ISchema` or provider catalog queries for introspection.
- **Any server-side dialect (Postgres/MySQL)** — same flow against a temp database/schema; introspection via `information_schema` / `pg_catalog`. Determinism (ordered queries, `ORDER BY`) matters more because catalog row order is not stable.

Rule everywhere: if the store can be materialized by the app's own code and introspected by the dialect, the pattern applies as-is.

## Verification pattern

A test that pins the generated shape without golden files — golden behavior, golden files' weakness avoided:

- Drive the generator's own entry point end-to-end (same path the make target uses) into a temp output, then byte-quote the expectation from the tool's own render path — construct the expected line from the same API the generator uses, never paste a literal. A shape change moves the expectation exactly when it moves the doc, so the test cannot silently rot alongside the generator (mutation-proof).
- When note lines exist: leg that an injected note line appears exactly once, positioned after the table's other notes (index/constraint notes precede it).
- Leg that the note's vocabulary comes from the owning module's exported list — build the expectation from the module API, never a literal — so changing the constants moves test and doc together and the generator gains no private copy of the truth.

## Resources
- `resources/pre-commit-schema-gate.sh` — copy-paste pre-commit hook (POSIX sh; feature-detect lines are the knobs to adapt).
- `resources/go-sqlite-example/` — Go + SQLite reference implementation (generator + verification test), see its README.
