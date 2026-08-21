/** Spacepixel boot — rAF loop, harness, landscape iPad. */

import { DT, Kind, MAP, MAX_ENTS } from './engine';
import type { Civ } from './engine';
import { World } from './sim';
import { GameRenderer } from './render';
import { Input } from './input';
import { Hud } from './hud';
import { Sfx } from './audio';
import { enemyCiv, parseBootCiv } from './content';
import { OPENING_CAMERA } from './opening-presentation';
import { StartScreen } from './start-screen';

const VERSION = '0.9.12-iso';
const SEED = 0x5eed;
const OPENING_PAN = OPENING_CAMERA;

const host = document.getElementById('app');
if (!host) throw new Error('Starhold boot: #app host missing');
const world = new World();
world.fogOfWarEnabled = new URLSearchParams(window.location.search).get('fog') === '1';
world.civ[0] = 'vespari';
world.civ[1] = 'aurion';
const bootCiv = parseBootCiv(window.location.search);
if (bootCiv) {
  world.civ[0] = bootCiv;
  world.civ[1] = enemyCiv(bootCiv);
}
world.reset(SEED);

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
input.pan.x = OPENING_PAN.x;
input.pan.z = OPENING_PAN.z;
input.halfH = OPENING_PAN.halfH;

function switchCiv(player: Civ): void {
  resetMatch(player);
  matchPaused = false;
  hud.setPaused(false);
}

function resetMatch(player: Civ): void {
  world.civ[0] = player;
  world.civ[1] = enemyCiv(player);
  world.reset(SEED);
  input.selected.clear();
  input.groups = [[], [], [], []];
  input.place = null;
  input.pan.x = OPENING_PAN.x;
  input.pan.z = OPENING_PAN.z;
  input.halfH = OPENING_PAN.halfH;
  hitSfx = 0;
}

const hud = new Hud(host);
let matchStarted = false;
let matchPaused = false;

function togglePause(): void {
  if (!matchStarted) return;
  matchPaused = !matchPaused;
  hud.setPaused(matchPaused);
}

hud.bind(world, input, view, switchCiv, togglePause);
hud.setVisible(false);
hud.setPaused(false);
let startScreen: StartScreen | null = null;

function startMatch(player: Civ): void {
  resetMatch(player);
  matchStarted = true;
  matchPaused = false;
  acc = 0;
  hud.setVisible(true);
  hud.setPaused(false);
  startScreen?.destroy();
  startScreen = null;
}

startScreen = new StartScreen(host, world.civ[0], { onNewMatch: startMatch });

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  event.preventDefault();
  togglePause();
});

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
  input.tick(matchStarted ? raw : 0);
  let steps = 0;
  if (matchStarted && !matchPaused) {
    while (acc >= DT && steps < 5) {
      world.step();
      acc -= DT;
      steps++;
    }
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
    screen: matchStarted ? 'match' : 'start',
    matchStarted,
    paused: matchPaused,
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

console.log(`Spacepixel ${VERSION} — SDF unit/building quads`);
