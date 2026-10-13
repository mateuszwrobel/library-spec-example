// Command db-diagram regenerates docs/db-schema.md: a Mermaid ER diagram of
// the board's CURRENT database schema, read from the schema itself — never
// restated here. The live schema is materialized by board.Open on a throwaway
// file (board owns the schema text; this tool copies no SQL), then
// introspected with sqlite_master plus the table_info, index_list, index_info
// and foreign_key_list pragmas. Output is deterministic: table order by name,
// columns in declaration order, indexes in pragma order, so the same schema
// regenerates byte-identical bytes.
//
// The SQLite driver registers transitively through todo/board — server/08
// pins board as the driver's one home — so the read-back connection below
// names the driver while importing none of it.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"todo/board"
	"todo/users"
)

func main() {
	if err := run(os.Args[1:], os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "db-diagram:", err)
		os.Exit(1)
	}
}

func run(args []string, stderr io.Writer) error {
	fs := flag.NewFlagSet("db-diagram", flag.ContinueOnError)
	fs.SetOutput(stderr)
	out := fs.String("out", "docs/db-schema.md", "path of the generated diagram document")
	if err := fs.Parse(args); err != nil {
		return err
	}

	db, cleanup, err := openLiveSchema()
	if err != nil {
		return err
	}
	defer cleanup()

	doc, err := renderDocument(db)
	if err != nil {
		return err
	}
	if dir := filepath.Dir(*out); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create %q: %w", dir, err)
		}
	}
	if err := os.WriteFile(*out, []byte(doc), 0o644); err != nil {
		return fmt.Errorf("write %q: %w", *out, err)
	}
	return nil
}

// openLiveSchema materializes the current schema through board.Open inside a
// temp directory, closes that handle, and reopens the file for the read-only
// pragma introspection. The temp dir outlives the returned handle (cleanup
// closes both): SQLite may open the path again per pooled connection, so the
// file must stay addressable for the whole read.
func openLiveSchema() (*sql.DB, func(), error) {
	dir, err := os.MkdirTemp("", "db-diagram")
	if err != nil {
		return nil, nil, fmt.Errorf("create temp dir: %w", err)
	}
	path := filepath.Join(dir, "schema.db")

	store, err := board.Open(path)
	if err != nil {
		os.RemoveAll(dir)
		return nil, nil, fmt.Errorf("materialize current schema: %w", err)
	}
	if err := store.Close(); err != nil {
		os.RemoveAll(dir)
		return nil, nil, fmt.Errorf("close schema store: %w", err)
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		os.RemoveAll(dir)
		return nil, nil, fmt.Errorf("reopen schema file for introspection: %w", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		os.RemoveAll(dir)
		return nil, nil, fmt.Errorf("reopen schema file for introspection: %w", err)
	}
	return db, func() { db.Close(); os.RemoveAll(dir) }, nil
}

// table is one table's introspected shape: columns in declaration order,
// indexes in pragma order, foreign keys grouped in pragma order, and the
// table-level CHECK expressions read from the stored DDL (a CHECK that names
// no single column has no attribute to ride, so it becomes a table note).
type table struct {
	name        string
	columns     []*column
	indexes     []index
	foreignKeys []foreignKey
	tableChecks []string
}

type column struct {
	name       string
	dataType   string // declared type verbatim from table_info; "" = typeless
	notNull    bool   // table_info's notnull flag — never inferred
	pkPos      int    // 1-based position inside the PRIMARY KEY; 0 = not in it
	autoinc    bool   // the DDL's AUTOINCREMENT keyword (table_info cannot report it)
	defaultV   string // declared DEFAULT, present only when table_info reports one
	hasDefault bool
	checks     []string // column-level CHECK expressions, DDL text, declaration order
	isFK       bool     // appears as some foreign key's child column
	isUK       bool     // covered by a unique index beyond the primary key
}

type index struct {
	name    string
	unique  bool
	origin  string // "c" = CREATE INDEX; "u"/"pk" = implicit constraint index
	partial bool
	columns []string // index_info order; "<expr>" marks an expression-indexed entry
	note    bool     // rendered as a note line: explicit CREATE INDEX only
}

type foreignKey struct {
	parent  string   // referenced table
	columns []string // child columns, seq order
}

func loadTables(db *sql.DB) ([]*table, error) {
	rows, err := db.Query(`SELECT name, sql FROM sqlite_master
		WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list tables: %w", err)
	}
	var tables []*table
	for rows.Next() {
		var name, ddl string
		if err := rows.Scan(&name, &ddl); err != nil {
			rows.Close()
			return nil, fmt.Errorf("list tables: %w", err)
		}
		t := &table{name: name}
		if err := loadColumns(db, t); err != nil {
			rows.Close()
			return nil, err
		}
		if err := loadIndexes(db, t); err != nil {
			rows.Close()
			return nil, err
		}
		if err := loadForeignKeys(db, t); err != nil {
			rows.Close()
			return nil, err
		}
		t.applyDDL(ddl)
		tables = append(tables, t)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("list tables: %w", err)
	}
	rows.Close()
	return tables, nil
}

func loadColumns(db *sql.DB, t *table) error {
	rows, err := db.Query("PRAGMA table_info(" + quoteIdent(t.name) + ")")
	if err != nil {
		return fmt.Errorf("table_info %s: %w", t.name, err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid, notnull, pk int
		var name, dataType string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &dataType, &notnull, &dflt, &pk); err != nil {
			return fmt.Errorf("table_info %s: %w", t.name, err)
		}
		t.columns = append(t.columns, &column{
			name:       name,
			dataType:   dataType,
			notNull:    notnull != 0,
			pkPos:      pk,
			hasDefault: dflt.Valid,
			defaultV:   dflt.String,
		})
	}
	return rows.Err()
}

func loadIndexes(db *sql.DB, t *table) error {
	rows, err := db.Query("PRAGMA index_list(" + quoteIdent(t.name) + ")")
	if err != nil {
		return fmt.Errorf("index_list %s: %w", t.name, err)
	}
	var indexes []index
	for rows.Next() {
		var seq int
		var name string
		var unique, partial int
		var origin string
		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			rows.Close()
			return fmt.Errorf("index_list %s: %w", t.name, err)
		}
		// The primary key's implicit index restates what the PK key slot
		// already says — skip it entirely. A UNIQUE constraint's implicit
		// index stays as data (it drives the UK key slot) but is not an
		// "index" to note; only explicit CREATE INDEX gets a note line.
		indexes = append(indexes, index{
			name:    name,
			unique:  unique != 0,
			origin:  origin,
			partial: partial != 0,
			note:    origin == "c",
		})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("index_list %s: %w", t.name, err)
	}
	rows.Close()

	for i := range indexes {
		if indexes[i].origin == "pk" {
			continue
		}
		rows, err := db.Query("PRAGMA index_info(" + quoteIdent(indexes[i].name) + ")")
		if err != nil {
			return fmt.Errorf("index_info %s: %w", indexes[i].name, err)
		}
		for rows.Next() {
			var seqno, cid int
			var name sql.NullString
			if err := rows.Scan(&seqno, &cid, &name); err != nil {
				rows.Close()
				return fmt.Errorf("index_info %s: %w", indexes[i].name, err)
			}
			if name.Valid {
				indexes[i].columns = append(indexes[i].columns, name.String)
			} else {
				indexes[i].columns = append(indexes[i].columns, "<expr>")
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return fmt.Errorf("index_info %s: %w", indexes[i].name, err)
		}
		rows.Close()
	}
	t.indexes = indexes
	return nil
}

func loadForeignKeys(db *sql.DB, t *table) error {
	rows, err := db.Query("PRAGMA foreign_key_list(" + quoteIdent(t.name) + ")")
	if err != nil {
		return fmt.Errorf("foreign_key_list %s: %w", t.name, err)
	}
	defer rows.Close()
	// Rows come grouped by id in pragma order; one group is one key. The
	// pragma's full row is id, seq, table, from, to, on_update, on_delete,
	// match — the action columns carry no ER structure, so they are read
	// and dropped (a NULL to means "references the parent's PK").
	var current *foreignKey
	var currentID = -1
	for rows.Next() {
		var id, seq int
		var parent, from string
		var to, onUpdate, onDelete, match sql.NullString
		if err := rows.Scan(&id, &seq, &parent, &from, &to, &onUpdate, &onDelete, &match); err != nil {
			return fmt.Errorf("foreign_key_list %s: %w", t.name, err)
		}
		if id != currentID {
			t.foreignKeys = append(t.foreignKeys, foreignKey{parent: parent})
			current = &t.foreignKeys[len(t.foreignKeys)-1]
			currentID = id
		}
		current.columns = append(current.columns, from)
	}
	return rows.Err()
}

// markKeys derives the PK/FK/UK key slots: PK straight from table_info, FK
// from the child side of any foreign key, UK from a unique index that is not
// the primary key's implicit index (a key column keeps only PK when the
// unique index covers exactly the PK).
func markKeys(tables []*table) {
	for _, t := range tables {
		for _, fk := range t.foreignKeys {
			for _, col := range fk.columns {
				if c := t.find(col); c != nil {
					c.isFK = true
				}
			}
		}
		for _, idx := range t.indexes {
			if !idx.unique || idx.origin == "pk" {
				continue
			}
			for _, col := range idx.columns {
				if c := t.find(col); c != nil && c.pkPos == 0 {
					c.isUK = true
				}
			}
		}
	}
}

func (t *table) find(name string) *column {
	for _, c := range t.columns {
		if strings.EqualFold(c.name, name) {
			return c
		}
	}
	return nil
}

// applyDDL folds in the two facts the pragmas cannot report per column: the
// CHECK expressions and the AUTOINCREMENT keyword. Both come from the stored
// DDL in sqlite_master — schema introspection, not a copied schema string.
func (t *table) applyDDL(ddl string) {
	body, ok := tableBody(ddl)
	if !ok {
		return
	}
	for _, item := range splitTopLevel(body) {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		if name, isColumn := firstToken(item); isColumn {
			c := t.find(name)
			if c == nil {
				continue
			}
			c.checks = append(c.checks, checkExprs(item)...)
			c.autoinc = hasWord(item, "autoincrement")
		} else if expr, ok := checkExprAtStart(item); ok {
			t.tableChecks = append(t.tableChecks, expr)
		}
	}
}

// renderDocument is the whole committed doc: one H1, one fenced mermaid
// block. Relations first (empty while the schema holds no foreign keys), then
// the entity blocks, then the note lines. An assignee column also gets a note
// naming its roster — who an assignee is cannot be introspected (the cast is
// users-module data, not stored), so the names are read from users.Names at
// generation time; the generator hardcodes no name.
func renderDocument(db *sql.DB) (string, error) {
	tables, err := loadTables(db)
	if err != nil {
		return "", err
	}
	markKeys(tables)

	var b strings.Builder
	b.WriteString("# Database schema\n\n```mermaid\nerDiagram\n")
	for _, t := range tables {
		for _, fk := range t.foreignKeys {
			// Strictly an FK is zero-or-many on the child side; the
			// requirement's canonical arrow shape is used verbatim.
			fmt.Fprintf(&b, "\t%s ||--o{ %s : %s\n",
				fk.parent, t.name, comment(fk.columns))
		}
	}
	for _, t := range tables {
		fmt.Fprintf(&b, "\t%s {\n", t.name)
		for _, c := range t.columns {
			fmt.Fprintf(&b, "\t\t%s\n", attribute(c))
		}
		b.WriteString("\t}\n")
	}
	for _, t := range tables {
		for _, idx := range t.indexes {
			if !idx.note {
				continue
			}
			note := "index " + idx.name + " on " + t.name + " (" + strings.Join(idx.columns, ", ") + ")"
			if idx.unique {
				note = "unique " + note
			}
			if idx.partial {
				note += " [partial]"
			}
			fmt.Fprintf(&b, "\tnote for %s %s\n", t.name, quote(note))
		}
		for _, chk := range t.tableChecks {
			fmt.Fprintf(&b, "\tnote for %s %s\n", t.name, quote("check: "+scrub(chk)))
		}
		// The roster note rides the table that stores an assignee: one line
		// after that table's other notes, naming the cast from the users
		// module so the TEXT column gains a referent. Column-name and name
		// spellings come from introspection and users.Names — never typed in.
		if c := t.find("assignee"); c != nil {
			note := c.name + ": one of the built-in simulated users (users module, not stored): " +
				strings.Join(users.Names(), ", ")
			fmt.Fprintf(&b, "\tnote for %s %s\n", t.name, quote(note))
		}
	}
	b.WriteString("```\n")
	return b.String(), nil
}

// attribute renders one mermaid attribute line: `type name KEYS "comment"`.
// Keys come from the introspected marks; the comment carries the structural
// prose the key slots cannot: not null, autoincrement, DEFAULT, CHECK.
func attribute(c *column) string {
	dataType := c.dataType
	if dataType == "" {
		// A typeless column is legal SQLite; mermaid requires a type
		// token, so "any" states the absence instead of inventing a type.
		dataType = "any"
	}
	var keys []string
	if c.pkPos > 0 {
		keys = append(keys, "PK")
	}
	if c.isFK {
		keys = append(keys, "FK")
	}
	if c.isUK {
		keys = append(keys, "UK")
	}
	var notes []string
	if c.notNull {
		notes = append(notes, "not null")
	}
	if c.autoinc {
		notes = append(notes, "autoincrement")
	}
	if c.hasDefault {
		notes = append(notes, "default "+scrub(c.defaultV))
	}
	for _, chk := range c.checks {
		notes = append(notes, "check: "+scrub(chk))
	}
	line := dataType + " " + c.name
	if len(keys) > 0 {
		line += " " + strings.Join(keys, ", ")
	}
	if len(notes) > 0 {
		line += " " + quote(strings.Join(notes, ", "))
	}
	return line
}

// comment renders a quoted label for relation lines.
func comment(words []string) string { return quote(strings.Join(words, ", ")) }

// quote wraps text as a mermaid string. Mermaid comments cannot nest double
// quotes, so scrub has already removed them.
func quote(s string) string { return `"` + s + `"` }

// scrub removes the double quotes SQLite uses to quote reserved-word
// identifiers in the stored DDL (e.g. "column"); the identifier itself
// survives, only its reserved-word quoting goes.
func scrub(s string) string { return strings.ReplaceAll(s, `"`, "") }

func quoteIdent(name string) string { return `"` + strings.ReplaceAll(name, `"`, `""`) + `"` }

// --- stored-DDL reading ----------------------------------------------------
//
// The helpers below locate per-column CHECK expressions and the AUTOINCREMENT
// keyword inside a CREATE TABLE statement read from sqlite_master. They are
// scanners, not a SQL parser: they respect SQLite's string and quoting forms
// ('' escapes, "" / ` ` / [ ] identifiers) and paren depth, which is all the
// facts they hunt need.

// tableBody returns the text between CREATE TABLE's outermost parentheses.
func tableBody(ddl string) (string, bool) {
	start := -1
	depth := 0
	inS, inD, inB, inT := false, false, false, false
	for i := 0; i < len(ddl); i++ {
		c := ddl[i]
		switch {
		case inS:
			if c == '\'' {
				if i+1 < len(ddl) && ddl[i+1] == '\'' {
					i++
				} else {
					inS = false
				}
			}
		case inD:
			if c == '"' {
				if i+1 < len(ddl) && ddl[i+1] == '"' {
					i++
				} else {
					inD = false
				}
			}
		case inB:
			if c == '`' {
				inB = false
			}
		case inT:
			if c == ']' {
				inT = false
			}
		default:
			switch c {
			case '\'':
				inS = true
			case '"':
				inD = true
			case '`':
				inB = true
			case '[':
				inT = true
			case '(':
				if depth == 0 {
					start = i
				}
				depth++
			case ')':
				depth--
				if depth == 0 && start >= 0 {
					return ddl[start+1 : i], true
				}
			}
		}
	}
	return "", false
}

// splitTopLevel cuts the table body at depth-0 commas, outside every quoting
// form.
func splitTopLevel(body string) []string {
	var items []string
	depth := 0
	last := 0
	inS, inD, inB, inT := false, false, false, false
	for i := 0; i < len(body); i++ {
		c := body[i]
		switch {
		case inS:
			if c == '\'' {
				if i+1 < len(body) && body[i+1] == '\'' {
					i++
				} else {
					inS = false
				}
			}
		case inD:
			if c == '"' {
				if i+1 < len(body) && body[i+1] == '"' {
					i++
				} else {
					inD = false
				}
			}
		case inB:
			if c == '`' {
				inB = false
			}
		case inT:
			if c == ']' {
				inT = false
			}
		default:
			switch c {
			case '\'':
				inS = true
			case '"':
				inD = true
			case '`':
				inB = true
			case '[':
				inT = true
			case '(':
				depth++
			case ')':
				depth--
			case ',':
				if depth == 0 {
					items = append(items, body[last:i])
					last = i + 1
				}
			}
		}
	}
	return append(items, body[last:])
}

// firstToken reports the item's leading identifier and whether the item is a
// column definition (a table-constraint item leads with a keyword).
func firstToken(item string) (string, bool) {
	item = strings.TrimLeft(item, " \t\r\n")
	if item == "" {
		return "", false
	}
	switch item[0] {
	case '"', '`', '[':
		closer := map[byte]byte{'"': '"', '`': '`', '[': ']'}[item[0]]
		if end := strings.IndexByte(item[1:], closer); end >= 0 {
			// A quoted leading token is an identifier whatever it says:
			// keywords only act as keywords when unquoted.
			return item[1 : end+1], true
		}
		return "", false
	}
	end := strings.IndexAny(item, " \t\r\n(")
	if end < 0 {
		end = len(item)
	}
	word := item[:end]
	if strings.EqualFold(word, "CONSTRAINT") {
		// CONSTRAINT name <kind> ... — a leading CONSTRAINT is always a
		// named table constraint; its CHECK text is read by
		// checkExprAtStart on the whole item.
		return "", false
	}
	return word, !isConstraintKind(word)
}

func isConstraintKind(word string) bool {
	switch strings.ToUpper(word) {
	case "PRIMARY", "UNIQUE", "CHECK", "FOREIGN", "CONSTRAINT":
		return true
	}
	return false
}

// checkExprs returns the CHECK expressions appearing at depth 0 of the item,
// in order — the column-level form of a column definition, or the leading
// form of a table constraint.
func checkExprs(item string) []string {
	var exprs []string
	depth := 0
	inS, inD, inB, inT := false, false, false, false
	for i := 0; i < len(item); i++ {
		c := item[i]
		switch {
		case inS:
			if c == '\'' {
				if i+1 < len(item) && item[i+1] == '\'' {
					i++
				} else {
					inS = false
				}
			}
		case inD:
			if c == '"' {
				if i+1 < len(item) && item[i+1] == '"' {
					i++
				} else {
					inD = false
				}
			}
		case inB:
			if c == '`' {
				inB = false
			}
		case inT:
			if c == ']' {
				inT = false
			}
		default:
			switch {
			case c == '\'':
				inS = true
			case c == '"':
				inD = true
			case c == '`':
				inB = true
			case c == '[':
				inT = true
			case c == '(':
				depth++
			case c == ')':
				depth--
			case depth == 0 && wordAt(item, i, "check"):
				if expr, end, ok := parenExpr(item, i+5); ok {
					exprs = append(exprs, expr)
					i = end - 1
				}
			}
		}
	}
	return exprs
}

// checkExprAtStart finds a CHECK whose keyword leads the item, past an
// optional CONSTRAINT name.
func checkExprAtStart(item string) (string, bool) {
	rest := strings.TrimLeft(item, " \t\r\n")
	if strings.HasPrefix(strings.ToUpper(rest), "CONSTRAINT") {
		rest = rest[len("CONSTRAINT"):]
		if nameEnd := strings.IndexAny(rest, " \t\r\n"); nameEnd >= 0 {
			rest = rest[nameEnd:]
		}
	}
	trimmed := strings.TrimLeft(rest, " \t\r\n")
	if !strings.HasPrefix(strings.ToUpper(trimmed), "CHECK") {
		return "", false
	}
	offset := len(item) - len(trimmed)
	if expr, _, ok := parenExpr(item, offset+5); ok {
		return expr, true
	}
	return "", false
}

// parenExpr reads the balanced-parenthesized expression starting at the
// given index (the character just after CHECK); returns inner text and the
// index just past the closing paren.
func parenExpr(item string, at int) (string, int, bool) {
	for at < len(item) && (item[at] == ' ' || item[at] == '\t' || item[at] == '\r' || item[at] == '\n') {
		at++
	}
	if at >= len(item) || item[at] != '(' {
		return "", 0, false
	}
	depth := 0
	start := at
	inS, inD, inB, inT := false, false, false, false
	for ; at < len(item); at++ {
		c := item[at]
		switch {
		case inS:
			if c == '\'' {
				if at+1 < len(item) && item[at+1] == '\'' {
					at++
				} else {
					inS = false
				}
			}
		case inD:
			if c == '"' {
				if at+1 < len(item) && item[at+1] == '"' {
					at++
				} else {
					inD = false
				}
			}
		case inB:
			if c == '`' {
				inB = false
			}
		case inT:
			if c == ']' {
				inT = false
			}
		default:
			switch c {
			case '\'':
				inS = true
			case '"':
				inD = true
			case '`':
				inB = true
			case '[':
				inT = true
			case '(':
				depth++
			case ')':
				depth--
				if depth == 0 {
					return strings.TrimSpace(item[start+1 : at]), at + 1, true
				}
			}
		}
	}
	return "", 0, false
}

// wordAt reports whether item has the given lowercase keyword at i, bounded
// by non-identifier characters.
func wordAt(item string, i int, word string) bool {
	if i+len(word) > len(item) || !strings.EqualFold(item[i:i+len(word)], word) {
		return false
	}
	if i > 0 && isIdentByte(item[i-1]) {
		return false
	}
	if i+len(word) < len(item) && isIdentByte(item[i+len(word)]) {
		return false
	}
	return true
}

func isIdentByte(c byte) bool {
	return c == '_' || (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// hasWord reports whether the item contains the given lowercase keyword at
// depth ≥ 0 outside strings — loose on purpose: AUTOINCREMENT can only sit
// inside a column definition, anywhere after the column name.
func hasWord(item string, word string) bool {
	depth := 0
	inS, inD, inB, inT := false, false, false, false
	for i := 0; i < len(item); i++ {
		c := item[i]
		switch {
		case inS:
			if c == '\'' {
				if i+1 < len(item) && item[i+1] == '\'' {
					i++
				} else {
					inS = false
				}
			}
		case inD:
			if c == '"' {
				if i+1 < len(item) && item[i+1] == '"' {
					i++
				} else {
					inD = false
				}
			}
		case inB:
			if c == '`' {
				inB = false
			}
		case inT:
			if c == ']' {
				inT = false
			}
		default:
			switch {
			case c == '\'':
				inS = true
			case c == '"':
				inD = true
			case c == '`':
				inB = true
			case c == '[':
				inT = true
			case c == '(':
				depth++
			case c == ')':
				depth--
			case wordAt(item, i, word):
				return true
			}
		}
	}
	return false
}
