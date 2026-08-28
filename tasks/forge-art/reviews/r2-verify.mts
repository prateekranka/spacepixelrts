// R2 independent verification (reviewer's own code, no tool function reuse for hashing/extraction)
import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { drawCombatSprite } from '../../../src/sprites';
import * as metrics from '../../../tools/forge-art/src/metrics';

const sha = (b: Uint8Array | Uint8ClampedArray) => createHash('sha256').update(Buffer.from(b as Uint8Array)).digest('hex');

// ---------- Task 2: 3 spot digests, independent node:crypto ----------
const FROZEN: Record<string, string> = {
  '0:3:1': 'b46c042dc3b8ca4bdb3afdeb220e26735b7759e6d1ff56beec941c9c8f236b67',
  '3:6:0': 'ca0322156cb71e94756b3b2b4e2f840e8f8c55d5d831de6b846c2308e7709c45',
  '1:0:1': '2bc28f9b0ef9a9f8609899270d8f34031809a3d21bd378ab61afa930cc0dd0a4',
};
console.log('=== TASK 2: spot digests (independent node:crypto over drawCombatSprite RGBA stream) ===');
for (const [key, frozen] of Object.entries(FROZEN)) {
  const [row, dir, pose] = key.split(':').map(Number);
  const p = drawCombatSprite(row, dir, pose);
  const mine = sha(p.d);
  const lib = metrics.imageSha256(metrics.pixView(p));
  const ok = mine === frozen && lib === frozen;
  console.log(`row${row} dir${dir} pose${pose}: mine=${mine} frozen=${frozen} lib=${lib} ${ok ? 'MATCH' : '*** MISMATCH ***'}`);
  if (!ok) process.exitCode = 1;
}

// ---------- Task 3: mirror pairs, manual reversal vs metrics.isMirrorPair ----------
console.log('\n=== TASK 3: mirror pairs all 4 rows x 2 poses ===');
function manualFlipX(p: { w: number; h: number; d: Uint8ClampedArray }): Uint8ClampedArray {
  const out = new Uint8ClampedArray(p.d.length);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const si = (x + y * p.w) * 4;
      const di = (p.w - 1 - x + y * p.w) * 4;
      out[di] = p.d[si]; out[di + 1] = p.d[si + 1]; out[di + 2] = p.d[si + 2]; out[di + 3] = p.d[si + 3];
    }
  }
  return out;
}
const pairs: Array<[number, number]> = [[1, 3], [0, 4], [7, 5], [2, 6]];
let pairFails = 0;
for (let row = 0; row < 4; row++) {
  for (const [a, b] of pairs) {
    for (let pose = 0; pose < 2; pose++) {
      const pa = drawCombatSprite(row, a, pose);
      const pb = drawCombatSprite(row, b, pose);
      const manual = manualFlipX(pa);
      const manualOk = Buffer.from(manual).equals(Buffer.from(pb.d));
      const libOk = metrics.isMirrorPair(metrics.pixView(pa), metrics.pixView(pb));
      // extra: is dir a itself symmetric (flip == original)?
      const selfSym = Buffer.from(manual).equals(Buffer.from(pa.d));
      const same = Buffer.from(pa.d).equals(Buffer.from(pb.d));
      if (!manualOk || !libOk) { pairFails++; console.log(`row${row} dir${a}/${b} pose${pose}: manual=${manualOk} isMirrorPair=${libOk} selfSym=${selfSym} identicalBytes=${same} ***`); }
      else if (a === 2) console.log(`row${row} dir2/dir6 pose${pose}: MATCH (manual+lib agree); dir2 selfSym=${selfSym}, dir2==dir6 bytes=${same}`);
    }
  }
}
console.log(`mirror pairs: ${pairFails === 0 ? 'ALL AGREE (manual reversal == isMirrorPair)' : pairFails + ' FAILURES'}`);

// ---------- Task 4: baseline artifacts, own extraction ----------
console.log('\n=== TASK 4: baseline.png cell regions vs manifest frame sha256 ===');
const ASSETS = ['sunweaver-lumen-guard', 'gravemark-worker', 'sunweaver-core'];
const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tools/forge-art/baselines/registry.json'), 'utf8'));
for (const id of ASSETS) {
  const dir = path.join(process.cwd(), 'tools/forge-art/baselines', id);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, 'baseline.png')));
  // per-asset cell geometry: combat 64x64, worker 32x48, scout 128, core 64, habitat/yard 32
  const CELL: Record<string, [number, number]> = {
    'sunweaver-lumen-guard': [64, 64], 'sunweaver-solar-strider': [64, 64],
    'gravemark-rift-guard': [64, 64], 'gravemark-burden-walker': [64, 64],
    'sunweaver-worker': [32, 48], 'gravemark-worker': [32, 48],
    'sunweaver-wind-strider': [128, 128], 'gravemark-grav-skimmer': [128, 128],
    'sunweaver-core': [64, 64], 'gravemark-core': [64, 64],
    'sunweaver-habitat': [32, 32], 'gravemark-habitat': [32, 32],
    'sunweaver-yard': [32, 32], 'gravemark-yard': [32, 32],
  };
  const [cellW, cellH] = CELL[id];
  const cols = manifest.frames.length > 1 ? 8 : 1;
  if (png.width !== cellW * cols) { console.log(`  ${id}: png width ${png.width} != ${cellW * cols} — geometry guess wrong`); process.exitCode = 1; }
  let bad = 0;
  for (const f of manifest.frames) {
    const i = manifest.frames.indexOf(f);
    const ox = (i % cols) * cellW;
    const oy = Math.floor(i / cols) * cellH;
    // own extraction: copy cell region row-by-row from PNG RGBA
    const cell = Buffer.alloc(cellW * cellH * 4);
    for (let y = 0; y < cellH; y++) {
      const srcOff = ((oy + y) * png.width + ox) * 4;
      png.data.copy(cell, y * cellW * 4, srcOff, srcOff + cellW * 4);
    }
    const h = sha(cell);
    const regHash = registry.assets[id]?.frameSha256?.[f.key];
    if (h !== f.sha256) { bad++; console.log(`  ${id} ${f.key}: manifest=${f.sha256} extracted=${h} *** MISMATCH`); }
    if (regHash !== undefined && h !== regHash) { bad++; console.log(`  ${id} ${f.key}: registry=${regHash} extracted=${h} *** REGISTRY MISMATCH`); }
  }
  const pngFileSha = sha(fs.readFileSync(path.join(dir, 'baseline.png')));
  const manifestFileSha = sha(fs.readFileSync(path.join(dir, 'manifest.json')));
  const reg = registry.assets[id];
  console.log(`${id}: ${manifest.frames.length} frames, mismatches=${bad}, png ${png.width}x${png.height} (${cellW}x${cellH} x${cols})`);
  console.log(`  file sha256 vs registry: baseline.png ${pngFileSha === reg.baselinePngSha256 ? 'MATCH' : '*** MISMATCH ***'} | manifest.json ${manifestFileSha === reg.manifestSha256 ? 'MATCH' : '*** MISMATCH ***'}`);
  if (bad > 0) process.exitCode = 1;
}
