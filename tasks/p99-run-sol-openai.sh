#!/bin/bash
set -euo pipefail
cd /Users/prateekranka/Cowork/spacepixelrts
exec bash tasks/p99-codex-run.sh sol tasks/P99-orchestrator-openai.md tasks/p99-orchestrator-openai.log
