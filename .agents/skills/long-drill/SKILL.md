# Skill: Long Drill / Matrix Runner

## Description
Discipline for running long drill, matrix and flake-storm lanes so they can never stall silently and their work can never be stranded: a machine-readable results ledger, a flake protocol inside the script, deadlines on every wait, pidfile process tracking, milestone heartbeats, land-before-grind ordering, and detached gate/commit ladders that speak only in files (a session may die mid-gate — the ladder must not). Checklist form — work the items before launching and while the lane runs. Born from stalled drill lanes and a gate-death saga (encoded in AGENTS.md).

## Trigger
Use this skill when:
- Launching a matrix / drill / flake-storm lane (many cells, many rounds, kill drills, rerun loops)
- Launching a gate or commit-retry loop (hook-red ladder) that must outlive its spawning session
- Resuming or debugging a stalled or interrupted drill lane
- Writing or extending a drill script

## Checklist

### Before the run
1. **Land before the grind.** The code under test is committed, landed on the default branch, pushed — THEN the rerun/flake loop starts. A stranded dirty worktree is the #1 recovery pattern; a drill must never run against code that exists only in a worktree.
2. **`__log__` entry first, status `in-progress`** — `<YYYY-MM-DD>-<slug>.md`, flipped to `done` when the lane finishes. It is the orchestrator's stall-detector data: an entry stuck at in-progress is a lane to interrogate.
3. **Claim a non-overlapping port window and root prefix**, and know every other live lane's — sweeps must be pidfile-scoped, not pattern-scoped (`pgrep -f` matches the sweeper's own cmdline and can kill a sibling lane's daemon).

### The drill script itself
4. **Results file is a machine-readable ledger.** Every finished cell appends `cell|VERDICT|epoch|wall_secs` to `results.tsv`. "Is it done, and how" is one file read; resumability is re-running the missing subset via `CELLS=`.
5. **Flake protocol lives in the script.** `ROUNDS=n CELLS=...` batch env, plus pre-registered failure discriminators (e.g. `UNPARSED|GAP|DUPSEQ|wake-census`) printed as the final summary — the agent never hand-greps logs.
6. **Pidfile tracking.** Every spawned daemon/process writes `$ROOT/.../<name>.pid`; kill and sweep paths read pidfiles, never raw `pgrep -f`. When a cmdline pattern is unavoidable, anchor it (`pgrep -f '^/abs/path/to/script$'`).
7. **Deadlines.** Every wait is `while cond && [ $SECONDS -lt $DEADLINE ]` with a TIMEOUT line and nonzero exit; a GLOBAL matrix deadline aborts remaining cells loud (nonzero exit, verdicts to the ledger) instead of holding the lane silently.
8. **Milestone timestamps.** `MILE` lines with a UTC prefix at every phase boundary (start, cell start/end, kill, settle) — slow vs hung is answerable from the log tail alone.

### During the run
9. **Launch the matrix backgrounded with completion notification** — no sleep/poll loops inside a tool call. A single foreground call that is long by design gets a timeout slightly above its expected duration, so a stuck wait is a tool error, not a zombie.
10. **Resume by subset selection from `results.tsv`**, never by re-reading raw logs.

### Detach-ladder law (gate & commit retry loops)

Sessions die mid-gate. Detached ladders never lose a byte. The law: a lane's own commit/gate loop obeys the same survival discipline as the drill it runs.

11. **Detached or illegal.** Any gate/commit retry loop launches via `setsid nohup` — never as an in-tool-call loop. The whole ladder (script, logs, sentinels, worktree, build caches) lives under `/var/tmp`: `/tmp` is tmpfs (RAM), and a server restart or /tmp hygiene wipes worktrees and ladders alike along with everything uncommitted. Content is committed FIRST (the first commit is real content; retry loops come after), so a wiped scratch costs reruns, not work. At lane END your repo's lane-hygiene/cleanup script owns the ladder's residue — sweep per-lane build-target caches and leaked fixtures of removed worktrees; removal requires the lane worktree ABSENT and no live reference (process cmdline / lsof), never mtime.
12. **Speak in files.** Per-attempt log tee'd to `<loop>-<N>.log` plus an exit-code file `<loop>-<N>.done`; one `<loop>.final` sentinel holding the landed HEAD hash on success or the literal `FAILED`. The sentinel is the orchestrator's landing hook — the orchestrator polls it, never the stdout of a session that may already be dead.
13. **Yield, guard, space.** A ladder first YIELDS to a live attempt of the same commit (poll HEAD-changed, bounded), then owns the retry sequence: it never starts an attempt onto a busy box (busy = a suite running from this worktree, matched via bracket-syntax self-exclusion `[c]argo` / `[n]extest` / `journe[y]` per the `pgrep -f` self-match law), and retries are spaced behind that guard so a loaded box gets room. Use the repo's own lane-ladder/commit-ladder generator (e.g. `<PROJECT>/scripts/lane-ladder.sh`) — the proven `/var/tmp/<lane>-commit.sh` shape: a DIRTY-TREE cleanliness gate before the push phase, and a union resolver for append-only markdown ledgers with SKIP-EMPTY rounds.
14. **Runners too, not just ladders.** Any runner/test/rig invocation expected to run >10 min (test suites, nextest) launches detached from the start — `setsid nohup`, tee'd per-run log, `.done` exit-code sentinel, completion via watcher or poll — never a foreground tool call: sessions die mid-foreground-runner and the death orphans the runner (parent gone, tests burning CPU pointlessly) with content uncommitted. Kill-scan own orphaned runner children before retrying.

### Close & jurisdiction laws

15. **Verify-before-close.** A closed lane's cleanliness/report claims are CLAIMS — acceptance evidence is remote verification (`git show origin/main:<file>` grep + ancestor checks), never report prose; staged-in-a-dead-worktree = nowhere. Final reports carry the remote grep result.
16. **Zero cross-lane jurisdiction.** No dispositions, verdicts, or ladder management of sibling lanes — misread states and foreign ladder launches were both falsified by raw state. Route cross-lane observations to the orchestrator as raw-state requests only; the orchestrator resolves by verification.
17. **PRE-PHASE clean-tree gate** — the ladder refuses (never mislabels) a dirty tree before any rebase/push phase; this prevents mislabeled-conflict incidents before they happen.
18. **Flag forwarding in launch re-execs.** A ladder `--launch` re-exec carries EVERY parsed flag, booleans included — a dropped flag starves a documented phase; the `--dry-run` launch line echoes the constructed cmdline, so preview and reality cannot diverge — verify flags via the dry-run echo before launching.
19. **Ladder self-identifies.** The lane-ladder script exports the automation push marker env var at its own top — the automation IDENTITY flag of the git-ops flow (AGENTS.md §Git workflow), NOT a bypass: the export SKIPS NOTHING and OPENS NOTHING, every hook runs FULLY ARMED and a stray marker-free push without a tty stays REFUSED. Without the self-export, a ladder launched from a marker-free agent shell hits the pre-push refuse on every attempt and silently push-blocks for hours.

## Skeleton
Copy the drill skeleton kept in `<PROJECT>/worklog/demo/drill-template.sh` — it embodies items 4–8 (env `ROUNDS`/`CELLS`/`DEADLINE`, results.tsv, a mile function with UTC, pidfile handling, deadline guards, discriminator summary). Replace the placeholder legs with the real cell work; keep the ledger, deadlines and summary shape.

20. **Census measures LOAD, not SHELLS.** A busy-box census counts runner/compiler BINARIES doing work (cargo/nextest/vitest/node runners, fixture daemons), NEVER ladder/chain/wrapper shells — a shell sleeping in its own drain carries zero load, and matching its argv (a script-name contained in the ladder's argv class) makes N concurrent ladders yield to each other forever: mutually idle box, all ladders exhausted. Self-exclusion by bracket first char per pattern (`[c]argo`, `[n]extest`, `journe[y]`) — the pgrep-self-match law (items 3/6) in its stronger form.
21. **Worktree kept until LANDED.** A FAILED ladder leaves its worktree as the commit's SOLE carrier — closeouts run `git worktree remove` ONLY after the sentinel hash is ancestor-verified on the remote default branch, never on FAILED (removal-on-FAILED orphans the commits; they survive only as salvage refs, and replays are rebuilds). Ladder FAILED paths print `worktree-kept <path>` — if you see that line, the worktree is evidence.

### Chain-gate & ghost-gate laws

22. **Chain gates are ancestry-first — a sentinel means "unlocked", never "landed".** A preceding gate's success sentinel (a landed-head hash in a `.final` file, a green CI conclusion) only UNLOCKS the next gate in the chain — it never proves the downstream step landed. Landing is proven ancestry-first: `git merge-base --is-ancestor <sentinel-hash> origin/<default-branch>` against a fresh `git fetch`. A watcher that reports LANDED/success from sentinel presence alone — including trusting the sentinel when the fetch fails — mislabels the chain; label `unlocked`, `unlocked-not-landed`, or `unlocked-unverified` as the evidence allows.

23. **Ghost-gate class — named, and tool-checked.** A ghost gate appears armed but gates nothing: a CI run concluding success with zero executed jobs, a required status not wired to any real check, or a sentinel written without the underlying gate running. The class is named so findings cite it. Detection is TOOL-CHECKED — inspect actual executed state with the tooling (`gh run view <id> --json jobs`: zero executed jobs on success = ghost; `gh api` required-checks resolves to real checks) — never inferred from a green mark or a sentinel file. A verdict on a ghost gate reports `GHOST-GATE`, never success.