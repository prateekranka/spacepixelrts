// Forge Review Deck — dev server lifecycle.
//
// startDevServer(opts) -> { url, stop() }  (the returned object is also the
// internal state handle, so stopDevServer(state) works on it directly).
//   - picks a free port on 127.0.0.1 via net
//   - spawns <repo>/node_modules/.bin/vite --host 127.0.0.1 --port N --strictPort
//     detached:true (own process group)
//   - waits until fetch(url) succeeds (timeout 120s)
//   - stop(): process-group SIGTERM -> 3s grace -> SIGKILL -> destroys stdio
// No console noise by default (opts.quiet === true).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = path.resolve(LIB_DIR, '..', '..', '..');

const READY_TIMEOUT_MS = 120000;
const KILL_GRACE_MS = 3000;
const READY_POLL_MS = 300;
const FETCH_TIMEOUT_MS = 1200;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Find a free TCP port on 127.0.0.1. */
export function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('no local QA port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start a Vite dev server for the repo and wait until it answers HTTP.
 * opts: { repoRoot, quiet }
 * Returns { url, stop } (the state handle itself, so stopDevServer(state)
 * also works on it).
 */
function ensureWritableTmpDir() {
  if (process.env.TMPDIR) return process.env.TMPDIR;
  const candidates = [path.join(os.homedir(), '.cache'), '/tmp'];
  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      const probe = path.join(candidate, `.frd-tmp-probe-${process.pid}`);
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      process.env.TMPDIR = candidate;
      return candidate;
    } catch {
      /* try next */
    }
  }
  return os.tmpdir();
}

export async function startDevServer(opts = {}) {
  ensureWritableTmpDir();
  const repoRoot = path.resolve(opts.repoRoot ?? DEFAULT_REPO_ROOT);
  const quiet = opts.quiet !== false;
  const mode = opts.mode === 'preview' ? 'preview' : 'dev';

  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const viteBin = path.join(repoRoot, 'node_modules', '.bin', 'vite');
  if (!fs.existsSync(viteBin)) {
    throw new Error(`vite binary not found at ${viteBin}`);
  }

  const args =
    mode === 'preview'
      ? ['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']
      : ['--host', '127.0.0.1', '--port', String(port), '--strictPort'];

  const child = spawn(viteBin, args, {
      cwd: repoRoot,
      stdio: quiet ? ['ignore', 'ignore', 'ignore'] : ['ignore', 'pipe', 'pipe'],
      env: process.env,
      detached: true,
    },
  );
  const state = { child, exited: false, url, stopped: false };
  child.on('exit', () => {
    state.exited = true;
  });
  if (!quiet) {
    child.stdout?.on('data', (data) => process.stdout.write(data));
    child.stderr?.on('data', (data) => process.stderr.write(data));
  }

  const deadline = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadline && !state.exited) {
    if (await isReachable(url)) {
      ready = true;
      break;
    }
    await delay(READY_POLL_MS);
  }
  if (!ready) {
    await stopDevServer(state);
    throw new Error(`dev server did not become reachable at ${url} within ${READY_TIMEOUT_MS}ms`);
  }

  state.stop = () => stopDevServer(state);
  return state;
}

/**
 * Guaranteed reap of a dev server started by startDevServer: SIGTERM to the
 * whole process group, 3s grace, SIGKILL fallback, then destroy stdio.
 */
export async function stopDevServer(state) {
  if (!state || state.stopped) return;
  state.stopped = true;
  const child = state.child;
  if (child?.pid != null && !state.exited) {
    const kill = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          /* already gone */
        }
      }
    };
    kill('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(KILL_GRACE_MS)]);
    if (!state.exited) kill('SIGKILL');
  }
  child?.stdout?.destroy();
  child?.stderr?.destroy();
  child?.stdin?.destroy();
}
