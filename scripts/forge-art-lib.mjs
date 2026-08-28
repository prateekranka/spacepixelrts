#!/usr/bin/env node
/**
 * forge-art-lib.mjs — shared node helpers for Forge Art Lab CLI/QA scripts.
 *
 * Adapted once from the proven qa-vs4 / self-view-harness patterns so the
 * forge-art scripts do not spawn yet more copies. Deliberately NOT imported by
 * any existing repo script (no behavior change outside tools).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VIEWPORT = { width: 1366, height: 1024 };

/** Absolute path required; must live outside the repository. Returns resolved path. */
export function resolveOut(raw) {
  if (typeof raw !== 'string' || raw.trim() === '' || !path.isAbsolute(raw)) {
    throw new Error('--out is required and must be an absolute path outside the repository');
  }
  const out = path.resolve(raw.trim());
  const relative = path.relative(REPO_ROOT, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`--out must be outside the repository (${REPO_ROOT})`);
  }
  return out;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseArgs(argv) {
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

export function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('could not allocate a local port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * Spawn vite with a config on an ephemeral port; poll until reachable.
 * opts: { config?: string, defaultPort?: number }
 */
export async function startVite({ config, defaultPort } = {}) {
  const port =
    typeof defaultPort === 'number' && Number.isFinite(defaultPort) ? defaultPort : await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const bin = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const args = ['--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  if (config) args.push('--config', config);
  const child = spawn(bin, args, {
    cwd: REPO_ROOT,
    detached: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { child, url, port, exited: false, stopped: false };
  child.on('exit', () => { state.exited = true; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', () => {});
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopVite(state);
  throw new Error(state.exited ? 'vite exited before becoming reachable' : `vite did not become ready at ${url}`);
}

/** SIGTERM the whole process group, escalate to SIGKILL. Always safe to call. */
export async function stopVite(server) {
  if (!server || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  const killGroup = (signal) => {
    if (child.pid == null || child.exitCode !== null || child.signalCode !== null) return;
    try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch {} }
  };
  if (!server.exited) {
    killGroup('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(4000)]);
    killGroup('SIGKILL');
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

/**
 * Launch chromium via the proven fallback chain. This host has no GPU and no
 * Chrome channel: /usr/bin/chromium works, channel:'chrome' does not.
 * marker: unique user-data-dir token so post-run pgrep checks are unambiguous.
 */
export async function launchChromium(playwright, { marker = 'forge-art' } = {}) {
  const attempts = [
    { executablePath: '/usr/bin/chromium' },
    { channel: 'chrome' },
    {},
  ];
  let lastError;
  for (const opts of attempts) {
    try {
      const { executablePath, channel, ...rest } = opts;
      void rest;
      return await playwright.chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        ...(channel ? { channel } : {}),
        args: [
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
        ],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('no chromium available');
}

export function attachErrors(page, manifest, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') manifest.errors.push(`${label} console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => manifest.errors.push(`${label} pageerror: ${error?.stack ?? String(error)}`));
}

export async function settleFrames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

export function dataUrlBuffer(dataUrl) {
  return Buffer.from(String(dataUrl).split(',')[1], 'base64');
}

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** True when the given renderer string reports software GL (SwiftShader/llvmpipe). */
export function isSoftwareGl(rendererString) {
  return /swiftshader|llvmpipe|software/i.test(String(rendererString));
}

/** pgrep-based leak check for QA cleanup gates. Returns matching command lines. */
export async function findLeakedProcesses(pattern) {
  const { execFile } = await import('node:child_process');
  return new Promise((resolve) => {
    execFile('pgrep', ['-af', pattern], { timeout: 5000 }, (error, stdout) => {
      if (error) return resolve([]);
      resolve(stdout.split('\n').map((line) => line.trim()).filter(Boolean));
    });
  });
}
