import { DT, VERSION } from './sim/engine';
import { World } from './sim/world';
import { Renderer } from './render/renderer';
import { Input } from './input/input';
import { paintMinimap, syncHud } from './ui/hud';
import type { DrawEnt } from './render/renderer';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const mini = document.getElementById('mini') as HTMLCanvasElement;

const world = new World();
world.reset(0x5eed);

const gfx = new Renderer(canvas);
const input = new Input(canvas, world, gfx);
input.camX = 32;
input.camZ = 30;
input.zoom = 3;

let acc = 0;
let last = performance.now();
let ema = 16.6;
let frames = 0;
let fpsT = last;

function resize(): void {
  gfx.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
resize();
window.addEventListener('resize', resize);

function probe(): void {
  const fps = 1000 / ema;
  const alive = world.ents.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  (window as unknown as { __STARHOLD__: unknown }).__STARHOLD__ = {
    fps,
    frameMs: ema,
    tick: world.tick,
    ents: alive,
    drawCalls: gfx.drawCalls,
    version: VERSION,
  };
}

function frame(now: number): void {
  const raw = Math.min(0.1, (now - last) / 1000);
  last = now;
  ema = ema * 0.9 + raw * 1000 * 0.1;
  acc += raw;
  while (acc >= DT) {
    world.step();
    acc -= DT;
  }
  const alpha = acc / DT;
  const ents: DrawEnt[] = [];
  for (const e of world.ents) {
    if (!e.alive) continue;
    ents.push({
      x: e.px + (e.x - e.px) * alpha,
      z: e.pz + (e.z - e.pz) * alpha,
      kind: e.kind,
      civ: e.civ,
      team: e.team,
      hp: e.hp,
      maxHp: e.maxHp,
      anim: e.anim,
      facing: e.facing,
      vis: e.vis,
      selected: input.selected.has(e.id),
    });
  }
  gfx.draw({
    tiles: world.tiles,
    ents,
    bolts: world.bolts,
    camX: input.camX,
    camZ: input.camZ,
    zoom: input.zoom,
  });
  if ((world.tick & 3) === 0) {
    paintMinimap(mini, world, input.camX, input.camZ);
    syncHud(world);
  }
  frames++;
  if (now - fpsT > 500) {
    fpsT = now;
    probe();
  }
  requestAnimationFrame(frame);
}

probe();
requestAnimationFrame(frame);

export { world, gfx, input };
