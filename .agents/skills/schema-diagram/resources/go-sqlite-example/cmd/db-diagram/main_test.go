package main

import (
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"todo/users"
)

// TestRosterNote drives the generator end-to-end (live schema through
// board.Open, like make db-diagram) and pins the roster note on the assignee
// column: it must appear byte-quoted after every other cards note, and its
// names must arrive through users.Names — the test spells no roster name, so
// a roster change moves this expectation exactly as it moves the doc.
func TestRosterNote(t *testing.T) {
	out := filepath.Join(t.TempDir(), "db-schema.md")
	if err := run([]string{"-out", out}, io.Discard); err != nil {
		t.Fatalf("generate diagram: %v", err)
	}
	raw, err := os.ReadFile(out)
	if err != nil {
		t.Fatalf("read generated doc: %v", err)
	}
	doc := string(raw)

	// One occurrence, exact bytes: tab-indented note line whose quoted
	// string is the roster join over users.Names.
	want := "\tnote for cards \"assignee: one of the built-in simulated users " +
		"(users module, not stored): " + strings.Join(users.Names(), ", ") + "\""
	lines := strings.Split(doc, "\n")
	noteIdx, seen := -1, 0
	for i, l := range lines {
		if l == want {
			noteIdx, seen = i, seen+1
		}
	}
	if seen == 0 {
		t.Fatalf("generated doc lacks the roster note line\nwant line: %s\ngot:\n%s", want, doc)
	}
	if seen > 1 {
		t.Fatalf("roster note line emitted %d times, want once\ngot:\n%s", seen, doc)
	}

	// Placement: the roster note is the last note for its table — every
	// other cards note (the index notes, the check notes) precedes it.
	for i, l := range lines {
		if i != noteIdx && strings.HasPrefix(l, "\tnote for cards ") && i > noteIdx {
			t.Errorf("roster note (line %d) sits above another cards note (line %d):\n%s",
				noteIdx+1, i+1, doc)
		}
	}
}
