// FAL — baseline pipeline contract (FORGE_ART_LAB.md §5, §14, §16, §17; A7 FAL-QA-06/07/20).
// Pure tsx: manifest validation, PNG determinism (pngjs), sandbox unrelated-cell preservation.
// NO network, NO browser. Conventions: node:assert/strict, failures asserted empty at END.

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import * as schema from '../tools/forge-art/src/baseline-schema';
import * as registryModule from '../tools/forge-art/src/registry';
import * as adapterModule from '../tools/forge-art/src/adapters';

const failures: string[] = [];
const requireOk = (cond: boolean, msg: string): void => { if (!cond) failures.push(msg); };
const sha256 = (bytes: Uint8Array | Uint8ClampedArray): string => createHash('sha256').update(Buffer.from(bytes as Uint8Array)).digest('hex');

// ---- module surfaces ----
const registryAny = registryModule as unknown as Record<string, unknown>;
const entries = (registryAny.CATALOG ?? registryAny.catalog) as Array<{ assetId: string }> | undefined;
assert.ok(Array.isArray(entries), 'registry must export the public catalog (CATALOG)');
const adaptersAny = (adapterModule as unknown as Record<string, unknown>);
const getFrames = (adaptersAny.getFrames ?? (adaptersAny.adapters as Record<string, unknown> | undefined)?.getFrames) as
  (assetId: string, group?: string) => FrameSource[];
const getOverride = (adaptersAny.getSandboxOverride ?? (adaptersAny.adapters as Record<string, unknown> | undefined)?.getSandboxOverride) as
  (id: string) => unknown;
assert.equal(typeof getFrames, 'function', 'adapters.getFrames must exist');
assert.equal(typeof getOverride, 'function', 'adapters.getSandboxOverride must exist (§17)');

interface FrameSource { key: string; pix: { w: number; h: number; d: Uint8ClampedArray }; error?: string }

// ---- 1. baseline PNG determinism: pngjs PNG.sync.write twice -> byte-identical files; sha256 stable ----
{
  const cellW = 64;
  const cellH = 64;
  const cols = 8;
  const rows = 2;
  const grid = Buffer.alloc(cellW * cols * cellH * rows * 4);
  // deterministic synthetic pattern (row-strided like a real baseline grid)
  for (let c = 0; c < cols * rows; c++) {
    const ox = (c % cols) * cellW;
    const oy = Math.floor(c / cols) * cellH;
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const i = ((ox + x) + (oy + y) * cellW * cols) * 4;
        grid[i] = (c * 37 + x * 3 + y * 5) & 0xff;
        grid[i + 1] = (c * 53 + x * 7 + y * 11) & 0xff;
        grid[i + 2] = (c * 71 + x * 13 + y * 17) & 0xff;
        grid[i + 3] = (x + y + c) % 3 === 0 ? 255 : 0;
      }
    }
  }
  const png = new PNG({ width: cellW * cols, height: cellH * rows });
  png.data = grid;
  const write1 = PNG.sync.write(png);
  const write2 = PNG.sync.write(png);
  assert.ok(write1.equals(write2), 'PNG.sync.write must be deterministic (two writes of the same RGBA buffer byte-identical)');
  assert.equal(sha256(write1), sha256(write2), 'sha256 of the two writes must be stable');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-art-pipeline-'));
  try {
    const f1 = path.join(tmpDir, 'baseline-a.png');
    const f2 = path.join(tmpDir, 'baseline-b.png');
    fs.writeFileSync(f1, write1);
    fs.writeFileSync(f2, write2);
    const onDisk1 = fs.readFileSync(f1);
    const onDisk2 = fs.readFileSync(f2);
    assert.ok(onDisk1.equals(onDisk2), 'baseline PNG files on disk must be byte-identical');
    assert.equal(sha256(onDisk1), sha256(write1), 'file sha256 must match the in-memory write');
    console.log(`determinism: ${write1.length} bytes, sha256 ${sha256(write1).slice(0, 16)}… stable across two writes + disk round-trip`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---- 2. manifest validation (baseline-schema) ----
const schemaAny = schema as unknown as Record<string, unknown>;
const validateBaselineManifest = schemaAny.validateBaselineManifest as ((json: unknown, bytes?: Uint8Array) => string[]) | undefined;
const cellSha256FromBytes = schemaAny.cellSha256FromBytes as (u8: Uint8Array | Uint8ClampedArray) => string;
if (typeof validateBaselineManifest !== 'function') {
  failures.push('baseline-schema.validateBaselineManifest missing (contract §5 manifest validation)');
} else {
  assert.equal(typeof cellSha256FromBytes, 'function', 'baseline-schema.cellSha256FromBytes must exist (VS-4 byte-equivalent hashing)');

  // Build a REAL valid manifest from the lumen-guard candidate frames (§5 shape).
  const lumenFrames = getFrames('sunweaver-lumen-guard');
  assert.equal(lumenFrames.length, 16, 'lumen combat row must yield 16 frames');
  const cellW = lumenFrames[0].pix.w;
  const cellH = lumenFrames[0].pix.h;
  const cols = 8;
  const rows = 2;
  const grid = Buffer.alloc(cellW * cols * cellH * rows * 4);
  for (let i = 0; i < lumenFrames.length; i++) {
    const f = lumenFrames[i];
    const ox = (i % cols) * cellW;
    const oy = Math.floor(i / cols) * cellH;
    for (let y = 0; y < cellH; y++) {
      for (let x = 0; x < cellW; x++) {
        const src = (x + y * cellW) * 4;
        const dst = ((ox + x) + (oy + y) * cellW * cols) * 4;
        grid[dst] = f.pix.d[src];
        grid[dst + 1] = f.pix.d[src + 1];
        grid[dst + 2] = f.pix.d[src + 2];
        grid[dst + 3] = f.pix.d[src + 3];
      }
    }
  }
  const pngBytes = PNG.sync.write(new PNG({ width: cellW * cols, height: cellH * rows, data: grid } as unknown as ConstructorParameters<typeof PNG>[0]));

  const frameHashes = lumenFrames.map((f) => ({
    key: f.key,
    sha256: cellSha256FromBytes(f.pix.d),
    alphaPixels: Array.from(f.pix.d).filter((_, idx) => idx % 4 === 3 && f.pix.d[idx] > 0).length,
  }));

  const makeManifest = (overrides: Record<string, unknown>): Record<string, unknown> => ({
    schemaVersion: 1,
    assetId: 'sunweaver-lumen-guard',
    label: 'Lumen Guard',
    faction: 'sunweaver',
    category: 'unit',
    revision: 'test-rev-1',
    createdAt: new Date().toISOString(),
    source: { adapter: 'combat', dims: [cellW * cols, cellH * rows] },
    cellLayout: { cellW, cellH, cols, rows, order: 'dir-major' },
    anchor: { x: 32, y: 63 },
    worldScale: { x: 1.59, y: 1.89 },
    frames: frameHashes.map((f) => ({ ...f })),
    paletteStats: {},
    thresholdsUsed: {},
    gates: { allPassed: true },
    ...overrides,
  });

  const run = (m: Record<string, unknown>, bytes?: Uint8Array): string[] => {
    try {
      const res = validateBaselineManifest(m, bytes);
      return res ?? [];
    } catch (err) {
      return [(err as Error).message];
    }
  };

  const valid = makeManifest({});
  const validErrors = run(valid, pngBytes);
  requireOk(validErrors.length === 0, `valid manifest must pass with 0 errors (got ${JSON.stringify(validErrors)})`);

  const badSchema = run(makeManifest({ schemaVersion: 2 }), pngBytes);
  requireOk(badSchema.length > 0 && /version/i.test(badSchema.join(' ')),
    `schemaVersion corruption must produce a named error mentioning the version (got ${JSON.stringify(badSchema)})`);

  const badOrder = makeManifest({ frames: [...frameHashes.slice(8), ...frameHashes.slice(0, 8)].map((f) => ({ ...f })) });
  const orderErrors = run(badOrder, pngBytes);
  requireOk(orderErrors.length > 0 && /order|sequence|frame/i.test(orderErrors.join(' ')),
    `frame-order mismatch must produce a named error (got ${JSON.stringify(orderErrors)})`);

  const badDims = makeManifest({ cellLayout: { cellW: 32, cellH, cols, rows, order: 'dir-major' } });
  const dimErrors = run(badDims, pngBytes);
  requireOk(dimErrors.length > 0 && /dim|cell|width|size/i.test(dimErrors.join(' ')),
    `dims mismatch must produce a named error (got ${JSON.stringify(dimErrors)})`);

  const badHashFormat = makeManifest({});
  ((badHashFormat.frames as Array<{ sha256: string }>)[5]).sha256 = 'zzzz' + '0'.repeat(60);
  const hashFormatErrors = run(badHashFormat, pngBytes);
  requireOk(hashFormatErrors.length > 0 && /hash|sha/i.test(hashFormatErrors.join(' ')),
    `malformed frame sha256 must produce a named error (got ${JSON.stringify(hashFormatErrors)})`);

  // Content-level "hash mismatch vs provided bytes": baseline-schema validates structure only;
  // the bytes-vs-manifest refusal is CLI-owned (scripts/forge-art-*, FAL-BASELINE). The PURE
  // seam the CLI uses is cellSha256FromBytes — prove every manifest hash equals the hash of the
  // exact cell bytes it claims, and that a corrupted byte stream is detectable via the seam.
  for (const f of frameHashes) {
    const frame = lumenFrames.find((x) => x.key === f.key)!;
    requireOk(f.sha256 === sha256(frame.pix.d),
      `${f.key}: cellSha256FromBytes must equal the sha256 of the exact RGBA cell bytes (VS-4 byte-equivalence)`);
  }
  const corruptedCell = Buffer.from(lumenFrames[3].pix.d);
  corruptedCell[100] = (corruptedCell[100]! + 1) & 0xff;
  requireOk(cellSha256FromBytes(corruptedCell) !== frameHashes[3].sha256,
    'cellSha256FromBytes must detect a corrupted cell byte stream (the CLI hash-mismatch refusal seam)');

  console.log(`manifest validation: valid=0 errors; corrupt variants named: ${JSON.stringify({
    schema: badSchema, order: orderErrors, dims: dimErrors, hashFormat: hashFormatErrors,
  })}; content-vs-bytes hash refusal is CLI-owned (seam proven via cellSha256FromBytes)`);
}

// ---- 3. acceptance evidence shape (SKIP if FAL-BASELINE has not landed evidence types) ----
{
  const validateEvidence = schemaAny.validateEvidence as ((evidence: unknown) => { ok?: boolean; errors?: string[] } | string[]) | undefined;
  if (typeof validateEvidence !== 'function') {
    console.log('baseline-schema.validateEvidence: ABSENT — evidence-shape assertion SKIPPED (acceptance dry-run semantics are CLI-level, owned by FAL-BASELINE)');
  } else {
    const res = validateEvidence({});
    const errors = Array.isArray(res) ? res : (res?.errors ?? []);
    const ok = !Array.isArray(res) && res?.ok !== undefined ? res.ok : errors.length === 0;
    assert.equal(typeof ok, 'boolean', 'validateEvidence must return {ok: boolean, errors: string[]} (or string[])');
    assert.ok(Array.isArray(errors), 'validateEvidence errors must be an array');
    console.log(`validateEvidence shape contract present: returns {ok:${ok}, errors:[${errors.length}]}`);
  }
}

// ---- 4. unrelated-cell preservation under a scoped sandbox candidate (§11, §17, FAL-QA-07) ----
{
  const renderRun = (sandboxedLumen: boolean): Map<string, Array<{ key: string; sha: string; bytes: Buffer }>> => {
    const run = new Map<string, Array<{ key: string; sha: string; bytes: Buffer }>>();
    for (const entry of entries as Array<{ assetId: string }>) {
      let frames: FrameSource[] = getFrames(entry.assetId);
      if (sandboxedLumen && entry.assetId === 'sunweaver-lumen-guard') {
        const override = getOverride('sunweaver-lumen-guard');
        assert.ok(override != null, 'sandbox override required for sunweaver-lumen-guard');
        const transform = override as (p: FrameSource['pix']) => FrameSource['pix'];
        frames = frames.map((f) => ({ ...f, pix: transform(f.pix) }));
      }
      assert.ok(frames.length > 0, `${entry.assetId}: candidate must produce frames`);
      run.set(entry.assetId, frames.map((f) => ({ key: f.key, sha: sha256(f.pix.d), bytes: Buffer.from(f.pix.d) })));
    }
    return run;
  };

  const base = renderRun(false);
  const sandboxed = renderRun(true);
  const OTHER_IDS = entries.map((e) => e.assetId).filter((id) => id !== 'sunweaver-lumen-guard');
  assert.equal(OTHER_IDS.length, 13, 'exactly 13 non-sandboxed assets expected');

  let lumenChangedFrames = 0;
  const baseLumen = base.get('sunweaver-lumen-guard')!;
  const sandLumen = sandboxed.get('sunweaver-lumen-guard')!;
  assert.equal(baseLumen.length, sandLumen.length, 'sandbox must not change the lumen frame count');
  for (let i = 0; i < baseLumen.length; i++) {
    if (baseLumen[i].sha !== sandLumen[i].sha) lumenChangedFrames++;
  }
  requireOk(lumenChangedFrames >= 1,
    `sandbox must change at least one lumen-guard frame (changed ${lumenChangedFrames}/16)`);

  for (const id of OTHER_IDS) {
    const a = base.get(id)!;
    const b = sandboxed.get(id)!;
    requireOk(a.length === b.length, `${id}: frame count must be unchanged under sandbox`);
    for (let i = 0; i < a.length; i++) {
      const sameBytes = a[i].bytes.equals(b[i].bytes);
      requireOk(a[i].key === b[i].key && sameBytes,
        `${id}: frame ${a[i].key} must be byte-identical under the lumen-only sandbox (sha ${a[i].sha.slice(0, 12)}… vs ${b[i].sha.slice(0, 12)}…)`);
    }
  }
  const totalOtherFrames = [...sandboxed.values()].filter((_, i) => i !== 0).reduce((n, f) => n + f.length, 0);
  console.log(`unrelated-cell preservation: lumen changed ${lumenChangedFrames}/16 frames; all ${totalOtherFrames} frames across the other 13 assets byte-identical`);
}

// ---- summary ----
console.log(`pipeline failures: ${JSON.stringify(failures)}`);
assert.equal(failures.length, 0, `FAL pipeline contract RED: ${failures.join('; ')}`);
console.log('FAL pipeline contract: PASS');
