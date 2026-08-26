#!/usr/bin/env node
/**
 * forge-trace-sweep — batch seed/difficulty/pairing sweep over deterministic
 * Forge Trace runs (docs/FORGE_TRACE.md §10).
 *
 * Thin wrapper: parses --key=value argv (repo parseArgs pattern) and spawns the
 * worker through tsx with the args as one JSON argv, passing stdio and the exit
 * code straight through.
 *
 *   npm run forge:trace:sweep -- --seeds=24301,424242,57005 \
 *     --difficulties=cadet,standard,veteran --out=<absolute dir> \
 *     [--pairings=sunweaver-vs-gravemark,gravemark-vs-sunweaver] [--fail-on-game-gate]
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const equals = raw.indexOf('=');
    if (equals >= 0) result[raw.slice(2, equals)] = raw.slice(equals + 1);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[raw.slice(2)] = argv[++index];
    else result[raw.slice(2)] = true;
  }
  return result;
}

const args = parseArgs(process.argv.slice(2));
if (Object.keys(args).length === 0) {
  console.error(
    'usage: forge-trace-sweep --seeds=<csv> --difficulties=<csv> --out=<absolute dir> ' +
      '[--pairings=sunweaver-vs-gravemark,gravemark-vs-sunweaver] [--fail-on-game-gate]',
  );
  process.exit(2);
}

const worker = path.join(REPO_ROOT, 'scripts', 'forge-trace-worker.mts');
const tsxCli = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const payload = JSON.stringify({ command: 'sweep', ...args });
const result = spawnSync(process.execPath, [tsxCli, worker, payload], { cwd: REPO_ROOT, stdio: 'inherit' });

if (result.error) {
  console.error(`forge-trace-sweep: failed to spawn worker: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 1);
