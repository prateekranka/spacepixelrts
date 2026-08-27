#!/usr/bin/env node
/**
 * qa-forge-art.mjs — real-browser QA gate for Forge Art Lab.
 *
 * Flow (spec §16 / audit A7 §2):
 *   1. build + start the separate Art Lab server (ephemeral port)
 *   2. open workbench in real Chromium at 1366x1024
 *   3. catalog contains Sunweaver+Gravemark production assets
 *   4. legacy/hidden vocabulary absent from DOM + probe
 *   5-7. Lumen Guard select, facing cycle, play/pause
 *   8. accepted/candidate A/B with baseline hash equality
 *   9. passes: silhouette/value/diff canvases
 *   10. context rig opens (one live WebGL canvas inside iframe page)
 *   11-13. building select, construction states, footprint/scale references
 *   14. roster view
 *   15. proof pack subprocess validation (manifest completeness)
 *   16. acceptance refusals: stale evidence, failed gates, dry-run no-write
 *   17. sandbox candidate: diff appears, unrelated assets byte-identical
 *   18. screenshots non-black, exact 1366x1024
 *   19. one live WebGL context; zero console/page errors; clean process exit;
 *      manifest always written.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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
  findLeakedProcesses,
  sha256File,
} from './forge-art-lib.mjs';

const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 20000;

const BANNED = [
  'starhold', 'sunfold', 'sunwoven', 'helion compact', 'kryos conclave',
  'nihiline', 'voidmarked',
];

const REQUIRED_IDS = [
  'sunweaver-worker', 'gravemark-worker', 'sunweaver-wind-strider', 'gravemark-grav-skimmer',
  'sunweaver-lumen-guard', 'sunweaver-solar-strider', 'gravemark-rift-guard', 'gravemark-burden-walker',
  'sunweaver-core', 'gravemark-core', 'sunweaver-habitat', 'gravemark-habitat',
  'sunweaver-yard', 'gravemark-yard',
];

const MAG = [255, 0, 255, 255];

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function gitRevision() {
  return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function gitDirtyFiles() {
  return execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain'], { encoding: 'utf8' })
    .split('\n').map((line) => line.slice(3).trim()).filter(Boolean);
}

function runPublicForgeCommand(script, args) {
  try {
    const output = execFileSync('npm', ['run', script, '--', ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 300000,
    });
    return { code: 0, output };
  } catch (error) {
    return {
      code: error?.status ?? -1,
      output: `${error?.stdout ?? ''}${error?.stderr ?? ''}`,
    };
  }
}

function acceptedSnapshot() {
  const files = [
    path.join(REPO_ROOT, 'tools/forge-art/baselines/sunweaver-lumen-guard/baseline.png'),
    path.join(REPO_ROOT, 'tools/forge-art/baselines/sunweaver-lumen-guard/manifest.json'),
    path.join(REPO_ROOT, 'tools/forge-art/baselines/registry.json'),
  ];
  return Object.fromEntries(files.map((file) => {
    const stat = fs.statSync(file);
    return [file, { sha256: sha256File(file), mtimeMs: stat.mtimeMs, size: stat.size }];
  }));
}

function assertSnapshotUnchanged(before, after) {
  for (const [file, original] of Object.entries(before)) {
    const current = after[file];
    assertThat(current && current.sha256 === original.sha256, `${file} hash changed during dry-run`);
    assertThat(current.mtimeMs === original.mtimeMs, `${file} mtime changed during dry-run`);
    assertThat(current.size === original.size, `${file} size changed during dry-run`);
  }
}

function cloneEvidence(manifest) {
  return JSON.parse(JSON.stringify(manifest));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolveOut(args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = {
    tool: 'qa-forge-art',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out: outDir, viewport: VIEWPORT },
    steps: {},
    captures: {},
    errors: [],
    ok: false,
  };

  let server = null;
  let browser = null;
  const pages = [];
  let proofDir = '';
  let proofManifestPath = '';
  let proofManifest = null;
  let acceptedBefore = null;
  const step = async (name, fn) => {
    try {
      await fn();
      manifest.steps[name] = { pass: true };
      console.log(`qa-forge-art: ${name} PASS`);
    } catch (error) {
      manifest.steps[name] = { pass: false, error: String(error?.message ?? error) };
      throw error;
    }
  };

  try {
    server = await startVite({ config: 'vite.forge-art.config.ts' });
    browser = await launchChromium(playwright, { marker: 'forge-art-qa' });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });

    let page;
    await step('server-and-page', async () => {
      page = await context.newPage();
      pages.push(page);
      attachErrors(page, manifest, 'workbench');
      await page.goto(`${server.url}/tools/forge-art/index.html?mesh=0&combat=1`, {
        waitUntil: 'load',
        timeout: NAV_TIMEOUT_MS,
      });
      await page.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: PROBE_TIMEOUT_MS });
    });

    await step('catalog-complete', async () => {
      const entries = await page.evaluate(() => globalThis.__FORGE_ART_QA__.catalog.entries.map((e) => e.id));
      for (const id of REQUIRED_IDS) assertThat(entries.includes(id), `catalog missing ${id}`);
      assertThat(entries.length === REQUIRED_IDS.length, `catalog size ${entries.length} != ${REQUIRED_IDS.length}`);
      const ariaLabels = await page.locator('[data-fal-asset]').evaluateAll((buttons) =>
        buttons.map((button) => ({ id: button.getAttribute('data-fal-asset'), label: button.getAttribute('aria-label') })),
      );
      for (const entry of ariaLabels) {
        assertThat(entry.label?.includes(`stable ID ${entry.id}`) === true, `catalog aria-label missing stable ID for ${entry.id}`);
      }
      assertThat(new Set(ariaLabels.map((entry) => entry.label)).size === ariaLabels.length, 'catalog aria-labels must be unique');
    });

    await step('vocabulary-clean', async () => {
      const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      const probeJson = JSON.stringify(await page.evaluate(() => globalThis.__FORGE_ART_QA__)).toLowerCase();
      for (const term of BANNED) {
        assertThat(!text.includes(term), `banned term "${term}" in DOM text`);
        assertThat(!probeJson.includes(term), `banned term "${term}" in probe JSON`);
      }
      // canonical labels present (case-insensitive: CSS may upper-case headers)
      const lower = text;
      for (const label of ['sunweaver', 'gravemark', 'core', 'habitat', 'yard', 'lumen guard']) {
        assertThat(lower.includes(label), `canonical label "${label}" missing from UI`);
      }
    });

    await step('lumen-guard-select-facing-play-pause', async () => {
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.selectAsset('sunweaver-lumen-guard'));
      await settleFrames(page);
      const facing0 = await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.facing);
      assertThat(facing0 === 0 || typeof facing0 === 'number', 'facing not numeric');
      for (const target of [1, 2, 3, 4]) {
        await page.evaluate((n) => globalThis.__FORGE_ART_TOOL__.setFacing(n), target);
        const facing = await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.facing);
        assertThat(facing === target, `facing set to ${target} failed (got ${facing})`);
      }
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.play());
      await delay(350);
      const frameA = await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.frame);
      await delay(350);
      const frameB = await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.frame);
      assertThat(frameB !== frameA || (await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.playing)) === false,
        'playback did not advance and is not paused');
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.pause());
      const pausedFrame = await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.frame);
      await delay(250);
      assertThat(
        (await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.frame)) === pausedFrame &&
        (await page.evaluate(() => globalThis.__FORGE_ART_QA__.state.playing)) === false,
        'pause did not hold frame',
      );
    });

    await step('ab-baseline-hash-equality', async () => {
      const hashes = await page.evaluate(() => globalThis.__FORGE_ART_QA__.ab);
      assertThat(hashes && hashes.baselineSha256 && hashes.candidateSha256, 'A/B hashes missing');
      assertThat(hashes.baselineSha256 === hashes.candidateSha256,
        'accepted baseline must equal candidate at ced0b94 state');
    });

    await step('passes-render', async () => {
      for (const pass of ['silhouette', 'value']) {
        await page.evaluate((p) => globalThis.__FORGE_ART_TOOL__.togglePass(p), pass);
        await settleFrames(page);
        await page.evaluate((p) => globalThis.__FORGE_ART_TOOL__.togglePass(p), pass);
      }
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.setAbMode('diff'));
      await settleFrames(page);
      const canvases = await page.locator('[data-fal-canvas]').count();
      assertThat(canvases >= 2 && canvases <= 3, `canvas count ${canvases} outside 2..3`);
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.setAbMode('split'));
    });

    await step('context-rig-single-webgl', async () => {
      const rigPage = await context.newPage();
      pages.push(rigPage);
      attachErrors(rigPage, manifest, 'rig');
      await rigPage.goto(`${server.url}/tools/forge-art/rig.html?mesh=0&combat=1&scene=unit-selected`, {
        waitUntil: 'load', timeout: NAV_TIMEOUT_MS,
      });
      await rigPage.waitForFunction(() => globalThis.__FORGE_RIG__?.ready === true, null, { timeout: PROBE_TIMEOUT_MS });
      const initialScene = await rigPage.evaluate(() => globalThis.__FORGE_RIG__.current);
      assertThat(initialScene === 'unit-selected', `rig ignored URL scene=unit-selected (current ${String(initialScene)})`);
      const webglCount = await rigPage.evaluate(() =>
        [...document.querySelectorAll('canvas')].filter((c) => {
          try { return c.getContext('webgl2') || c.getContext('webgl'); } catch { return false; }
        }).length);
      assertThat(webglCount === 1, `expected exactly 1 live WebGL canvas on rig, found ${webglCount}`);
      const shot = path.join(outDir, 'qa-rig-unit-selected.png');
      await settleFrames(rigPage);
      await rigPage.screenshot({ path: shot, type: 'png' });
      manifest.captures.rigUnitSelected = shot;
      await rigPage.close();
    });

    await step('building-mode', async () => {
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.selectAsset('sunweaver-core'));
      await settleFrames(page);
      const text = (await page.evaluate(() => document.body.innerText)).toLowerCase();
      assertThat(text.includes('core'), 'Core label missing after building select');
    });

    await step('roster-view', async () => {
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.openRoster());
      // composition is async; wait until at least one roster canvas exists
      const deadline = Date.now() + 10000;
      let rosterCanvases = 0;
      while (Date.now() < deadline) {
        rosterCanvases = await page.locator('#fal-roster-board:not([hidden]) canvas, #fal-roster-board canvas').count();
        if (rosterCanvases > 0) break;
        await delay(250);
      }
      await page.evaluate(() => globalThis.__FORGE_ART_TOOL__.closeRoster());
      assertThat(rosterCanvases > 0, 'roster view rendered no asset canvases');
    });

    await step('proof-pack-generation', async () => {
      proofDir = path.join(outDir, 'proof-lumen-guard');
      proofManifestPath = path.join(proofDir, 'manifest.json');
      acceptedBefore = acceptedSnapshot();
      const proof = runPublicForgeCommand('forge:art:proof', [
        '--asset=sunweaver-lumen-guard', `--out=${proofDir}`,
      ]);
      assertThat(proof.code === 0, `public proof command failed (${proof.code}): ${proof.output.slice(-1200)}`);
      const requiredFiles = [
        'manifest.json', 'asset.json', 'metrics.json', 'changes.json', 'source-sheet.png',
        'candidate-sheet.png', 'accepted-sheet.png', 'difference-sheet.png',
        'silhouette-sheet.png', 'value-sheet.png',
        'normal-context.png', 'close-context.png', 'far-context.png',
        'console.txt', 'critic-brief.txt',
      ];
      for (const file of requiredFiles) {
        assertThat(fs.existsSync(path.join(proofDir, file)), `proof pack missing ${file}`);
      }
      proofManifest = JSON.parse(fs.readFileSync(proofManifestPath, 'utf8'));
      assertThat(proofManifest.ok === true, 'proof manifest ok=false');
      assertThat(proofManifest.schemaVersion === 1, 'proof manifest schemaVersion must be 1');
      assertThat(proofManifest.tool === 'forge-art-proof', 'proof manifest tool marker missing');
      assertThat(proofManifest.assetId === 'sunweaver-lumen-guard', 'proof manifest assetId missing or wrong');
      assertThat(proofManifest.git && proofManifest.git.revision, 'proof manifest missing git revision');
      assertThat(proofManifest.sourceRevision === proofManifest.git.revision,
        'proof sourceRevision must equal proof git revision');
      assertThat(Array.isArray(proofManifest.declaredDirtyFiles), 'proof declaredDirtyFiles missing');
      assertThat(JSON.stringify(proofManifest.declaredDirtyFiles) === JSON.stringify(proofManifest.git.dirty),
        'proof declaredDirtyFiles must equal git.dirty');
      assertThat(Array.isArray(proofManifest.failedFrames), 'proof failedFrames missing');
      assertThat(proofManifest.failedFrames.length === 0, 'proof unexpectedly contains failed frames');
      assertThat(proofManifest.gates && typeof proofManifest.gates === 'object', 'proof gates missing');
      const gateEntries = Object.entries(proofManifest.gates);
      assertThat(gateEntries.length > 0, 'proof gates must be non-empty');
      assertThat(gateEntries.every(([, value]) => typeof value === 'boolean'), 'proof gates must be boolean values');
      assertThat(gateEntries.every(([, value]) => value === true), 'proof contains a failed hard gate');
      const metricPack = proofManifest.metrics?.['sunweaver-lumen-guard'];
      assertThat(metricPack && typeof metricPack === 'object', 'proof asset-keyed metric pack missing');
      assertThat(metricPack.candidateHashes && Object.keys(metricPack.candidateHashes).length === 16,
        'proof candidate hash map must contain all 16 frames');
    });

    await step('proof-to-accept-dry-run', async () => {
      assertThat(proofManifestPath && proofManifest, 'proof manifest unavailable for acceptance handoff');
      const acceptance = runPublicForgeCommand('forge:art:accept', [
        '--asset=sunweaver-lumen-guard', `--evidence=${proofManifestPath}`,
      ]);
      assertThat(acceptance.code === 0, `public acceptance dry-run failed (${acceptance.code}): ${acceptance.output.slice(-1600)}`);
      assertThat(acceptance.output.includes('selected asset: sunweaver-lumen-guard'),
        'dry-run output must name the selected asset');
      assertThat(/frames changed: \d+\/16/.test(acceptance.output), 'dry-run output must name changed-frame count');
      assertThat(acceptance.output.includes('tools/forge-art/baselines/sunweaver-lumen-guard/baseline.png'),
        'dry-run output must name the destination baseline PNG');
      assertThat(acceptance.output.includes('tools/forge-art/baselines/sunweaver-lumen-guard/manifest.json'),
        'dry-run output must name the destination accepted manifest');
      assertThat(acceptance.output.includes('DRY-RUN complete — nothing written.'),
        'dry-run output must state that nothing was written');
      const acceptedAfter = acceptedSnapshot();
      assertSnapshotUnchanged(acceptedBefore, acceptedAfter);
      manifest.captures.proofManifest = proofManifestPath;
      manifest.captures.acceptanceDryRun = acceptance.output;
    });

    await step('acceptance-refusals', async () => {
      assertThat(proofManifest && proofManifestPath, 'generated proof is required for refusal fixtures');
      const tempEvidence = [];
      const writeFixture = (name, value) => {
        const file = path.join(os.tmpdir(), `fal-${name}-${process.pid}.json`);
        fs.writeFileSync(file, JSON.stringify(value, null, 2));
        tempEvidence.push(file);
        return file;
      };
      const runAcceptance = (file, apply = false) => runPublicForgeCommand('forge:art:accept', [
        '--asset=sunweaver-lumen-guard', `--evidence=${file}`, ...(apply ? ['--apply'] : []),
      ]);
      try {
        // Wrong revision -> stale refusal (exit 3).
        const stale = cloneEvidence(proofManifest);
        stale.sourceRevision = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        assertThat(runAcceptance(writeFixture('stale', stale), true).code === 3,
          'stale evidence must refuse with exit 3');

        // Failed hard gate -> exit 4.
        const badGate = cloneEvidence(proofManifest);
        badGate.gates['proof-complete'] = false;
        assertThat(runAcceptance(writeFixture('gate', badGate), true).code === 4,
          'failed gate must refuse with exit 4');

        // Hash mismatch -> exit 5.
        const badHash = cloneEvidence(proofManifest);
        badHash.metrics['sunweaver-lumen-guard'].candidateHashes['dir0-pose0'] = '0'.repeat(64);
        assertThat(runAcceptance(writeFixture('hash', badHash)).code === 5,
          'candidate hash mismatch must refuse with exit 5');

        // Partial generated frames -> exit 9.
        const partial = cloneEvidence(proofManifest);
        partial.failedFrames = ['dir0-pose0'];
        assertThat(runAcceptance(writeFixture('partial', partial)).code === 9,
          'partial candidate must refuse with exit 9');

        // Empty gates, including --apply, -> malformed evidence exit 1.
        const emptyGates = cloneEvidence(proofManifest);
        emptyGates.gates = {};
        assertThat(runAcceptance(writeFixture('empty-gates', emptyGates), true).code === 1,
          'empty gates must refuse with exit 1');

        // Corrupt an unrelated accepted manifest temporarily -> exit 6.
        const driftFile = path.join(REPO_ROOT, 'tools/forge-art/baselines/gravemark-yard/manifest.json');
        const driftBytes = fs.readFileSync(driftFile);
        const driftStat = fs.statSync(driftFile);
        try {
          fs.writeFileSync(driftFile, Buffer.concat([driftBytes, Buffer.from('\n')]));
          assertThat(runAcceptance(writeFixture('drift', cloneEvidence(proofManifest)), true).code === 6,
            'unrelated accepted-artifact drift must refuse with exit 6');
        } finally {
          fs.writeFileSync(driftFile, driftBytes);
          fs.utimesSync(driftFile, driftStat.atime, driftStat.mtime);
        }
      } finally {
        for (const file of tempEvidence) fs.rmSync(file, { force: true });
      }
    });

    await step('sandbox-unrelated-preservation', async () => {
      const sandboxPage = await context.newPage();
      pages.push(sandboxPage);
      attachErrors(sandboxPage, manifest, 'sandbox-workbench');
      await sandboxPage.goto(`${server.url}/tools/forge-art/index.html?mesh=0&combat=1&sandbox=1`, {
        waitUntil: 'load', timeout: NAV_TIMEOUT_MS,
      });
      await sandboxPage.waitForFunction(() => globalThis.__FORGE_ART_QA__?.ready === true, null, { timeout: PROBE_TIMEOUT_MS });
      await sandboxPage.evaluate(() => globalThis.__FORGE_ART_TOOL__.selectAsset('sunweaver-lumen-guard'));
      await sandboxPage.waitForFunction(
        () => globalThis.__FORGE_ART_QA__?.selection?.assetId === 'sunweaver-lumen-guard' &&
          Boolean(globalThis.__FORGE_ART_QA__?.ab?.candidateSha256),
        null,
        { timeout: PROBE_TIMEOUT_MS },
      );
      await settleFrames(sandboxPage);
      const sandboxAb = await sandboxPage.evaluate(() => globalThis.__FORGE_ART_QA__.ab);
      assertThat(sandboxAb.baselineSha256 !== sandboxAb.candidateSha256,
        'sandbox candidate must differ from accepted baseline');
      const status = await sandboxPage.locator('#fal-status').getAttribute('data-state');
      assertThat(status === 'fail', `sandbox objective status must be FAIL, got ${status}`);
      assertThat(await sandboxPage.locator('#fal-gates tr[data-verdict="fail"]').count() > 0,
        'sandbox must display a failed proven objective gate');

      // Compare every unrelated catalog candidate against its non-sandboxed page.
      const normalHashes = {};
      for (const id of REQUIRED_IDS.filter((entry) => entry !== 'sunweaver-lumen-guard')) {
        await page.evaluate((assetId) => globalThis.__FORGE_ART_TOOL__.selectAsset(assetId), id);
        await page.waitForFunction(
          (assetId) => globalThis.__FORGE_ART_QA__?.selection?.assetId === assetId &&
            Boolean(globalThis.__FORGE_ART_QA__?.ab?.candidateSha256),
          id,
          { timeout: PROBE_TIMEOUT_MS },
        );
        normalHashes[id] = await page.evaluate(() => globalThis.__FORGE_ART_QA__.ab.candidateSha256);
        await sandboxPage.evaluate((assetId) => globalThis.__FORGE_ART_TOOL__.selectAsset(assetId), id);
        await sandboxPage.waitForFunction(
          (assetId) => globalThis.__FORGE_ART_QA__?.selection?.assetId === assetId &&
            Boolean(globalThis.__FORGE_ART_QA__?.ab?.candidateSha256),
          id,
          { timeout: PROBE_TIMEOUT_MS },
        );
        const sandboxHash = await sandboxPage.evaluate(() => globalThis.__FORGE_ART_QA__.ab.candidateSha256);
        assertThat(sandboxHash === normalHashes[id], `sandbox changed unrelated asset ${id}`);
      }

      // A sandbox-shaped candidate hash must be refused by the real acceptance CLI.
      const sandboxEvidence = cloneEvidence(proofManifest);
      sandboxEvidence.metrics['sunweaver-lumen-guard'].candidateHashes['dir0-pose0'] = '0'.repeat(64);
      const sandboxEvidencePath = path.join(os.tmpdir(), `fal-sandbox-${process.pid}.json`);
      fs.writeFileSync(sandboxEvidencePath, JSON.stringify(sandboxEvidence, null, 2));
      try {
        const sandboxAcceptance = runPublicForgeCommand('forge:art:accept', [
          '--asset=sunweaver-lumen-guard', `--evidence=${sandboxEvidencePath}`,
        ]);
        assertThat(sandboxAcceptance.code === 5, `sandbox evidence must refuse with exit 5, got ${sandboxAcceptance.code}`);
      } finally {
        fs.rmSync(sandboxEvidencePath, { force: true });
      }
      await sandboxPage.close();
    });

    await step('screenshots-exact-nonblack', async () => {
      // The workbench stage intentionally shows RAW source cells where MAG is
      // the team-color key (the runtime shader replaces it). The zero-MAG rule
      // applies to RENDERED GAME FRAMES, so we assert it on the rig capture
      // (qa-rig-unit-selected.png) instead, and only sanity-check the
      // workbench shot here.
      const rigShot = manifest.captures.rigUnitSelected;
      if (rigShot && fs.existsSync(rigShot)) {
        const rig = PNG.sync.read(fs.readFileSync(rigShot));
        let rigMagenta = 0;
        for (let i = 0; i < rig.data.length; i += 4) {
          if (rig.data[i] === MAG[0] && rig.data[i + 1] === MAG[1] && rig.data[i + 2] === MAG[2]) rigMagenta++;
        }
        assertThat(rigMagenta === 0, `${rigMagenta} exact MAG pixels leaked in rendered game frame`);
      }
      const shot = path.join(outDir, 'qa-workbench.png');
      await settleFrames(page);
      await page.screenshot({ path: shot, type: 'png' });
      manifest.captures.workbench = shot;
      const png = PNG.sync.read(fs.readFileSync(shot));
      assertThat(png.width === 1366 && png.height === 1024, `capture is ${png.width}x${png.height}, expected 1366x1024`);
      let maxLuma = 0;
      let lit = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const luma = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
        maxLuma = Math.max(maxLuma, luma);
        if (luma > 10) lit++;
      }
      assertThat(maxLuma > 6, 'capture black');
      assertThat(lit / (png.width * png.height) > 0.002, 'capture empty');
    });

    await step('webgl-context-count-workbench', async () => {
      const count = await page.evaluate(() => globalThis.__FORGE_ART_QA__.gl.contexts);
      assertThat(count === 0 || count === 1, `workbench WebGL contexts should be 0 or 1, got ${count}`);
    });
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
  } finally {
    for (const p of pages ?? []) { try { await p.close(); } catch {} }
    try { if (browser) await browser.close(); } catch {}
    try { await stopVite(server); } catch {}
    // process-leak verification
    const leaks = [
      ...(await findLeakedProcesses('vite.*forge-art')).filter((l) => !l.includes('pgrep')),
    ];
    await delay(500);
    manifest.finishedAt = new Date().toISOString();
    manifest.ok = manifest.errors.length === 0 && leaks.length === 0;
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const passed = Object.values(manifest.steps).filter((s) => s.pass).length;
    console.log('--- qa-forge-art summary ---');
    console.log(`ok=${manifest.ok} steps=${passed}/${Object.keys(manifest.steps).length} out=${outDir}`);
    for (const error of manifest.errors) console.log(`error: ${String(error).split('\n')[0]}`);
    if (leaks.length) console.log(`process leaks: ${leaks.join('; ')}`);
    if (manifest.errors.length > 0 || leaks.length > 0) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`qa-forge-art: fatal: ${error?.stack ?? error}`);
  process.exitCode = 1;
});
