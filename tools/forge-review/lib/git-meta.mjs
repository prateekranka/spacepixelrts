// Forge Review Deck — git metadata (sync, cached per repo root).
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const cache = new Map();

/**
 * gitMeta(repoRoot) -> { commit, branch, dirty }
 * Sync child_process calls; result cached in module scope.
 */
export function gitMeta(repoRoot) {
  const root = path.resolve(repoRoot);
  if (cache.has(root)) return cache.get(root);
  const run = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  const meta = {
    commit: run(['rev-parse', 'HEAD']),
    branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: run(['status', '--porcelain']).length > 0,
  };
  cache.set(root, meta);
  return meta;
}
