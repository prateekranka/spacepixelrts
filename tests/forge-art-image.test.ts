// FAL-IMAGE — image-backed candidate pipeline contract
// (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md).
//
// Pure tsx: candidate manifest v1 validator, status mapping, disk loader
// (manifest + sheet cells + reference info), Builder-2 generated-source seam
// (explicit missing), and the public forge:art:import CLI (refusals +
// idempotent happy path). NO network, NO browser.
//
// RED-GREEN note: every behavior below was added with its failing test first;
// the happy path proves "PNG must work" end-to-end using a deterministic
// pipeline fixture at the real generated-source path (Builder 2's module is
// absent at the audited base commit a644057). The fixture is removed in
// cleanup and never committed.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import * as schema from '../tools/forge-art/src/candidate-schema';
import * as disk from '../tools/forge-art/src/candidate-disk';
import * as seam from '../tools/forge-art/src/candidate-source';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const ASSET = 'sunweaver-lumen-guard';
const COMMITTED_REFERENCE = path.join(REPO_ROOT, 'tools/forge-art/candidates', ASSET, 'reference.png');
const GENERATED_PATH = path.join(REPO_ROOT, 'src', 'generated', `${ASSET}-candidate.ts`);
const CANDIDATE_DIR = path.join(REPO_ROOT, 'tools', 'forge-art', 'candidates', ASSET);
const COMMITTED_REF_SHA = '1832b400a6291f8887697203d1a8968fe9b4211844feec9b352fe75b5e89943c';

const failures: string[] = [];
const requireOk = (cond: boolean, msg: string): void => { if (!cond) failures.push(msg); };
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const dirMajorKeys = (): string[] => {
  const keys: string[] = [];
  for (let p = 0; p < 2; p++) for (let d = 0; d < 8; d++) keys.push(`dir${d}-pose${p}`);
  return keys;
};

// Deterministic pipeline fixture cell (NOT a sprite — pipeline exercise data).
function fixtureCell(key: string, seed: number): seam.GeneratedCandidateCell {
  const bytes = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (x + y * 64) * 4;
      bytes[i] = (seed + x * 3 + y * 5) & 0xff;
      bytes[i + 1] = (seed * 2 + x * 7 + y * 11) & 0xff;
      bytes[i + 2] = (seed * 3 + x * 13 + y * 17) & 0xff;
      bytes[i + 3] = (x + y + seed) % 3 === 0 ? 255 : 0;
    }
  }
  return { key, width: 64, height: 64, bytes };
}

function fixtureCells(): seam.GeneratedCandidateCell[] {
  return dirMajorKeys().map((key, i) => fixtureCell(key, i * 37 + 11));
}

function fixtureModuleSource(cellCount = 16): string {
  const keys = dirMajorKeys().slice(0, cellCount);
  const lines = keys.map((key, i) => `  cell('${key}', ${i * 37 + 11}),`);
  return `// FAL-IMAGE test fixture — deterministic pipeline data, never committed.
export const assetId = '${ASSET}';
export const algorithm = 'combat-reference-v1';
function cell(key, seed) {
  const bytes = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (x + y * 64) * 4;
    bytes[i] = (seed + x * 3 + y * 5) & 0xff;
    bytes[i + 1] = (seed * 2 + x * 7 + y * 11) & 0xff;
    bytes[i + 2] = (seed * 3 + x * 13 + y * 17) & 0xff;
    bytes[i + 3] = (x + y + seed) % 3 === 0 ? 255 : 0;
  }
  return { key, width: 64, height: 64, bytes };
}
export const cells = [
${lines.join('\n')}
];
`;
}

function validManifestJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const cells = fixtureCells();
  const base: Record<string, unknown> = {
    schemaVersion: 1,
    assetId: ASSET,
    label: 'Lumen Guard',
    civilization: 'sunweaver',
    category: 'unit',
    adapter: 'combat',
    sourceKind: 'reference-image',
    sourcePath: `tools/forge-art/candidates/${ASSET}/reference.png`,
    sourceSha256: COMMITTED_REF_SHA,
    sourceWidth: 1389,
    sourceHeight: 1132,
    candidatePath: `tools/forge-art/candidates/${ASSET}/candidate.png`,
    candidateSourcePath: `src/generated/${ASSET}-candidate.ts`,
    generatedAt: '2026-08-27T00:00:00.000Z',
    algorithm: 'combat-reference-v1',
    status: 'draft',
    target: { cellW: 64, cellH: 64, cols: 8, rows: 2, order: 'dir-major', frameCount: 16 },
    directions: { authored: [0, 1, 2, 6, 7], mirrored: [3, 4, 5] },
    poses: { count: 2, names: ['primary', 'alternate'] },
    frames: cells.map((cell) => ({
      key: cell.key,
      sha256: sha256(cell.bytes),
      width: 64,
      height: 64,
      alphaPixels: 64 * 64 * 4 / 4 / 3,
    })),
    ...overrides,
  };
  return base;
}

function runCli(args: string[]): { code: number; output: string } {
  try {
    const output = execFileSync('npm', ['run', 'forge:art:import', '--', ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000,
    });
    return { code: 0, output };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function cellHashesFromPng(pngPath: string): string[] {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  assert.equal(png.width, 512, 'candidate.png must be 512 wide');
  assert.equal(png.height, 128, 'candidate.png must be 128 tall');
  const hashes: string[] = [];
  for (let index = 0; index < 16; index++) {
    const col = index % 8;
    const row = Math.floor(index / 8);
    const bytes = Buffer.alloc(64 * 64 * 4);
    for (let y = 0; y < 64; y++) {
      const srcStart = (col * 64 + (row * 64 + y) * png.width) * 4;
      png.data.copy(bytes, y * 64 * 4, srcStart, srcStart + 64 * 4);
    }
    hashes.push(sha256(bytes));
  }
  return hashes;
}

// ---- A. module surfaces ----
assert.equal(typeof schema.validateCandidateManifest, 'function', 'candidate-schema.validateCandidateManifest must exist');
assert.equal(typeof schema.candidateStatusFor, 'function', 'candidate-schema.candidateStatusFor must exist');
assert.equal(typeof disk.loadCandidateManifestFromDisk, 'function', 'candidate-disk.loadCandidateManifestFromDisk must exist');
assert.equal(typeof disk.loadCandidateSheetFromDisk, 'function', 'candidate-disk.loadCandidateSheetFromDisk must exist');
assert.equal(typeof disk.referenceInfoFromDisk, 'function', 'candidate-disk.referenceInfoFromDisk must exist');
assert.equal(typeof seam.loadGeneratedCandidateSource, 'function', 'candidate-source.loadGeneratedCandidateSource must exist');
assert.equal(typeof seam.generatedCandidateSourcePath, 'function', 'candidate-source.generatedCandidateSourcePath must exist');
assert.ok(COMMITTED_REF_SHA.length === 64, 'test constant: committed reference sha constant');

// ---- B. validator: valid + named corrupt variants ----
{
  const run = (m: Record<string, unknown>): string[] => {
    try {
      return schema.validateCandidateManifest(m);
    } catch (err) {
      return [(err as Error).message];
    }
  };
  const valid = run(validManifestJson());
  requireOk(valid.length === 0, `valid candidate manifest must pass (got ${JSON.stringify(valid)})`);

  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ['schemaVersion', { schemaVersion: 2 }, /schemaVersion/],
    ['category', { category: 'structure' }, /category/],
    ['sourceKind', { sourceKind: 'photo' }, /sourceKind/],
    ['adapter', { adapter: 'worker8' }, /adapter/],
    ['civilization', { civilization: 'gravemark' }, /civilization/],
    ['status', { status: 'accepted' }, /status/],
    ['algorithm', { algorithm: 'other-v1' }, /algorithm/],
    ['target cellW', { target: { cellW: 32, cellH: 64, cols: 8, rows: 2, order: 'dir-major', frameCount: 16 } }, /target|cells/],
    ['target order', { target: { cellW: 64, cellH: 64, cols: 8, rows: 2, order: 'grid', frameCount: 16 } }, /order/],
    ['target frameCount', { target: { cellW: 64, cellH: 64, cols: 8, rows: 2, order: 'dir-major', frameCount: 15 } }, /frameCount/],
    ['directions authored', { directions: { authored: [0, 1, 2], mirrored: [3, 4, 5] } }, /authored/],
    ['directions mirrored', { directions: { authored: [0, 1, 2, 6, 7], mirrored: [3, 4] } }, /mirrored/],
    ['poses', { poses: { count: 1, names: ['primary'] } }, /poses/],
    ['frame order', { frames: [...dirMajorKeys().slice(8), ...dirMajorKeys().slice(0, 8)].map((key, i) => ({ key, sha256: '0'.repeat(64), width: 64, height: 64, alphaPixels: 0 })) }, /dir-major|order/],
    ['frame sha', (() => { const m = validManifestJson(); (m.frames as Array<{ sha256: string }>)[3].sha256 = 'zz'; return m; })(), /sha256/],
    ['frame dims', (() => { const m = validManifestJson(); (m.frames as Array<{ width: number }>)[0].width = 32; return m; })(), /width|height/],
    ['frame alpha', (() => { const m = validManifestJson(); (m.frames as Array<{ alphaPixels: number }>)[0].alphaPixels = -1; return m; })(), /alphaPixels/],
    ['sourcePath traversal', { sourcePath: '../escape.png' }, /repository-relative/],
    ['sourceSha', { sourceSha256: 'nope' }, /sourceSha256/],
    ['generatedAt', { generatedAt: 'yesterday' }, /ISO-8601/],
    ['unknown asset generic', { assetId: 'bogus-nope' }, /public catalog|kebab|non-empty/],
  ];
  for (const [name, mutated, pattern] of cases) {
    const errors = run(validManifestJson(mutated));
    requireOk(errors.length > 0 && pattern.test(errors.join(' ')),
      `${name}: must produce a named error matching ${pattern} (got ${JSON.stringify(errors)})`);
  }
  console.log(`validator: valid=0 errors; ${cases.length} named corrupt variants; registry cross-checks enforced`);
}

// ---- C. candidate status mapping ----
{
  const manifest = validManifestJson() as unknown as schema.ForgeArtCandidateManifest;
  assert.equal(schema.candidateStatusFor(null, false), 'NO CANDIDATE');
  assert.equal(schema.candidateStatusFor(undefined, true), 'NO CANDIDATE');
  assert.equal(schema.candidateStatusFor(manifest, false), 'DRAFT');
  assert.equal(schema.candidateStatusFor(manifest, true), 'READY FOR REVIEW');
  assert.equal(schema.candidateStatusFor({ ...manifest, status: 'approved' }, false), 'APPROVED');
  console.log('status mapping: NO CANDIDATE / DRAFT / READY FOR REVIEW / APPROVED');
}

// ---- D. disk loader (temp root fixtures) ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fal-image-disk-'));
  try {
    const dir = path.join(tmp, 'tools', 'forge-art', 'candidates', ASSET);
    fs.mkdirSync(dir, { recursive: true });

    const missing = disk.loadCandidateManifestFromDisk(ASSET, tmp);
    assert.ok('missing' in missing, 'no manifest on disk must report missing');

    const manifestJson = validManifestJson();
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifestJson, null, 2));

    const loaded = disk.loadCandidateManifestFromDisk(ASSET, tmp);
    requireOk('manifest' in loaded, 'valid fixture manifest must load');
    if ('manifest' in loaded) {
      assert.equal(loaded.manifest.assetId, ASSET);
      assert.equal(loaded.manifest.frames.length, 16);
    }

    const corrupt = JSON.parse(JSON.stringify(manifestJson)) as Record<string, unknown>;
    (corrupt.frames as Array<{ key: string }>)[0].key = 'dir9-pose0';
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(corrupt, null, 2));
    const invalid = disk.loadCandidateManifestFromDisk(ASSET, tmp);
    requireOk('error' in invalid, 'corrupt manifest must report a named validation error');
    if ('error' in invalid) requireOk(/dir-major|order|key/.test(invalid.error), `corrupt manifest error must be named (${invalid.error})`);

    // sheet loader: valid sheet -> cells + verified hashes
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(validManifestJson(), null, 2));
    const cells = fixtureCells();
    const png = new PNG({ width: 512, height: 128 });
    png.data.fill(0);
    cells.forEach((cell, index) => {
      const col = index % 8;
      const row = Math.floor(index / 8);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const si = (x + y * 64) * 4;
          const di = (col * 64 + x + (row * 64 + y) * 512) * 4;
          png.data[di] = cell.bytes[si];
          png.data[di + 1] = cell.bytes[si + 1];
          png.data[di + 2] = cell.bytes[si + 2];
          png.data[di + 3] = cell.bytes[si + 3];
        }
      }
    });
    fs.writeFileSync(path.join(dir, 'candidate.png'), PNG.sync.write(png));
    const sheet = disk.loadCandidateSheetFromDisk(ASSET, tmp);
    requireOk('cells' in sheet, 'valid fixture sheet must load');
    if ('cells' in sheet) {
      requireOk(sheet.cells.length === 16 && sheet.width === 512 && sheet.height === 128, 'sheet must expose 16 cells at 512x128');
      requireOk(sheet.cells.every((c, i) => c.key === cells[i].key && sha256(c.bytes) === sha256(cells[i].bytes)),
        'sheet cells must match the fixture bytes in dir-major order');
    }

    // tampered sheet cell -> hash mismatch (disk authority)
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(validManifestJson(), null, 2));
    const tampered = PNG.sync.read(fs.readFileSync(path.join(dir, 'candidate.png')));
    tampered.data[100] = (tampered.data[100]! + 1) & 0xff;
    fs.writeFileSync(path.join(dir, 'candidate.png'), PNG.sync.write(tampered));
    const bad = disk.loadCandidateSheetFromDisk(ASSET, tmp);
    requireOk('error' in bad && /hash mismatch/.test(bad.error),
      `tampered sheet must report disk-authority hash mismatch (got ${'error' in bad ? bad.error : 'loaded'})`);

    // reference info
    const ref = disk.referenceInfoFromDisk(ASSET, tmp);
    requireOk('missing' in ref, 'absent reference.png must report missing');
    fs.copyFileSync(COMMITTED_REFERENCE, path.join(dir, 'reference.png'));
    const refInfo = disk.referenceInfoFromDisk(ASSET, tmp);
    requireOk('sha256' in refInfo && refInfo.sha256 === COMMITTED_REF_SHA && refInfo.width === 1389 && refInfo.height === 1132,
      'reference info must expose the committed sha256 + dims');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('disk loader: missing/valid/corrupt/tampered/reference-info all named');
}

// ---- E. Builder-2 generated-source seam ----
{
  const rel = seam.generatedCandidateSourcePath(ASSET);
  assert.equal(rel, `src/generated/${ASSET}-candidate.ts`, 'combat asset must resolve the generated source path');
  assert.equal(seam.generatedCandidateSourcePath('sunweaver-core'), null, 'building assets have no generated source');

  const unsupported = await seam.loadGeneratedCandidateSource('sunweaver-core');
  requireOk(!unsupported.present && unsupported.reason === 'unsupported-category' && /combat reference images only/.test(unsupported.message),
    'non-combat seam must refuse with the combat-only note');

  const missingPath = `${path.dirname(seam.generatedCandidateSourcePath(ASSET)!)}/.missing-lumen-guard-candidate.ts`;
  const missing = await seam.loadGeneratedCandidateSource(ASSET, missingPath);
  requireOk(!missing.present && missing.reason === 'missing-module', 'absent generated module must be reported explicitly');
  requireOk(missing.present === false && missing.sourcePath === missingPath,
    `missing-module seam must name the exact path (${missing.sourcePath})`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fal-image-seam-'));
  try {
    const validPath = path.join(tmp, 'valid-candidate.ts');
    fs.writeFileSync(validPath, fixtureModuleSource());
    const loaded = await seam.loadGeneratedCandidateSource(ASSET, validPath);
    requireOk(loaded.present && loaded.module.cells.length === 16, 'valid fixture module must load 16 cells');
    if (loaded.present) {
      requireOk(loaded.module.cells.every((c, i) => c.key === dirMajorKeys()[i]), 'fixture cells must be dir-major ordered');
    }

    const malformedPath = path.join(tmp, 'malformed-candidate.ts');
    fs.writeFileSync(malformedPath, fixtureModuleSource(8));
    let threw = false;
    try {
      await seam.loadGeneratedCandidateSource(ASSET, malformedPath);
    } catch (err) {
      threw = true;
      requireOk(/malformed/.test((err as Error).message) && /exactly 16/.test((err as Error).message),
        `malformed module must throw named shape errors (${(err as Error).message})`);
    }
    requireOk(threw, 'malformed generated module must throw');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('seam: unsupported-category + missing-module explicit + valid fixture + malformed named');
}

// ---- F. CLI refusals (subprocess) ----
{
  const usage = runCli([]);
  requireOk(usage.code === 2 && /usage/.test(usage.output), `no args must exit 2 (got ${usage.code})`);

  const unknown = runCli(['--asset=bogus-nope', `--reference=${COMMITTED_REFERENCE}`]);
  requireOk(unknown.code === 8, `unknown asset must exit 8 (got ${unknown.code})`);

  const building = runCli(['--asset=sunweaver-core', `--reference=${COMMITTED_REFERENCE}`]);
  requireOk(building.code === 1 && /combat reference images only/.test(building.output),
    `non-combat asset must refuse with the combat-only note (code ${building.code})`);

  const missingFile = runCli(['--asset=sunweaver-lumen-guard', '--reference=/tmp/definitely-missing-fal.png']);
  requireOk(missingFile.code === 1 && /not found/.test(missingFile.output), `missing reference must exit 1 (got ${missingFile.code})`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fal-image-cli-'));
  try {
    const webpPath = path.join(tmp, 'ref.webp');
    fs.writeFileSync(webpPath, Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)]));
    const webp = runCli(['--asset=sunweaver-lumen-guard', `--reference=${webpPath}`]);
    requireOk(webp.code === 1 && /[Ww]ebP/.test(webp.output), `WebP reference must be refused explicitly (code ${webp.code})`);

    const corruptPath = path.join(tmp, 'corrupt.png');
    fs.writeFileSync(corruptPath, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]));
    const corrupt = runCli(['--asset=sunweaver-lumen-guard', `--reference=${corruptPath}`]);
    requireOk(corrupt.code === 1 && /malformed PNG/i.test(corrupt.output), `corrupt PNG must exit 1 (got ${corrupt.code})`);

    const nonPng = path.join(tmp, 'not-png.png');
    fs.writeFileSync(nonPng, Buffer.from('this is definitely not a png file'));
    const badSig = runCli(['--asset=sunweaver-lumen-guard', `--reference=${nonPng}`]);
    requireOk(badSig.code === 1 && /signature/.test(badSig.output), `non-PNG bytes must exit 1 (got ${badSig.code})`);

    // Valid committed PNG but Builder 2's generated module is absent -> explicit partial refusal.
    // Temporarily move the real module. The test must never destroy the committed
    // candidate source while it proves the missing-module branch.
    const generatedBackup = `${GENERATED_PATH}.fal-image-missing-backup`;
    const movedGenerated = fs.existsSync(GENERATED_PATH);
    if (movedGenerated) fs.renameSync(GENERATED_PATH, generatedBackup);
    try {
      const before = fs.existsSync(path.join(CANDIDATE_DIR, 'candidate.png'));
      const missingModule = runCli(['--asset=sunweaver-lumen-guard', `--reference=${COMMITTED_REFERENCE}`]);
      requireOk(missingModule.code === 9 && /generated candidate source missing/.test(missingModule.output),
        `missing generated module must exit 9 with the explicit path (code ${missingModule.code})`);
      requireOk(fs.existsSync(path.join(CANDIDATE_DIR, 'candidate.png')) === before,
        'refused import must not write candidate.png');
    } finally {
      if (movedGenerated) fs.renameSync(generatedBackup, GENERATED_PATH);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('CLI refusals: usage 2 · unknown 8 · non-combat 1 · missing 1 · WebP 1 · corrupt 1 · partial 9');
}

// ---- G. CLI happy path + idempotency (fixture at the real generated path) ----
{
  const refBefore = fs.readFileSync(COMMITTED_REFERENCE);
  const generatedExisted = fs.existsSync(GENERATED_PATH);
  const candidatePath = path.join(CANDIDATE_DIR, 'candidate.png');
  const manifestPath = path.join(CANDIDATE_DIR, 'manifest.json');
  const candidateExisted = fs.existsSync(candidatePath);
  const manifestExisted = fs.existsSync(manifestPath);
  const generatedBefore = generatedExisted ? fs.readFileSync(GENERATED_PATH) : null;
  const candidateBefore = candidateExisted ? fs.readFileSync(candidatePath) : null;
  const manifestBefore = manifestExisted ? fs.readFileSync(manifestPath) : null;
  try {
    fs.mkdirSync(path.dirname(GENERATED_PATH), { recursive: true });
    fs.writeFileSync(GENERATED_PATH, fixtureModuleSource());

    const first = runCli(['--asset=sunweaver-lumen-guard', `--reference=${COMMITTED_REFERENCE}`]);
    requireOk(first.code === 0, `happy-path import must exit 0 (got ${first.code}): ${first.output.slice(-800)}`);
    requireOk(/imported sunweaver-lumen-guard/.test(first.output), 'import must print the imported asset');

    const manifest = JSON.parse(fs.readFileSync(path.join(CANDIDATE_DIR, 'manifest.json'), 'utf8')) as Record<string, unknown>;
    requireOk(schema.validateCandidateManifest(manifest).length === 0, 'written manifest must pass schema v1');
    requireOk(manifest.status === 'draft' && manifest.algorithm === 'combat-reference-v1', 'manifest must be draft combat-reference-v1');
    requireOk(manifest.sourceKind === 'reference-image' && manifest.category === 'unit', 'manifest must be reference-image unit');
    requireOk(manifest.sourceSha256 === COMMITTED_REF_SHA, 'manifest sourceSha256 must equal the committed reference');
    requireOk(manifest.sourceWidth === 1389 && manifest.sourceHeight === 1132, 'manifest source dims must be 1389x1132');
    requireOk(manifest.candidateSourcePath === `src/generated/${ASSET}-candidate.ts`, 'manifest must name the generated source path');
    requireOk((manifest.directions as { authored: number[] }).authored.join() === '0,1,2,6,7', 'authored dirs must be 0,1,2,6,7');
    requireOk((manifest.directions as { mirrored: number[] }).mirrored.join() === '3,4,5', 'mirrored dirs must be 3,4,5');

    // Disk authority: candidate.png cells == manifest frame hashes.
    const diskHashes = cellHashesFromPng(path.join(CANDIDATE_DIR, 'candidate.png'));
    const manifestHashes = (manifest.frames as Array<{ key: string; sha256: string }>).map((f) => f.sha256);
    requireOk(diskHashes.every((h, i) => h === manifestHashes[i]), 'candidate.png cell hashes must equal manifest frame hashes');
    const frameKeys = (manifest.frames as Array<{ key: string }>).map((f) => f.key);
    requireOk(frameKeys.join() === dirMajorKeys().join(), 'manifest frame keys must be dir-major order');
    requireOk(fs.readFileSync(COMMITTED_REFERENCE).equals(refBefore), 'import must not modify the committed reference bytes');
    requireOk(sha256(fs.readFileSync(path.join(CANDIDATE_DIR, 'reference.png'))) === COMMITTED_REF_SHA, 'copied reference must match committed hash');

    // Loader round-trip on the real repo state.
    const diskLoad = disk.loadCandidateManifestFromDisk(ASSET);
    requireOk('manifest' in diskLoad, 'repo manifest must load via the disk loader');
    const sheetLoad = disk.loadCandidateSheetFromDisk(ASSET);
    requireOk('cells' in sheetLoad && sheetLoad.cells.length === 16, 'repo sheet must load 16 verified cells');

    // Idempotency: second run writes nothing and reports unchanged.
    const manifestBytes = fs.readFileSync(path.join(CANDIDATE_DIR, 'manifest.json'));
    const candidateBytes = fs.readFileSync(path.join(CANDIDATE_DIR, 'candidate.png'));
    const second = runCli(['--asset=sunweaver-lumen-guard', `--reference=${COMMITTED_REFERENCE}`]);
    requireOk(second.code === 0 && /unchanged \(already imported\)/.test(second.output),
      `second import must be idempotent (code ${second.code}): ${second.output.slice(-400)}`);
    requireOk(fs.readFileSync(path.join(CANDIDATE_DIR, 'manifest.json')).equals(manifestBytes), 'idempotent import must not rewrite manifest');
    requireOk(fs.readFileSync(path.join(CANDIDATE_DIR, 'candidate.png')).equals(candidateBytes), 'idempotent import must not rewrite candidate.png');
  } finally {
    if (generatedExisted && generatedBefore) fs.writeFileSync(GENERATED_PATH, generatedBefore);
    else fs.rmSync(GENERATED_PATH, { force: true });
    if (candidateExisted && candidateBefore) fs.writeFileSync(candidatePath, candidateBefore);
    else fs.rmSync(candidatePath, { force: true });
    if (manifestExisted && manifestBefore) fs.writeFileSync(manifestPath, manifestBefore);
    else fs.rmSync(manifestPath, { force: true });
  }
  requireOk(fs.existsSync(GENERATED_PATH) === generatedExisted, 'cleanup must restore generated candidate source state');
  requireOk(fs.existsSync(candidatePath) === candidateExisted, 'cleanup must restore candidate.png state');
  requireOk(fs.existsSync(manifestPath) === manifestExisted, 'cleanup must restore manifest.json state');
  if (generatedExisted && generatedBefore) requireOk(fs.readFileSync(GENERATED_PATH).equals(generatedBefore), 'generated source must be byte-identical after cleanup');
  if (candidateExisted && candidateBefore) requireOk(fs.readFileSync(candidatePath).equals(candidateBefore), 'candidate.png must be byte-identical after cleanup');
  if (manifestExisted && manifestBefore) requireOk(fs.readFileSync(manifestPath).equals(manifestBefore), 'manifest.json must be byte-identical after cleanup');
  requireOk(sha256(fs.readFileSync(COMMITTED_REFERENCE)) === COMMITTED_REF_SHA, 'committed reference must be byte-identical after cleanup');
  console.log('CLI happy path: PNG import + atomic writes + hash verification + idempotency + cleanup');
}

// ---- summary ----
console.log(`image failures: ${JSON.stringify(failures)}`);
assert.equal(failures.length, 0, `FAL-IMAGE contract RED: ${failures.join('; ')}`);
console.log('FAL-IMAGE candidate pipeline contract: PASS');
