#!/bin/bash
set -euo pipefail
cd /Users/prateekranka/Cowork/spacepixelrts
exec cursor-agent --trust --yolo --print --model gpt-5.6-sol-xhigh \
  -p "$(cat tasks/P99-orchestrator.md)" \
  2>&1 | tee tasks/p99-orchestrator.log
