import fs from 'node:fs';
import { PNG } from 'pngjs';
const png = PNG.sync.read(fs.readFileSync('/tmp/fal-qa-final3/qa-workbench.png'));
const hits = [];
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const i = (x + y * png.width) * 4;
    if (png.data[i] === 255 && png.data[i+1] === 0 && png.data[i+2] === 255) hits.push([x, y]);
  }
}
console.log('count', hits.length);
console.log('sample', hits.slice(0, 12).map(([x,y]) => `${x},${y}`).join(' '));
const xs = hits.map(h=>h[0]); const ys = hits.map(h=>h[1]);
if (hits.length) console.log('bbox', Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
