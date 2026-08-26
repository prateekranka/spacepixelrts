#!/usr/bin/env bash
# Forge Art Lab build wrapper (tool-bundler heuristic workaround).
set -e
cd "$(dirname "$0")/.."
exec node_modules/.bin/vite build --config vite.forge-art.config.ts "$@"
