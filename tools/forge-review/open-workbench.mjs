#!/usr/bin/env node
// forge:review — start the dev server and open the Forge Review workbench in
// the default browser. The workbench page (tools/forge-review/index.html) is
// served by Vite dev at /tools/forge-review/index.html once FRD-2 lands; until
// then the game root is opened instead. Ctrl-C stops the dev server.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDevServer } from './lib/server.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKBENCH_FILE = path.join(REPO_ROOT, 'tools', 'forge-review', 'index.html');

async function main() {
  const server = await startDevServer({ repoRoot: REPO_ROOT });
  const workbenchUrl = `${server.url}/tools/forge-review/index.html`;
  console.log(`forge-review: dev server on ${server.url}`);
  const pageUrl = fs.existsSync(WORKBENCH_FILE) ? workbenchUrl : server.url;
  if (pageUrl !== workbenchUrl) {
    console.log('forge-review: workbench page not present yet (lands with FRD-2) — opening game root');
  } else {
    console.log(`forge-review: workbench on ${workbenchUrl}`);
  }
  try {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [pageUrl], { stdio: 'ignore', detached: true }).unref();
  } catch (err) {
    console.error(`forge-review: could not open browser: ${err?.message ?? err}`);
  }
  console.log('forge-review: press Ctrl-C to stop the dev server');
  const stop = () => {
    server.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  await new Promise(() => {});
}

main().catch((err) => {
  console.error(`forge-review: ${err?.stack ?? err}`);
  process.exit(1);
});
