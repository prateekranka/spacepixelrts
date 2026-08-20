import { PNG } from 'pngjs';
import { readFileSync, statSync } from 'node:fs';

const files = [
  'critic/out/town-center-structural-v01/beauty-front-ortho.png',
  'critic/out/town-center-structural-v01/beauty-front-ortho-vault-luminance-gate.png',
  'critic/out/town-center-structural-v01/beauty-front-ortho-mandorla-gate.png',
];
for (const f of files) {
  const png = PNG.sync.read(readFileSync(f));
  const W = png.width, H = png.height;
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  const luma = (x, y) => { const o = (y * W + x) * 4; return Math.round(0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2]); };
  // center row/col profile around the middle
  const row = [];
  for (let x = cx - 60; x <= cx + 60; x += 10) row.push(luma(x, cy));
  console.log(`${f.split('/').pop()}  ${W}x${H}  bytes=${statSync(f).size}`);
  console.log(`  center-row luma (x=center-60..center+60): ${row.join(' ')}`);
  console.log(`  center col: y=cy-60 -> luma ${luma(cx, cy - 60)} | y=cy -> ${luma(cx, cy)} | y=cy+60 -> ${luma(cx, cy + 60)}`);
}
