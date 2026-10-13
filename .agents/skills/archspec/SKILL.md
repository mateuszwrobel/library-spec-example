# Skill: Archspec

## Description

archspec is a multi-language architecture test and diagram tool (`mateuszwrobel/archspec`, a single CLI binary). It extracts the actual architecture model from a project tree, compares it against a declared `architecture.spec.toml`, and renders diagrams, dependency graphs, and diff reports. The spec file declares module boundaries and which dependencies between them are allowed or forbidden, so `archspec verify --strict` turns architecture violations into a non-zero exit code — boundaries become enforceable in scripts and CI, not just documented.

## Trigger

Use this skill when:
- Auditing a codebase's real architecture against its intended design
- Declaring or enforcing module/boundary rules (allowed vs. forbidden dependencies)
- Answering dependency-graph questions (who depends on what, where violations are)

## Install

Run the repo's installer:

```
scripts/install-archspec.sh
```

The binary lands in `~/.local/bin` (override with `INSTALL_DIR=<dir>`). Version is pinned in the script, overridable with `ARCHSPEC_VERSION=<v>`. `--dry-run` prints the resolved download URL without touching the network. No sudo.

## Usage quickstart

```
archspec init            # scaffold architecture.spec.toml
                         # declare boundaries + allowed depend_on/forbidden edges there
archspec verify --strict # exit non-zero when the real architecture differs from the spec
archspec depgraph modules # render the module dependency graph
```

Remaining commands: `scan`, `diagram`, `update`, `report`, `spec`, `doctor`, `inspect`, `help`.

## Pointers

- Full docs: https://github.com/mateuszwrobel/archspec/tree/main/docs/archspec — `docs/archspec/spec.md` defines the spec file: matches keys, allowed `depend_on`/`forbidden`, constraint types
- Builtin manual: `archspec help`
