import fs from 'node:fs';
import { PNG } from 'pngjs';
const png = PNG.sync.read(fs.readFileSync('/tmp/fal-qa-final3/qa-workbench.png'));
// print colors in the magenta bbox 367..379 x 90..98
for (let y = 88; y <= 100; y++) {
  let row = '';
  for (let x = 364; x <= 382; x++) {
    const i = (x + y * png.width) * 4;
    const r=png.data[i],g=png.data[i+1],b=png.data[i+2];
    if (r===255&&g===0&&b===255) row+='M';
    else if (r>200&&g>200) row+='W';
    else if (r<60&&b<80) row+='.';
    else row+='?';
  }
  console.log(String(y).padStart(3), row);
}
