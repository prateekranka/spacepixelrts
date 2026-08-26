#!/usr/bin/env tsx
/**
 * forge-art-proof.mjs — Forge Art Lab proof packs.
 *
 * Single asset:  npx tsx scripts/forge-art-proof.mjs --asset=<id> --out=<abs-dir>
 * Roster board:  npx tsx scripts/forge-art-proof.mjs --asset=roster --out=<abs-dir>
 *
 * Context captures are COMPOSITED Playwright screenshots at exactly 1366x1024
 * taken on the real-renderer rig page (?mesh=0&combat=1). Sheets/differences
 * are Canvas2D compositions over Pix bytes rendered inside the browser, exported
 * as data URLs. Evidence never lands inside the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import playwright from 'playwright';
import {
  REPO_ROOT,
  VIEWPORT,
  resolveOut,
  parseArgs,
  delay,
  startVite,
  stopVite,
  launchChromium,
  attachErrors,
  settleFrames,
  dataUrlBuffer,
  sha256File,
} from './forge-art-lib.mjs';
import { ASSET_BY_ID, CATALOG } from '../tools/forge-art/src/registry';
import { getFrames } from '../tools/forge-art/src/adapters';
import { gridGeometryFor } from '../tools/forge-art/src/baseline-schema';

const require = createRequire(import.meta.url);
const BASELINES_DIR = path.join(REPO_ROOT, 'tools', 'forge-art', 'baselines');
const NAV_TIMEOUT_MS = 30000;

function gitInfo() {
  const git = (args) => execFileSync('git', ['-C', REPO_ROOT, ...args], { encoding: 'utf8' }).trim();
  return {
    revision: git(['rev-parse', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: git(['status', '--porcelain']).split('\n').filter(Boolean),
  };
}

/** Decode a baseline PNG into per-cell RGBA buffers keyed by frame order. */
function acceptedCells(assetId) {
  const dir = path.join(BASELINES_DIR, assetId);
  const pngPath = path.join(dir, 'baseline.png');
  if (!fs.existsSync(pngPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const geo = gridGeometryFor(assetId);
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const cells = [];
  let index = 0;
  for (let row = 0; row < geo.rows; row++) {
    for (let col = 0; col < geo.cols; col++) {
      const cell = Buffer.alloc(geo.cellW * geo.cellH * 4);
      for (let y = 0; y < geo.cellH; y++) {
        const srcStart = ((col * geo.cellW) + (row * geo.cellH + y) * png.width) * 4;
        png.data.copy(cell, y * geo.cellW * 4, srcStart, srcStart + geo.cellW * 4);
      }
      cells.push({ key: manifest.frames?.[index]?.key ?? `cell${index}`, data: cell });
      index++;
    }
  }
  return { cells, manifest, geo };
}

/** Build an HTML page that composes labeled/unlabeled sheets from raw RGBA bytes. */
function sheetComposerHtml(payloads) {
  const body = payloads.map((p) => `
    <section class="sheet" id="sheet-${p.id}">
      <h2>${escapeHtml(p.title)}</h2>
      <canvas data-fal-sheet="${p.id}" width="${p.width}" height="${p.height}"></canvas>
    </section>`).join('');
  const script = `
    window.__FAL_SHEETS__ = ${JSON.stringify(payloads)};
    async function compose() {
      for (const p of window.__FAL_SHEETS__) {
        const canvas = document.querySelector(\`[data-fal-sheet="\${p.id}"]\`);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // checker background
        const s = p.cellScale;
        for (let y = 0; y < canvas.height; y += s) {
          for (let x = 0; x < canvas.width; x += s) {
            ctx.fillStyle = ((x / s + y / s) & 1) ? '#20242c' : '#181b21';
            ctx.fillRect(x, y, s, s);
          }
        }
        let i = 0;
        for (const frame of p.frames) {
          const off = new OffscreenCanvas(p.cellW, p.cellH);
          const octx = off.getContext('2d');
          const img = octx.createImageData(p.cellW, p.cellH);
          img.data.set(frame.bytes);
          if (p.pass === 'silhouette') { toSilhouette(img); }
          else if (p.pass === 'value') { toValue(img); }
          octx.putImageData(img, 0, 0);
          const col = i % p.cols, row = Math.floor(i / p.cols);
          ctx.drawImage(off, col * p.cellW * s, row * p.cellH * s, p.cellW * s, p.cellH * s);
          if (p.labels && frame.key) {
            ctx.fillStyle = '#D09A4E';
            ctx.font = '10px ui-monospace,Menlo,monospace';
            ctx.fillText(frame.key, col * p.cellW * s + 3, row * p.cellH * s + 11);
          }
          i++;
        }
        await canvas.convertToBlob ? null : null;
      }
      document.body.dataset.ready = 'true';
    }
    function toSilhouette(img){ const d=img.data; for(let i=0;i<d.length;i+=4){const a=d[i+3]>0; d[i]=a?255:0; d[i+1]=a?255:0; d[i+2]=a?255:0; d[i+3]=a?255:0;} }
    function toValue(img){ const d=img.data; for(let i=0;i<d.length;i+=4){ if(d[i+3]<=0){d[i]=d[i+1]=d[i+2]=d[i+3]=0;continue;} const l=Math.round(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2]); d[i]=l;d[i+1]=l;d[i+2]=l;d[i+3]=255;} }
    compose();
  `;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0B0A12;color:#F0E7D2;font:12px ui-monospace,Menlo,monospace;padding:12px}
    .sheet{margin-bottom:16px} h2{font-size:12px;color:#D09A4E;margin:0 0 6px}
    canvas{display:block;border:1px solid #2A203B}
  </style></head><body>${body}<script>${script}</script></body></html>`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function captureRigContexts(browser, serverUrl, scenes, outDir, prefix, manifest) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  attachErrors(page, manifest, `${prefix}-rig`);
  await page.goto(`${serverUrl}/tools/forge-art/rig.html?mesh=0&combat=1&seed=53505`, {
    waitUntil: 'load',
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForFunction(() => globalThis.__FORGE_RIG__?.ready === true, null, { timeout: NAV_TIMEOUT_MS });
  const shots = {};
  for (const scene of scenes) {
    await page.evaluate((name) => globalThis.__FORGE_RIG__.show(name), scene);
    await settleFrames(page);
    await delay(120);
    const file = path.join(outDir, `${prefix}-${scene}.png`);
    await page.screenshot({ path: file, type: 'png' });
    shots[scene] = file;
  }
  await page.close();
  return shots;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(args.out);
  const assetArg = typeof args.asset === 'string' ? args.asset : '';
  if (!assetArg) throw new Error('--asset=<id>|roster is required');
  const isRoster = assetArg === 'roster';
  const assetIds = isRoster ? CATALOG.map((entry) => entry.assetId) : [assetArg];
  for (const id of assetIds) if (!ASSET_BY_ID[id]) throw new Error(`unknown asset ${id}`);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = {
    tool: 'forge-art-proof',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { asset: assetArg, out: outDir },
    viewport: VIEWPORT,
    seed: 53505,
    git: gitInfo(),
    captures: {},
    metrics: {},
    errors: [],
    productionIsolation: productionIsolationScan(),
    ok: false,
  };

  let server = null;
  let browser = null;
  try {
    server = await startVite({ config: 'vite.forge-art.config.ts' });
    console.log(`forge-art-proof: dev server at ${server.url}`);
    browser = await launchChromium(playwright, { marker: 'forge-art-proof' });

    // ---- pixel sheets via composer page (Canvas2D only) ----
    const payloads = [];
    for (const assetId of assetIds) {
      const candidateFrames = getFrames(assetId).map((f) => ({ key: f.key, bytes: Buffer.from(f.pix.d) }));
      const accepted = acceptedCells(assetId);
      const geo = gridGeometryFor(assetId);
      const scale = geo.cellW >= 64 ? 2 : 4;
      const common = {
        cellW: geo.cellW, cellH: geo.cellH, cols: geo.cols, cellScale: scale,
        width: geo.cellW * geo.cols * scale, height: geo.cellH * geo.rows * scale,
      };
      payloads.push({ id: `${assetId}-candidate`, title: `${assetId} — CURRENT CANDIDATE`, frames: candidateFrames, labels: true, pass: 'none', ...common });
      payloads.push({ id: `${assetId}-candidate-sil`, title: `${assetId} — silhouette`, frames: candidateFrames, labels: false, pass: 'silhouette', ...common });
      payloads.push({ id: `${assetId}-candidate-val`, title: `${assetId} — value`, frames: candidateFrames, labels: false, pass: 'value', ...common });
      if (accepted) {
        payloads.push({ id: `${assetId}-accepted`, title: `${assetId} — ACCEPTED BASELINE`, frames: accepted.cells, labels: true, pass: 'none', ...common });
        const diffFrames = accepted.cells.map((cell, index) => ({
          key: cell.key,
          bytes: diffBytes(cell.data, candidateFrames[index]?.bytes ?? Buffer.alloc(cell.data.length)),
        }));
        payloads.push({ id: `${assetId}-diff`, title: `${assetId} — DIFFERENCE (red = changed)`, frames: diffFrames, labels: true, pass: 'none', ...common });
      }
    }

    const composerPath = path.join('/tmp', `fal-composer-${process.pid}.html`);
    fs.writeFileSync(composerPath, sheetComposerHtml(payloads));
    const composerPage = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    attachErrors(composerPage, manifest, 'composer');
    await composerPage.goto(`file://${composerPath}`, { waitUntil: 'load' });
    await composerPage.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: NAV_TIMEOUT_MS });

    if (isRoster) {
      const rosterShots = {};
      for (const [name, selector] of [
        ['roster-labeled', '[data-fal-sheet$="-candidate"]'],
      ]) {
        void name; void selector;
      }
      // full-page roster composition: label every candidate sheet
      rosterShots['roster-unlabeled'] = null; // composed below element-by-element instead
      const elements = await composerPage.$$('.sheet');
      const files = {};
      for (let i = 0; i < elements.length; i++) {
        const heading = await elements[i].$eval('h2', (node) => node.textContent);
        const slug = slugify(heading);
        const file = path.join(outDir, `roster-${slug}.png`);
        await elements[i].screenshot({ path: file });
        files[slug] = file;
      }
      manifest.captures.rosterSheets = Object.keys(files);
      // copy canonical required names
      const copyIfExists = (slug, target) => { if (files[slug]) fs.copyFileSync(files[slug], path.join(outDir, target)); };
      for (const id of assetIds) {
        copyIfExists(`${id}-candidate-sil`, `roster-${slugify(id)}-silhouettes.png`);
        copyIfExists(`${id}-candidate-val`, `roster-${slugify(id)}-values.png`);
      }
    } else {
      for (const payload of payloads) {
        const el = await composerPage.$(`[data-fal-sheet="${payload.id}"]`);
        if (!el) continue;
        const map = {
          candidate: 'candidate-sheet.png',
          accepted: 'accepted-sheet.png',
          diff: 'difference-sheet.png',
          'candidate-sil': 'silhouette-sheet.png',
          'candidate-val': 'value-sheet.png',
        };
        const target = map[payload.id.replace(/^[^-]+-/, '')];
        if (target) await el.screenshot({ path: path.join(outDir, target) });
      }
      // source sheet = candidate at 1x
      const first = getFrames(assetIds[0]);
      writeSourceSheet(first, gridGeometryFor(assetIds[0]), path.join(outDir, 'source-sheet.png'));
    }
    await composerPage.close();
    fs.rmSync(composerPath, { force: true });

    // ---- real-renderer context captures ----
    const scenes = ['quiet-helios', 'unit-selected', 'cam-close', 'cam-normal', 'cam-strategic'];
    if (!isRoster) {
      scenes.push('construction', 'fog-edge');
    } else {
      scenes.push('confrontation', 'battle-clump');
    }
    const rigShots = await captureRigContexts(browser, server.url, scenes, outDir, isRoster ? 'context' : 'context', manifest);
    if (!isRoster) {
      const renames = {
        'cam-close': 'close-context.png',
        'cam-normal': 'normal-context.png',
        'cam-strategic': 'far-context.png',
      };
      for (const [scene, target] of Object.entries(renames)) {
        if (rigShots[scene]) fs.copyFileSync(rigShots[scene], path.join(outDir, target));
      }
    }

    // ---- metrics + manifests ----
    for (const assetId of assetIds) {
      const accepted = acceptedCells(assetId);
      const frames = getFrames(assetId);
      const candidateHashes = {};
      const report = [];
      for (const frame of frames) {
        candidateHashes[frame.key] = sha256Buffer(Buffer.from(frame.pix.d));
        if (accepted) {
          const match = accepted.cells.find((c) => c.key === frame.key);
          report.push({
            key: frame.key,
            acceptedSha: match ? sha256Buffer(match.data) : null,
            candidateSha: candidateHashes[frame.key],
            changed: !match || !match.data.equals(Buffer.from(frame.pix.d)),
          });
        }
      }
      manifest.metrics[assetId] = {
        candidateRevision: manifest.git.revision,
        candidateHashes,
        changes: accepted ? {
          changedCells: report.filter((r) => r.changed).map((r) => r.key),
          unchangedCount: report.filter((r) => !r.changed).length,
        } : 'NO ACCEPTED BASELINE',
      };
    }

    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(
      path.join(outDir, 'critic-brief.txt'),
      criticBrief(isRoster, assetIds),
    );
    fs.writeFileSync(
      path.join(outDir, 'console.txt'),
      manifest.errors.join('\n') || 'no console/page errors captured',
    );
    if (!isRoster) {
      fs.writeFileSync(path.join(outDir, 'asset.json'), JSON.stringify(ASSET_BY_ID[assetIds[0]], null, 2));
      fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(manifest.metrics[assetIds[0]], null, 2));
      fs.writeFileSync(path.join(outDir, 'changes.json'), JSON.stringify(manifest.metrics[assetIds[0]].changes, null, 2));
    } else {
      fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(CATALOG, null, 2));
      fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(manifest.metrics, null, 2));
    }
    manifest.ok = manifest.errors.length === 0;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    try { if (browser) await browser.close(); } catch {}
    try { await stopVite(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`--- forge-art-proof summary ---`);
    console.log(`ok=${manifest.ok} out=${outDir}`);
    if (manifest.errors.length) {
      for (const error of manifest.errors) console.log(`error: ${String(error).split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

function sha256Buffer(buffer) {
  return require('node:crypto').createHash('sha256').update(buffer).digest('hex');
}

function diffBytes(a, b) {
  const out = Buffer.alloc(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i += 4) {
    const differs =
      a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3];
    if (differs) {
      out[i] = 178; out[i + 1] = 34; out[i + 2] = 34; out[i + 3] = 255; // #B22222
    } else if ((a[i + 3] ?? 0) > 0) {
      out[i] = 60; out[i + 1] = 64; out[i + 2] = 72; out[i + 3] = 140; // dim ghost
    }
  }
  return out;
}

function writeSourceSheet(frames, geo, file) {
  const png = new PNG({ width: geo.cellW * geo.cols, height: geo.cellH * geo.rows });
  png.data.fill(0);
  frames.forEach((frame, index) => {
    const col = index % geo.cols;
    const row = Math.floor(index / geo.cols);
    for (let y = 0; y < geo.cellH; y++) {
      for (let x = 0; x < geo.cellW; x++) {
        const si = (x + y * geo.cellW) * 4;
        const di = ((col * geo.cellW + x) + (row * geo.cellH + y) * (geo.cellW * geo.cols)) * 4;
        png.data[di] = frame.pix.d[si];
        png.data[di + 1] = frame.pix.d[si + 1];
        png.data[di + 2] = frame.pix.d[si + 2];
        png.data[di + 3] = frame.pix.d[si + 3];
      }
    }
  });
  fs.writeFileSync(file, PNG.sync.write(png));
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function productionIsolationScan() {
  const dist = path.join(REPO_ROOT, 'dist');
  if (!fs.existsSync(dist)) return { scanned: false, reason: 'dist/ not built yet' };
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        if (/forge|art-lab|baseline/i.test(entry.name)) offenders.push(full);
        else if (/\.(js|css|html)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (/forge[ _-]?art[ _-]?lab|FORGE_ART/i.test(content)) offenders.push(full);
        }
      }
    }
  };
  walk(dist);
  return { scanned: true, clean: offenders.length === 0, offenders };
}

function criticBrief(isRoster, assetIds) {
  if (isRoster) {
    return `BLIND REVIEW BRIEF — Starhaven Forge Art Lab roster pack.

You are judging a developer workbench's evidence, not the game itself.
Look at the roster sheets and context captures. Answer:
1. Can you tell Sunweaver (warm gold/cream) assets from Gravemark (cold slate/ice) at a glance?
2. Does any unit read like another unit's twin? Name the pair.
3. Do buildings read at strategic distance?
4. Single biggest remaining review gap of the TOOL (what should it show that it does not?).`;
  }
  return `BLIND REVIEW BRIEF — Starhaven Forge Art Lab single-asset proof pack (${assetIds[0]}).

You are judging whether this tool pack makes art differences clear:
1. Are accepted vs candidate vs difference sheets readable side by side?
2. Is the sprite legible at the normal-context scale (not just enlarged)?
3. Do silhouette/value passes expose structure clearly?
4. Name the single biggest usability gap you see.`;
}

main().catch((error) => {
  console.error(`forge-art-proof: fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
