#!/usr/bin/env node
/**
 * forge-trace-view.mjs — build the standalone timeline viewer for a Forge Trace
 * trace.json. Reads scripts/forge-timeline.html, embeds the parsed trace JSON
 * in place of the template's data placeholder (the exact comment+null token),
 * optionally injects a Review Deck base URL, and writes timeline.html.
 *
 * Usage:
 *   node scripts/forge-trace-view.mjs --trace=<abs trace.json> [--out=<dir>] \
 *       [--review-base-url=<url>] [--serve]
 *
 * Exit codes: 0 ok, 2 io/tool errors, 3 invalid trace.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const HTML_PATH = fileURLToPath(new URL('./forge-timeline.html', import.meta.url));
const DATA_TOKEN = '/*__FORGE_TRACE_DATA__*/null';
const REVIEW_TOKEN = '/*__FORGE_REVIEW_BASE_URL__*/undefined';

function fail(code, msg) {
  process.stderr.write(`forge-trace-view: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { trace: null, out: null, reviewBaseUrl: null, serve: false };
  for (const a of argv) {
    if (a === '--serve') { args.serve = true; continue; }
    if (a.startsWith('--trace=')) { args.trace = a.slice('--trace='.length); continue; }
    if (a.startsWith('--out=')) { args.out = a.slice('--out='.length); continue; }
    if (a.startsWith('--review-base-url=')) { args.reviewBaseUrl = a.slice('--review-base-url='.length); continue; }
    fail(2, `unknown argument: ${a}`);
  }
  if (!args.trace) fail(2, 'missing required --trace=<abs trace.json>');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const tracePath = path.resolve(args.trace);
  const outDir = args.out ? path.resolve(args.out) : path.dirname(tracePath);

  /* read + validate trace (minimal shape: object with events array) */
  let trace;
  try {
    trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  } catch (err) {
    fail(3, `cannot parse trace ${tracePath}: ${err.message}`);
  }
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    fail(3, `trace ${tracePath} is not a JSON object`);
  }
  if (!Array.isArray(trace.events)) {
    fail(3, `trace ${tracePath} has no events array (schema v1 requires events: ForgeTraceEvent[])`);
  }

  /* read template + replace the exact data token (single occurrence) */
  let html;
  try {
    html = fs.readFileSync(HTML_PATH, 'utf8');
  } catch (err) {
    fail(2, `cannot read template ${HTML_PATH}: ${err.message}`);
  }
  const occurrences = html.split(DATA_TOKEN).length - 1;
  if (occurrences !== 1) {
    fail(2, `template token ${DATA_TOKEN} found ${occurrences} times (expected exactly 1) — template changed?`);
  }
  html = html.replace(DATA_TOKEN, JSON.stringify(trace));

  /* optional review deck base URL */
  if (args.reviewBaseUrl) {
    const revOccurrences = html.split(REVIEW_TOKEN).length - 1;
    if (revOccurrences !== 1) {
      fail(2, `template token ${REVIEW_TOKEN} found ${revOccurrences} times (expected exactly 1) — template changed?`);
    }
    html = html.replace(REVIEW_TOKEN, JSON.stringify(String(args.reviewBaseUrl)));
  }

  /* write */
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (err) {
    fail(2, `cannot create output dir ${outDir}: ${err.message}`);
  }
  const outFile = path.join(outDir, 'timeline.html');
  try {
    fs.writeFileSync(outFile, html, 'utf8');
  } catch (err) {
    fail(2, `cannot write ${outFile}: ${err.message}`);
  }
  process.stdout.write(`forge-trace-view: wrote ${outFile} (${trace.events.length} events embedded)\n`);

  /* optional ephemeral static server for QA browser steps */
  if (args.serve) {
    const MIME = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript' };
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      let filePath = path.normalize(path.join(outDir, urlPath));
      if (!filePath.startsWith(outDir)) { res.writeHead(403); res.end('forbidden'); return; }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        if (fs.existsSync(filePath + '.html')) filePath += '.html';
        else { res.writeHead(404); res.end('not found'); return; }
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      process.stdout.write(`forge-trace-view: serving ${outDir} at http://127.0.0.1:${port}/timeline.html\n`);
    });
  }
}

main();
