#!/bin/sh
# TEMPLATE COPY: copy-paste hook snippet — the feature-detect lines below (cmd/db-diagram, docs/db-schema.md, the generate command) are the knobs to adapt to your repo.
# pre-commit — schema-diagram gate.
#
# Fails any commit (in any worktree: hooks live in the common git dir) when
# docs/db-schema.md does not match what cmd/db-diagram generates from the
# current working-tree code. Regeneration reads the working tree, not the
# committed diagram — a schema edit is caught whether or not the author
# regenerated. The hook never mutates the tree: fix by running
# 'make db-diagram' and staging docs/db-schema.md.

root=$(git rev-parse --show-toplevel) || exit 0
cd "$root" || exit 0

# Bootstrap tolerance: before the generator or the committed diagram exist,
# the gate has nothing to compare and stays silent.
[ -d cmd/db-diagram ] || exit 0
[ -f docs/db-schema.md ] || exit 0

tmp=$(mktemp "${TMPDIR:-/tmp}/db-diagram-gate.XXXXXX") || {
	echo "pre-commit: cannot create temp file" >&2
	exit 1
}
trap 'rm -f "$tmp"' EXIT

if ! go run ./cmd/db-diagram -out "$tmp"; then
	echo "pre-commit: db-diagram failed to generate the schema diagram" >&2
	exit 1
fi

if ! cmp -s "$tmp" docs/db-schema.md; then
	echo "stale: schema diagram does not match generated output — run 'make db-diagram' and stage docs/db-schema.md" >&2
	exit 1
fi

exit 0
