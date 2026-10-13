# Go + SQLite reference example

Reference implementation of the never-rot schema-diagram pattern for a **Go +
SQLite** app — `cmd/db-diagram/main.go` (generator, ~850 lines) and
`main_test.go` (the byte-quoted verification test).

**NOT standalone.** These files do not compile on their own: they import the
app's own packages (`todo/board`, `todo/users`) **by design** — that import IS
the pattern. The live-schema principle says the app's own store-open path
(`board.Open`) and its exported constant lists (`users.Names()`) are the
source of truth; a generator that copied schema SQL or roster strings instead
would be a second truth able to rot. Read them as a showing of how to wire the
pattern inside a Go + SQLite app:

- `main.go` — materializes the schema via `board.Open` on a throwaway temp
  file, reopens it read-only, introspects `sqlite_master` +
  `table_info`/`index_list`/`index_info`/`foreign_key_list` pragmas, renders
  deterministic Mermaid erDiagram output; the assignee roster note pulls names
  from `users.Names()` at generation time.
- `main_test.go` — drives `run` end-to-end and pins the note line byte-quoted,
  expectation built from `users.Names()` — no literal roster names (see the
  verification pattern in `../../SKILL.md`).

To adapt: replace `board.Open` with your app's own store-open path and
`users.Names()` with your module's exported constant list; keep every other
move.
