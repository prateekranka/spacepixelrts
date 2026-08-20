// Objective: real-capture crown-center luminance profile.
// Samples the actual beauty-front-ortho.png along vertical bands of the crown,
// at the center column and midway/flank columns, plus the background gray.
// Answers: is the crown center darker than the background (talon occlusion)?
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'critic/out/town-center-structural-v01/beauty-front-ortho.png';
const png = PNG.sync.read(readFileSync(path));
const W = png.width, H = png.height;
const cx = Math.floor(W / 2);
const lumaAt = (x, y) => {
  const o = (y * W + x) * 4;
  return 0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2];
};
const meanLuma = (x0, x1, y0, y1) => {
  let s = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { s += lumaAt(x, y); n++; }
  return s / n;
};
// Background: far corners
const bg = Math.round(meanLuma(8, 40, 8, 40));
console.log(`image ${W}x${H}  background gray ~${bg}`);
// Crown band: building apex near top. Sample vertical bands (y in px from top).
const bands = [
  ['apex', 40, 80],
  ['upper crown', 100, 160],
  ['mid crown', 170, 240],
  ['lower crown', 250, 330],
  ['collar/upper vault', 340, 400],
  ['vault', 400, 460],
];
for (const [name, y0, y1] of bands) {
  const half = Math.min(Math.floor(W * 0.2), 220); // 20% of width
  const center = Math.round(meanLuma(cx - 18, cx + 18, y0, y1));
  const flankL = Math.round(meanLuma(cx - half, cx - half + 24, y0, y1));
  const flankR = Math.round(meanLuma(cx + half - 24, cx + half, y0, y1));
  const minBand = (() => { let m = 255; for (let y = y0; y <= y1; y++) for (let x = cx - half; x <= cx + half; x++) m = Math.min(m, lumaAt(x, y)); return Math.round(m); })();
  console.log(`${name.padEnd(10)} y${String(y0).padStart(3)}-${String(y1).padStart(3)}  center ${center}  flankL ${flankL}  flankR ${flankR}  bandMin ${minBand}`);
}
