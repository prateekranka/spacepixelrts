import fs from 'node:fs';
import { PNG } from 'pngjs';
const png = PNG.sync.read(fs.readFileSync('/tmp/fal-qa-final3/qa-workbench.png'));
// crop x 300..450, y 60..140 and save enlarged 4x for inspection
const W = 150, H = 80, S = 4;
const out = new PNG({ width: W * S, height: H * S });
for (let y = 0; y < H * S; y++) {
  for (let x = 0; x < W * S; x++) {
    const sx = 300 + Math.floor(x / S), sy = 60 + Math.floor(y / S);
    const si = (sx + sy * png.width) * 4, di = (x + y * W * S) * 4;
    out.data[di] = png.data[si]; out.data[di+1] = png.data[si+1]; out.data[di+2] = png.data[si+2]; out.data[di+3] = 255;
  }
}
fs.writeFileSync('/tmp/fal-mag-crop.png', PNG.sync.write(out));
console.log('saved');
