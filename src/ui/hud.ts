import { MAP, Tile } from '../sim/engine';
import type { World } from '../sim/world';

export function paintMinimap(canvas: HTMLCanvasElement, world: World, camX: number, camZ: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(MAP, MAP);
  const d = img.data;
  for (let z = 0; z < MAP; z++) {
    for (let x = 0; x < MAP; x++) {
      const t = world.tiles[x + z * MAP]!;
      let r = 10;
      let g = 8;
      let b = 20;
      if (t === Tile.Dust) {
        r = 28;
        g = 22;
        b = 42;
      } else if (t === Tile.Rock) {
        r = 58;
        g = 48;
        b = 64;
      } else if (t === Tile.Ore) {
        r = 198;
        g = 154;
        b = 72;
      } else if (t === Tile.Gas) {
        r = 92;
        g = 168;
        b = 210;
      } else if (t === Tile.Solar) {
        r = 240;
        g = 196;
        b = 72;
      }
      const i = (x + z * MAP) * 4;
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    }
  }
  for (const e of world.ents) {
    if (!e.alive) continue;
    const x = e.x | 0;
    const z = e.z | 0;
    if (x < 0 || z < 0 || x >= MAP || z >= MAP) continue;
    const i = (x + z * MAP) * 4;
    if (e.team === 0) {
      d[i] = 255;
      d[i + 1] = 211;
      d[i + 2] = 106;
    } else {
      d[i] = 255;
      d[i + 1] = 74;
      d[i + 2] = 74;
    }
  }
  const ci = ((camX | 0) + (camZ | 0) * MAP) * 4;
  if (ci >= 0 && ci < d.length) {
    d[ci] = 255;
    d[ci + 1] = 255;
    d[ci + 2] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function syncHud(world: World): void {
  const ore = document.getElementById('ore');
  const vol = document.getElementById('vol');
  const chg = document.getElementById('chg');
  const pop = document.getElementById('pop');
  if (ore) ore.textContent = String(world.ore | 0);
  if (vol) vol.textContent = String(world.vol | 0);
  if (chg) chg.textContent = String(world.chg | 0);
  if (pop) pop.textContent = `${world.pop}/${world.cap}`;
}
