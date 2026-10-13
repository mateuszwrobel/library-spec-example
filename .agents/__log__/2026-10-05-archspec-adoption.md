# Adopt archspec: basic-info skill + system-adaptive install script

```json
{
  "status": "done",
  "links": {
    "docs": "https://github.com/mateuszwrobel/archspec/tree/main/docs/archspec"
  }
}
```

Adopted the archspec CLI (multi-language architecture test & diagram tool) into the template as two modules, each hiding one decision. `scripts/install-archspec.sh` hides "which release asset this host needs": uname OS/arch map onto the four supported target triples exactly (Linux/x86_64→musl, Linux/aarch64→gnu, Darwin/x86_64/arm64→apple-darwin), the deliberate upstream gaps (no x86_64-gnu, no aarch64-musl, no Windows handling here) resolve to a loud error naming the supported list rather than a silent wrong-asset pick. Version pinned at 0.5.2 via env override; download goes through curl with a `.sha256` sidecar verified before extraction, into a mktemp workdir with trap cleanup, no sudo, into `INSTALL_DIR` (default `~/.local/bin`), then prints path + `--version` as a smoke test. `--dry-run` resolves the URL with zero network — used by verification and lets callers preview the target. Header follows watch-ci.sh conventions (usage/env/exit-code/Deps block, `set -u`, exit 0/1/2). `.agents/skills/archspec/SKILL.md` hides "what archspec is and when to reach for it": one-paragraph description, triggers (architecture audit, boundary declaration/enforcement, dep-graph questions), install via the script, the init→declare→verify --strict→depgraph quickstart, and pointers to upstream docs for spec grammar instead of duplicating spec.md. Deliberately basic — no invented audit protocol. Skills auto-discover from `.agents/skills/`, so nothing else was wired. Verified: `bash -n` clean, dry-run prints the musl URL on this Linux/x86_64 host, a real install to a temp `INSTALL_DIR` checksum-verified and ran `archspec 0.5.2`, and a faked-MINGW `uname` exits 2 with the supported-target message.
