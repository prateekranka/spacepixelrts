#!/usr/bin/env bash
# Snapshot the orchestrator's current state: process aliveness, files written, git log,
# and the latest Cursor transcript tail. Appends a timestamped block to notes.md.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

TS="$(date '+%Y-%m-%d %H:%M:%S')"
PID="$(ps aux | grep 'cursor-agent.*grok-4.6-xhigh' | grep -v grep | awk '{print $2}' | head -1)"

# Latest transcript (by mtime, exclude the composer smoke-test session if determinable).
LATEST="$(find ~/.cursor/projects/Users-prateekranka-Cowork-spacepixelrts/agent-transcripts -name '*.jsonl' -exec ls -t {} + 2>/dev/null | head -1)"

# Files currently in repo (excluding .git, node_modules, notes.md, log).
FILES="$(find . -path ./.git -prune -o -path ./node_modules -prune -o -type f -print 2>/dev/null | grep -vE '^\./\.git|node_modules|notes\.md|tasks-orchestrator\.log' | sort | sed 's/^/  /')"

# Recent git log.
GLOG="$(git log --oneline -5 2>/dev/null | sed 's/^/  /')"

# Latest orchestrator assistant text + tool calls from transcript (last ~12 events).
TAIL=""
if [ -n "$LATEST" ] && [ -f "$LATEST" ]; then
  TAIL="$(python3 -c "
import json,sys
try:
  rows=[]
  for line in open('$LATEST'):
    line=line.strip()
    if not line: continue
    try: d=json.loads(line)
    except: continue
    if d.get('role')=='assistant':
      m=d.get('message',{})
      c=m.get('content',[])
      if isinstance(c,list):
        for b in c:
          if b.get('type')=='text': rows.append('A: '+b['text'][:240])
          elif b.get('type')=='tool_use': rows.append('TOOL '+b.get('name')+' '+str(b.get('input',{}))[:120])
  print('\n'.join(rows[-12:]))
except Exception as e: print('(transcript read error)', e)
")"
fi

{
  echo ""
  echo "### checkpoint $TS"
  if [ -n "$PID" ]; then
    ET="$(ps -p "$PID" -o etime= 2>/dev/null | tr -d ' ')"
    echo "- **orchestrator: RUNNING** (pid $PID, elapsed ${ET:-?})"
  else
    echo "- **orchestrator: NOT RUNNING** (no grok-4.6-xhigh process found)"
  fi
  echo "- files in repo:"
  [ -n "$FILES" ] && echo "$FILES" || echo "  (none)"
  echo "- git log:"
  [ -n "$GLOG" ] && echo "$GLOG" || echo "  (no commits)"
  if [ -n "$TAIL" ]; then
    echo "- latest transcript tail:"
    echo "$TAIL" | sed 's/^/  /'
  fi
} >> notes.md

echo "checkpoint written ($TS) — orchestrator ${PID:+RUNNING}${PID:-DOWN}"
