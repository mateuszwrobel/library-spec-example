#!/usr/bin/env bash
# watch-ci.sh — watch GitHub Actions runs to terminal state.
#
# Usage:
#   watch-ci.sh [--repo OWNER/REPO] MODE
#
# Modes:
#   --list [count]           recent runs (`gh run list --limit <count|10>`)
#   --watch <run-id|latest>  follow a run to conclusion via `gh run view` polling,
#                            tolerant of transient "not finished" states
#   --until <run-id>         poll `gh api repos/{owner}/{repo}/actions/runs/{id}`
#                            until status=completed
#
# Env:
#   GH_REPO            repo as OWNER/REPO (default from --repo, else error)
#   GH_WORKFLOW        optional workflow filter for --list
#   POLL_INTERVAL      poll seconds (default 30)
#   WATCH_TIMEOUT      global deadline seconds (default 600; MILE ... TIMEOUT, exit 3)
#   GH_WATCH_VERBOSE=1 echo raw gh output
#
# Output lines:
#   MILE <UTC> ...                          phase boundaries
#   STATE|RUN|<epoch>|status=<s>|conclusion=<c>|url=<u>   per poll
#   STATE|RUN|<epoch>|ghost-gate conclusion=success jobs=0   tool-checked
#   FINAL|VERDICT|<epoch>|conclusion=<c>|gate=unlocked|ghost-gate
#
# Ghost-gate rule (TOOL-CHECKED): a success conclusion with ZERO executed jobs
# (all skipped/absent) gates nothing → GHOST-GATE, exit 1 — never a pass.
# Chain gates: conclusion=success with real executed jobs means the gate is
# UNLOCKED for the next stage (gate=unlocked, exit 0) — never a downstream
# "landed" claim; landing is the ancestry check's job.
#
# Exit: 0 success with executed jobs (gate unlocked); 1 GHOST-GATE or a
#       concluded failure/cancelled/timed_out/startup_failure; 2 usage error;
#       3 timeout.
#
# Deps: gh, jq, GNU date. `set -u`; GIT_* env vars unset at top (a gh/git
# subprocess must never inherit a stray git-hook env). Every wait is bounded
# by $WATCH_TIMEOUT arithmetic.

set -u

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
      GIT_NAMESPACE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

POLL_INTERVAL="${POLL_INTERVAL:-30}"
WATCH_TIMEOUT="${WATCH_TIMEOUT:-600}"
GH_WATCH_VERBOSE="${GH_WATCH_VERBOSE:-0}"
GH_REPO="${GH_REPO:-}"

mile() { printf 'MILE %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
stamp() { date -u +%s; }

usage() {
  cat <<'EOF'
watch-ci.sh [--repo OWNER/REPO] MODE

Modes:
  --list [count]           recent runs (`gh run list --limit <count|10>`)
  --watch <run-id|latest>  follow a run to conclusion via `gh run view` polling
  --until <run-id>         poll `gh api .../actions/runs/{id}` until completed

Env:
  GH_REPO            repo as OWNER/REPO (default from --repo, else error)
  GH_WORKFLOW        optional workflow filter
  POLL_INTERVAL      poll seconds (default 30)
  WATCH_TIMEOUT      global deadline seconds (default 600)
  GH_WATCH_VERBOSE=1 echo raw gh output

Output: MILE <UTC> ...; STATE|RUN|...; FINAL|VERDICT|...|gate=unlocked|ghost-gate
Exit: 0 success with executed jobs (gate unlocked); 1 GHOST-GATE or concluded
      failure/cancelled/timed_out/startup_failure; 2 usage; 3 timeout.

Ghost-gate tool-check (TOOL-CHECKED): a success conclusion with ZERO executed
jobs (all skipped/absent) gates nothing → GHOST-GATE, exit 1 — never a pass.
conclusion=success means the gate is UNLOCKED for the next stage, never a
downstream "landed" claim.
Deps: gh, jq, GNU date.
EOF
}

list_runs() {
  local count="${MODE_ARG:-10}"
  local deadline=$(( $(stamp) + WATCH_TIMEOUT ))
  local wf=()
  [ -n "${GH_WORKFLOW:-}" ] && wf=(--workflow "$GH_WORKFLOW")
  mile "listing runs for $GH_REPO (limit $count)"
  while :; do
    if gh run list --repo "$GH_REPO" "${wf[@]}" --limit "$count"; then
      exit 0
    fi
    if [ "$(stamp)" -ge "$deadline" ]; then
      mile "TIMEOUT listing runs after ${WATCH_TIMEOUT}s"
      exit 3
    fi
    echo "STATE|LIST|$(stamp)|transient-error-retrying" >&2
    sleep "$POLL_INTERVAL"
  done
}

resolve_run() {
  local r="$1"
  if [ "$r" = "latest" ]; then
    r=$(gh run list --repo "$GH_REPO" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null) \
      || { echo "error: could not list runs for $GH_REPO" >&2; exit 1; }
  fi
  if [ -z "$r" ]; then
    echo "error: could not resolve run id" >&2
    exit 1
  fi
  echo "$r"
}

# Tool-checked ghost-gate + chain semantics at terminal state. A success
# conclusion with ZERO executed jobs gates nothing → GHOST-GATE (never a
# pass). A success with real executed jobs UNLOCKS the next gate — never a
# downstream "landed" claim (that is the ancestry check's job). On gh failure
# the success path is kept — no fabricated ghost verdict.
verdict_exit() {
  local run_id="$1" conclusion="$2"
  if [ "$conclusion" = "success" ]; then
    local executed
    executed="$(gh run view "$run_id" --repo "$GH_REPO" --json jobs \
      --jq '[.jobs[] | select(.status=="completed" and .conclusion=="success")] | length' 2>/dev/null)"
    if [ -n "$executed" ] && [ "$executed" -eq 0 ]; then
      echo "STATE|RUN|$(stamp)|ghost-gate conclusion=success jobs=0"
      echo "FINAL|VERDICT|$(stamp)|conclusion=success|ghost-gate"
      echo "GHOST-GATE" >&2
      exit 1
    fi
    echo "FINAL|VERDICT|$(stamp)|conclusion=success|gate=unlocked"
    exit 0
  fi
  echo "FINAL|VERDICT|$(stamp)|conclusion=$conclusion"
  exit 1
}

watch_run() {
  local run_id="$1"
  local deadline=$(( $(stamp) + WATCH_TIMEOUT ))
  mile "watching run $run_id (deadline $(date -u -d @"$deadline" +%H:%M:%SZ))"
  while :; do
    local out
    if ! out=$(gh run view "$run_id" --repo "$GH_REPO" --json status,conclusion,url 2>/dev/null); then
      echo "STATE|RUN|$(stamp)|gh-run-view-transient-error" >&2
      if [ "$(stamp)" -ge "$deadline" ]; then
        mile "TIMEOUT after ${WATCH_TIMEOUT}s"
        exit 3
      fi
      sleep "$POLL_INTERVAL"
      continue
    fi
    [ "$GH_WATCH_VERBOSE" = "1" ] && echo "$out"
    local status conclusion url
    status=$(jq -r '.status' <<<"$out")
    conclusion=$(jq -r '.conclusion // empty' <<<"$out")
    url=$(jq -r '.url' <<<"$out")
    echo "STATE|RUN|$(stamp)|status=$status|conclusion=$conclusion|url=$url"
    if [ "$status" = "completed" ]; then
      verdict_exit "$run_id" "$conclusion"
    fi
    if [ "$(stamp)" -ge "$deadline" ]; then
      mile "TIMEOUT after ${WATCH_TIMEOUT}s (status=$status)"
      exit 3
    fi
    sleep "$POLL_INTERVAL"
  done
}

until_done() {
  local run_id="$1"
  local deadline=$(( $(stamp) + WATCH_TIMEOUT ))
  mile "waiting for run $run_id to complete (deadline $(date -u -d @"$deadline" +%H:%M:%SZ))"
  while :; do
    local out
    if ! out=$(gh api "repos/$GH_REPO/actions/runs/$run_id" 2>/dev/null); then
      echo "STATE|RUN|$(stamp)|gh-api-transient-error" >&2
      if [ "$(stamp)" -ge "$deadline" ]; then
        mile "TIMEOUT after ${WATCH_TIMEOUT}s"
        exit 3
      fi
      sleep "$POLL_INTERVAL"
      continue
    fi
    [ "$GH_WATCH_VERBOSE" = "1" ] && echo "$out"
    local status conclusion html_url
    status=$(jq -r '.status' <<<"$out")
    conclusion=$(jq -r '.conclusion // empty' <<<"$out")
    html_url=$(jq -r '.html_url' <<<"$out")
    echo "STATE|RUN|$(stamp)|status=$status|conclusion=$conclusion|url=$html_url"
    if [ "$status" = "completed" ]; then
      verdict_exit "$run_id" "$conclusion"
    fi
    if [ "$(stamp)" -ge "$deadline" ]; then
      mile "TIMEOUT after ${WATCH_TIMEOUT}s (status=$status)"
      exit 3
    fi
    sleep "$POLL_INTERVAL"
  done
}

# --- parse args ---
GH_REPO_ARG=""
MODE=""
MODE_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo)   [ $# -ge 2 ] || { usage; exit 2; }; GH_REPO_ARG="$2"; shift 2 ;;
    --list)   MODE=list; shift
              if [ $# -gt 0 ] && [[ "$1" =~ ^[0-9]+$ ]]; then MODE_ARG="$1"; shift; fi ;;
    --watch)  MODE=watch; [ $# -ge 2 ] || { usage; exit 2; }; MODE_ARG="$2"; shift 2 ;;
    --until)  MODE=until; [ $# -ge 2 ] || { usage; exit 2; }; MODE_ARG="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[ -n "$MODE" ] || { usage; exit 2; }

if [ -z "$GH_REPO" ]; then
  GH_REPO="$GH_REPO_ARG"
fi
if [ -z "$GH_REPO" ]; then
  echo "error: GH_REPO required (env GH_REPO or --repo OWNER/REPO)" >&2
  exit 2
fi
case "$GH_REPO" in
  */*) ;;
  *) echo "error: GH_REPO must be OWNER/REPO" >&2; exit 2 ;;
esac

case "$MODE" in
  list)  list_runs ;;
  watch) watch_run "$(resolve_run "${MODE_ARG:-latest}")" ;;
  until) until_done "$MODE_ARG" ;;
esac