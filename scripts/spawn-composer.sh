#!/bin/bash
# Spawn a Composer 2.5 sub-agent with a bounded timeout and guaranteed reaping.
# Usage: spawn-composer.sh <brief.md> <log-path> [timeout-seconds]
#
# Always kills the agent process group on EXIT/INT/TERM or when the timeout
# fires. macOS has no GNU `timeout` / `setsid(1)`. Uses python os.setsid +
# pty.fork so Node --print actually streams (file redirects stay block-buffered).
# The wrapper itself always terminates and writes EXIT:<code> to the log.
set -euo pipefail
cd /Users/prateekranka/Cowork/spacepixelrts

BRIEF="${1:?usage: spawn-composer.sh <brief.md> <log> [timeout_sec]}"
LOG="${2:?log path}"
TIMEOUT_SEC="${3:-600}"

if [[ ! -f "$BRIEF" ]]; then
  echo "missing brief: $BRIEF" >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG")"

AGENT_PID=""
WATCHDOG_PID=""
PGID=""

reap_tree() {
  local sig="$1"
  if [[ -n "${PGID}" ]]; then
    kill -"${sig}" -- -"${PGID}" 2>/dev/null || true
  fi
  if [[ -n "${AGENT_PID}" ]]; then
    pkill -"${sig}" -P "${AGENT_PID}" 2>/dev/null || true
    kill -"${sig}" "${AGENT_PID}" 2>/dev/null || true
  fi
}

cleanup() {
  reap_tree TERM
  sleep 1
  reap_tree KILL
  if [[ -n "${WATCHDOG_PID}" ]]; then
    kill "${WATCHDOG_PID}" 2>/dev/null || true
    wait "${WATCHDOG_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM HUP

: > "$LOG"

# New session + PTY so kill -- -PGID reaps cursor-agent + MCP children, and
# Node flushes --print incrementally (stdbuf does not unbuffer Node).
python3 -c '
import os, sys, pty, time

brief_path, log_path = sys.argv[1], sys.argv[2]
brief = open(brief_path).read()
os.setsid()
log = open(log_path, "ab", buffering=0)

pid, fd = pty.fork()
if pid == 0:
    os.execvp("cursor-agent", [
        "cursor-agent",
        "--trust", "--yolo", "--print", "--approve-mcps",
        "--model", "composer-2.5",
        "-p", brief,
    ])

while True:
    try:
        data = os.read(fd, 4096)
    except OSError:
        break
    if not data:
        break
    log.write(data)
    try:
        os.write(1, data)
    except OSError:
        pass

_dead, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") else (status >> 8)
sys.exit(code)
' "$BRIEF" "$LOG" &
AGENT_PID=$!
PGID=$(ps -o pgid= -p "$AGENT_PID" | tr -d " ")

(
  sleep "$TIMEOUT_SEC"
  if kill -0 "$AGENT_PID" 2>/dev/null; then
    msg="TIMEOUT:${TIMEOUT_SEC}s — killing process group ${PGID}"
    printf '\n%s\n' "$msg" >> "$LOG"
    printf '%s\n' "$msg"
    kill -TERM -- -"$PGID" 2>/dev/null || kill -TERM "$AGENT_PID" 2>/dev/null || true
    sleep 2
    kill -KILL -- -"$PGID" 2>/dev/null || kill -KILL "$AGENT_PID" 2>/dev/null || true
  fi
) &
WATCHDOG_PID=$!

set +e
wait "$AGENT_PID"
EC=$?
set -e

kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true
WATCHDOG_PID=""
PGID=""
AGENT_PID=""
trap - EXIT INT TERM HUP

printf 'EXIT:%s\n' "$EC" | tee -a "$LOG"
exit 0
