#!/usr/bin/env bash
# watch-git.sh — observe a detached commit/push drive; restart when stuck/failed.
#
# Observes a detached drive script (a commit/push ladder) that follows the
# sentinel protocol: per-attempt `<loop>-<N>.log` plus an exit-code file
# `<loop>-<N>.done`, and ONE `<loop>.final` sentinel holding the HEAD hash the
# drive pushed (UNLOCKS the next gate — landing is verified, never assumed) or
# the literal `FAILED`. The watcher polls sentinel files /
# process liveness with hard deadlines, and can RE-LAUNCH the drive script
# (detached) when stuck or failed.
#
# Usage:
#   watch-git.sh <drive-script> [--final <path>] [--poll <secs>]
#                [--deadline <secs>] [--restart] [--restart-delay <secs>]
#                [--max-restarts <N>] [--progress-gap <secs>] [--log <path>]
#
# Behavior — every poll (every POLL secs, default 20):
#   (a) .final exists with a hash → the gate is UNLOCKED for the next stage.
#       Landing is proven ancestry-first: `git fetch` + `git merge-base
#       --is-ancestor` against origin/$DEFAULT_BRANCH. Verified ancestor →
#       success (landed=verified); not-on-tip → unlocked-not-landed (exit 0);
#       fetch failed → verdict unlocked, landed=unverified (exit 0). The
#       sentinel alone NEVER proves landing, and a failed fetch is never
#       success.
#   (b) .final == FAILED → restart decision
#   (c) drive process dead AND no .final → STUCK → restart decision
#   (d) no .final and no fresh .done / log mtime within --progress-gap
#       (default 300s) → STUCK → restart decision
#   (e) restart = wait --restart-delay (default 60), then
#       `setsid nohup <drive-script> [args...] >> <log>` relaunch detached,
#       bounded by --max-restarts (default 3); the relaunch pid is written to
#       `<final>.pid` for the next liveness polls
#   (f) --deadline (default 21600s) exceeded → WATCHER-TIMEOUT, exit 4
#
# Output lines:
#   MILE <UTC> ...                    phase boundaries
#   WATCHER|STATE|<epoch>|detail      per poll
#   WATCHER|RESTART|<epoch>|attempt=N per relaunch
#   WATCHER|VERDICT|<epoch>|success|unlocked|stuck|failed|timeout
#                                    (unlocked: gate open; landed=no|unverified)
#
# Exit: 0 landed or unlocked (the drive finished its job); 1 stuck or failed
#       after restart budget; 2 usage; 4 timeout.
#
# Scratch advice: keep the drive script, its logs/sentinels and this watcher's
# log under /var/tmp (root FS). /tmp is tmpfs (RAM) — a restart wipes it and
# uncommitted work dies with it. Put the lane worktree under /var/tmp too, and
# make the real content the FIRST commit before any retry loop.
#
# Deps: bash + coreutils. `set -u`; GIT_* env vars unset at top.

set -u

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR \
      GIT_NAMESPACE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES

DRIVE=""
DRIVE_ARGS=()
FINAL=""
POLL="${POLL:-20}"
DEADLINE="${DEADLINE:-21600}"
RESTART="${RESTART:-0}"
RESTART_DELAY="${RESTART_DELAY:-60}"
MAX_RESTARTS="${MAX_RESTARTS:-3}"
PROGRESS_GAP="${PROGRESS_GAP:-300}"
LOG=""
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"

mile() { printf 'MILE %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
stamp() { date -u +%s; }

usage() {
  cat <<'EOF'
watch-git.sh <drive-script> [options]

Observe a detached commit/push drive (sentinel protocol: <loop>-<N>.log,
<loop>-<N>.done, <loop>.final = pushed HEAD hash or FAILED); restart it when
stuck or failed.

A .final hash UNLOCKS the next gate — it never proves landing. LANDED is
proven ancestry-first: git fetch + git merge-base --is-ancestor against
origin/$DEFAULT_BRANCH. Fetch failure → verdict unlocked (landed=unverified),
never success.

Options:
  --final <path>        sentinel path (default: <drive-script>.final)
  --poll <secs>         poll interval (default 20)
  --deadline <secs>     global deadline (default 21600; exit 4 at cap)
  --restart             relaunch the drive when stuck/failed (and bounded)
  --restart-delay <secs> wait before relaunch (default 60)
  --max-restarts <N>    restart budget (default 3)
  --progress-gap <secs> max allowed silence in .done/log mtime (default 300)
  --log <path>          append drive + relaunch output here

Output: MILE <UTC> ...; WATCHER|STATE|...; WATCHER|RESTART|...; WATCHER|VERDICT|...
Exit: 0 landed or unlocked (drive finished its job; unlocked = gate open,
      landing not proven); 1 stuck/failed after restart budget; 2 usage; 4 timeout.
Deps: bash + coreutils + git (for ancestor verification).
EOF
}

is_hash() { [[ "$1" =~ ^[0-9a-f]{7,40}$ ]]; }

# Drive pid: prefer the pidfile the drive (or a relaunch) writes to
# <final>.pid; fall back to an anchored pgrep of the drive basename (bracket
# first char = pgrep -f self-match law).
drive_pid() {
  local pidfile="${FINAL%.final}.pid"
  if [ -f "$pidfile" ]; then
    cat "$pidfile"
  else
    local base="${DRIVE##*/}" first
    first="${base:0:1}"
    pgrep -f "[${first}]${base:1}" | head -1
  fi
}

newest_trace() {
  local newest="" f
  for f in "${FINAL%.final}"-*.done "${FINAL%.final}"-*.log; do
    [ -e "$f" ] || continue
    if [ -z "$newest" ] || [ "$(stat -c %Y "$f")" -gt "$(stat -c %Y "$newest")" ]; then
      newest="$f"
    fi
  done
  if [ -z "$newest" ] && [ -n "$LOG" ] && [ -f "$LOG" ]; then
    newest="$LOG"
  fi
  echo "$newest"
}

relaunch() {
  attempt=$(( attempt + 1 ))
  echo "WATCHER|RESTART|$(stamp)|attempt=$attempt"
  mile "restarting drive (attempt $attempt/$MAX_RESTARTS) in ${RESTART_DELAY}s"
  sleep "$RESTART_DELAY"
  local dir pid
  dir="$(dirname "$DRIVE")"
  mkdir -p "$dir" || { echo "error: cannot mkdir $dir" >&2; exit 2; }
  cd "$dir" || exit 2
  if [ -n "$LOG" ]; then
    setsid nohup bash "$DRIVE" "${DRIVE_ARGS[@]}" >>"$LOG" 2>&1 &
    pid=$!
  else
    setsid nohup bash "$DRIVE" "${DRIVE_ARGS[@]}" >/dev/null 2>&1 &
    pid=$!
  fi
  echo "$pid" > "${FINAL%.final}.pid"
  mile "drive relaunched pid=$pid"
}

# --- parse args ---
while [ $# -gt 0 ]; do
  case "$1" in
    --final)          [ $# -ge 2 ] || { usage; exit 2; }; FINAL="$2"; shift 2 ;;
    --poll)           [ $# -ge 2 ] || { usage; exit 2; }; POLL="$2"; shift 2 ;;
    --deadline)       [ $# -ge 2 ] || { usage; exit 2; }; DEADLINE="$2"; shift 2 ;;
    --restart)        RESTART=1; shift ;;
    --restart-delay)  [ $# -ge 2 ] || { usage; exit 2; }; RESTART_DELAY="$2"; shift 2 ;;
    --max-restarts)   [ $# -ge 2 ] || { usage; exit 2; }; MAX_RESTARTS="$2"; shift 2 ;;
    --progress-gap)   [ $# -ge 2 ] || { usage; exit 2; }; PROGRESS_GAP="$2"; shift 2 ;;
    --log)            [ $# -ge 2 ] || { usage; exit 2; }; LOG="$2"; shift 2 ;;
    -h|--help)        usage; exit 0 ;;
    -*)               echo "unknown option: $1" >&2; usage; exit 2 ;;
    *)                if [ -z "$DRIVE" ]; then DRIVE="$1"; else DRIVE_ARGS+=("$1"); fi; shift ;;
  esac
done

if [ -z "$DRIVE" ]; then
  usage
  exit 2
fi
if [ -z "$FINAL" ]; then
  FINAL="${DRIVE%.sh}.final"
fi

attempt=0
deadline=$(( $(stamp) + DEADLINE ))
mile "watching drive $DRIVE (final=$FINAL, deadline $(date -u -d @"$deadline" +%H:%M:%SZ))"

while :; do
  if [ "$(stamp)" -ge "$deadline" ]; then
    mile "WATCHER-TIMEOUT after ${DEADLINE}s"
    echo "WATCHER|VERDICT|$(stamp)|timeout"
    exit 4
  fi

  # (a) .final holds a hash → the gate is UNLOCKED for the next stage. The
  #     sentinel alone never proves landing — landing is ancestry-first
  #     (fetch + merge-base --is-ancestor), and a failed fetch is never success.
  if [ -f "$FINAL" ]; then
    v="$(cat "$FINAL")"
    if is_hash "$v"; then
      if git fetch origin >/dev/null 2>&1; then
        if git merge-base --is-ancestor "$v" "origin/$DEFAULT_BRANCH" 2>/dev/null; then
          echo "WATCHER|VERDICT|$(stamp)|success|hash=$v|landed=verified"
          mile "VERIFIED-LANDED $v"
          exit 0
        fi
        echo "WATCHER|STATE|$(stamp)|unlocked-not-landed hash=$v (not ancestor of origin/$DEFAULT_BRANCH)"
        echo "WATCHER|VERDICT|$(stamp)|unlocked|hash=$v|landed=no"
        mile "UNLOCKED $v (not on tip)"
        exit 0
      fi
      echo "WATCHER|STATE|$(stamp)|unlocked-unverified hash=$v (fetch failed; landing not proven)"
      echo "WATCHER|VERDICT|$(stamp)|unlocked|hash=$v|landed=unverified"
      mile "UNLOCKED $v (landing unverified)"
      exit 0
    fi
    if [ "$v" = "FAILED" ]; then
      echo "WATCHER|STATE|$(stamp)|FAILED sentinel"
      if [ "$RESTART" = "1" ] && [ "$attempt" -lt "$MAX_RESTARTS" ]; then
        relaunch
        continue
      fi
      echo "WATCHER|VERDICT|$(stamp)|failed"
      exit 1
    fi
    echo "WATCHER|STATE|$(stamp)|unreadable-final [$v]"
    if [ "$RESTART" = "1" ] && [ "$attempt" -lt "$MAX_RESTARTS" ]; then
      relaunch
      continue
    fi
    echo "WATCHER|VERDICT|$(stamp)|failed"
    exit 1
  fi

  # (c) drive dead → stuck
  pid="$(drive_pid)"
  drive_alive=0
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    drive_alive=1
  fi
  if [ "$drive_alive" = "0" ]; then
    echo "WATCHER|STATE|$(stamp)|STUCK drive-not-running no-final"
    if [ "$RESTART" = "1" ] && [ "$attempt" -lt "$MAX_RESTARTS" ]; then
      relaunch
      continue
    fi
    echo "WATCHER|VERDICT|$(stamp)|stuck"
    exit 1
  fi

  # (d) progress gap
  trace="$(newest_trace)"
  if [ -n "$trace" ]; then
    age=$(( $(stamp) - $(stat -c %Y "$trace") ))
    if [ "$age" -gt "$PROGRESS_GAP" ]; then
      echo "WATCHER|STATE|$(stamp)|STUCK no-progress ${age}s quiet (gap ${PROGRESS_GAP}s)"
      if [ "$RESTART" = "1" ] && [ "$attempt" -lt "$MAX_RESTARTS" ]; then
        relaunch
        continue
      fi
      echo "WATCHER|VERDICT|$(stamp)|stuck"
      exit 1
    fi
  fi

  echo "WATCHER|STATE|$(stamp)|ok drive-alive=$drive_alive"
  sleep "$POLL"
done