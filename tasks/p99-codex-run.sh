#!/bin/bash
# Run a Codex ChatGPT-subscription agent with bobby first, prateek.ranka fallback.
# Usage: tasks/p99-codex-run.sh <sol|luna> <brief-file> <logfile>
set -euo pipefail

ROLE="${1:?role sol|luna}"
BRIEF="${2:?brief file}"
LOG="${3:?log file}"
ROOT="/Users/prateekranka/Cowork/spacepixelrts"
CODEX_BIN="${CODEX_BIN:-/opt/homebrew/bin/codex}"
HOME_BASE="${HOME}/.codex-p99"
AUTH_LIVE="${HOME}/.codex/auth.json"
AUTH_BOBBY="${HOME}/.codex/auth_bobbyranka.json"
AUTH_PRATEEK="${HOME}/.codex/auth_prateekranka.json"

if [[ "$ROLE" == "sol" ]]; then
  MODEL="gpt-5.6-sol"
  EFFORT="xhigh"
  FAST="false"
elif [[ "$ROLE" == "luna" ]]; then
  MODEL="gpt-5.6-luna"
  EFFORT="max"
  FAST="true"
else
  echo "role must be sol or luna" >&2
  exit 2
fi

mkdir -p "$HOME_BASE"
# Refresh bobby snapshot from the live Codex login when it is bobby.
python3 - "$AUTH_LIVE" "$AUTH_BOBBY" <<'PY'
import json, base64, sys
from pathlib import Path
live, bobby = map(Path, sys.argv[1:])
try:
    tok = json.loads(live.read_text())["tokens"]["id_token"]
    pad = tok.split(".")[1] + "=" * (-len(tok.split(".")[1]) % 4)
    email = json.loads(base64.urlsafe_b64decode(pad)).get("email", "")
except Exception:
    email = ""
if email == "bobbyranka@gmail.com":
    bobby.write_bytes(live.read_bytes())
    bobby.chmod(0o600)
print(email or "unknown")
PY

run_with_auth() {
  local auth_src="$1"
  local label="$2"
  local run_home="$HOME_BASE/$label"
  mkdir -p "$run_home"
  cp "$auth_src" "$run_home/auth.json"
  chmod 600 "$run_home/auth.json"
  cat > "$run_home/config.toml" <<EOF
model = "$MODEL"
model_reasoning_effort = "$EFFORT"
approval_policy = "never"
sandbox_mode = "danger-full-access"
EOF
  echo "P99-CODEX account=$label model=$MODEL effort=$EFFORT fast=$FAST" | tee -a "$LOG"
  CODEX_HOME="$run_home" "$CODEX_BIN" exec \
    --dangerously-bypass-approvals-and-sandbox \
    --skip-git-repo-check \
    --cd "$ROOT" \
    -m "$MODEL" \
    -c "model_reasoning_effort=\"$EFFORT\"" \
    -c "features.fast_mode=$FAST" \
    "$(cat "$BRIEF")" \
    2>&1 | tee -a "$LOG"
  return "${PIPESTATUS[0]}"
}

quota_hit() {
  rg -qi 'usage limit|rate limit|quota|too many tokens|exceeded your|try again later|usage_limit' "$LOG"
}

: > "$LOG"
if [[ -f "$AUTH_BOBBY" ]]; then
  if run_with_auth "$AUTH_BOBBY" "bobbyranka"; then
    exit 0
  fi
  if quota_hit && [[ -f "$AUTH_PRATEEK" ]]; then
    echo "P99-CODEX bobby quota/error — falling back to prateek.ranka@gmail.com" | tee -a "$LOG"
    run_with_auth "$AUTH_PRATEEK" "prateekranka"
    exit $?
  fi
  exit 1
fi

echo "missing $AUTH_BOBBY" >&2
exit 1
