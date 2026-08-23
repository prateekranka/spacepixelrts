#!/bin/bash
# Codex ChatGPT-subscription runner for the Linux box (~/workspace/spacepixelrts).
# Usage: tasks/codex-linux-run.sh <sol|luna> <brief-file> <logfile> [extra codex args...]
# Auth lives in ~/.codex-linux/auth.json (seeded from Hermes credential pool
# openai-codex-oauth-1). Re-seed if 401s appear:
#   python3: copy access_token+refresh_token from ~/.hermes/auth.json pool entry.
set -euo pipefail

ROLE="${1:?role sol|luna}"
BRIEF="${2:?brief file}"
LOG="${3:?log file}"
shift 3 || true
ROOT="$HOME/workspace/spacepixelrts"
CODEX_BIN="${CODEX_BIN:-codex}"
CODEX_HOME_DIR="$HOME/.codex-linux"

if [[ "$ROLE" == "sol" ]]; then
  MODEL="gpt-5.6-sol"
  EFFORT="max"
  FAST="false"
elif [[ "$ROLE" == "luna" ]]; then
  MODEL="gpt-5.6-luna"
  EFFORT="max"
  FAST="true"
else
  echo "role must be sol or luna" >&2
  exit 2
fi

mkdir -p "$CODEX_HOME_DIR"
[[ -f "$CODEX_HOME_DIR/auth.json" ]] || { echo "missing $CODEX_HOME_DIR/auth.json" >&2; exit 1; }
cat > "$CODEX_HOME_DIR/config.toml" <<EOF
model = "$MODEL"
model_reasoning_effort = "$EFFORT"
approval_policy = "never"
sandbox_mode = "workspace-write"
EOF

echo "P99-CODEX-LINUX model=$MODEL effort=$EFFORT fast=$FAST" | tee -a "$LOG"
CODEX_HOME="$CODEX_HOME_DIR" "$CODEX_BIN" exec \
  --dangerously-bypass-approvals-and-sandbox \
  --skip-git-repo-check \
  --cd "$ROOT" \
  -m "$MODEL" \
  -c "model_reasoning_effort=\"$EFFORT\"" \
  -c "features.fast_mode=$FAST" \
  "$@" \
  "$(cat "$BRIEF")" \
  2>&1 | tee -a "$LOG"
exit "${PIPESTATUS[0]}"
