/** Spacepixel boot — rAF loop, harness, landscape iPad. */

import { DT, Kind, MAP, MAX_ENTS } from './engine';
import { World } from './sim';
import { GameRenderer } from './render';
import { Input } from './input';
import { Hud } from './hud';
import { Sfx } from './audio';

const VERSION = '0.5.3-wave4';

const host = document.getElementById('app');
if (!host) throw new Error('Starhold boot: #app host missing');
const world = new World();
world.civ[0] = 'vespari';
world.civ[1] = 'aurion';
world.reset(0x5eed);

const view = new GameRenderer(host);
view.init(world);
view.resize(host.clientWidth, host.clientHeight);

const sfx = new Sfx();
let hitSfx = 0;
world.onHit = () => {
  sfx.hit();
  hitSfx++;
};
world.onMuzzle = () => sfx.muzzle();
const input = new Input(host, world, view, sfx);
input.pan.x = MAP * 0.5;
input.pan.z = MAP * 0.52;
input.halfH = 5.8;

const hud = new Hud(host);
hud.bind(world, input, view);

let acc = 0;
let last = performance.now();
let fpsSmoothed = 60;
let frames = 0;
let fpsT = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += raw;
  fpsT += raw;
  frames++;
  if (fpsT >= 0.4) {
    fpsSmoothed = Math.round(frames / fpsT);
    frames = 0;
    fpsT = 0;
  }
  input.tick(raw);
  let steps = 0;
  while (acc >= DT && steps < 5) {
    world.step();
    acc -= DT;
    steps++;
  }
  const alpha = acc / DT;
  view.draw(world, alpha, input.selected, input.box);
  hud.draw(world, input, fpsSmoothed);
  publish();
}

requestAnimationFrame(frame);

function publish(): void {
  const info = view.info();
  const probe = {
    version: VERSION,
    tick: world.tick,
    fps: fpsSmoothed,
    ents: world.ents.reduce((n, e) => n + (e.alive ? 1 : 0), 0),
    selected: input.selected.size,
    teams: world.teams.slice(0, 2),
    civ: world.civ.slice(0, 2),
    rendererInfo: info,
    map: MAP,
    max: MAX_ENTS,
    hall: Kind.Hall,
    winner: world.winner,
    hitSfx,
  };
  const w = window as unknown as {
    __SPACEPIXEL__: typeof probe;
    __STARHOLD__: typeof probe;
    __STARHOLD_INPUT__: Input;
    __STARHOLD_VIEW__: GameRenderer;
    __STARHOLD_WORLD__: World;
  };
  w.__SPACEPIXEL__ = probe;
  w.__STARHOLD__ = probe;
  w.__STARHOLD_INPUT__ = input;
  w.__STARHOLD_VIEW__ = view;
  w.__STARHOLD_WORLD__ = world;
}

window.addEventListener('resize', () => {
  view.resize(host.clientWidth, host.clientHeight);
});

console.log(`Spacepixel ${VERSION} — wave 2 empire loop`);
