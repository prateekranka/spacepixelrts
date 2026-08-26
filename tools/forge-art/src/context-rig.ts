/**
 * FAL-CONTEXT — context-rig.ts
 *
 * Boot module for tools/forge-art/rig.html: hosts the REAL GameRenderer
 * (src/render.ts) on a full-window #stage div with a deterministic World
 * fixture, and renders the 13 fixed scenes of spec §9 on demand via
 * stageScene(). Exactly one live WebGL context per page; no direct `three`
 * imports (GameRenderer is the only sanctioned renderer usage, FORGE_ART_LAB §3).
 *
 * URL contract: the rig page must be loaded with ?mesh=0&combat=1 — both are
 * readonly at construction (A4 §1.2/§6.2). Missing flags warn loudly in the
 * DOM and on console, then the rig continues with whatever the URL defaulted.
 */

import { mulberry32 } from '../../../src/engine';
import { GameRenderer } from '../../../src/render';
import { World } from '../../../src/sim';
import { SCENE_NAMES, STAGE_SEED, stageScene, type SceneName } from './fixtures';

export interface SceneSnapshot {
  name: SceneName;
  ids: number[];
  selected: number[];
  camera: { x: number; z: number; halfH: number };
  tick: number;
  fog: 'off' | 'rings';
}

/** Public rig API — frozen shape; `ready`/`current` are live getters. */
export interface ForgeRigApi {
  readonly version: 1;
  readonly ready: boolean;
  readonly sceneNames: readonly string[];
  readonly current: SceneName | null;
  show(name: string): Promise<SceneSnapshot>;
  readonly view: GameRenderer;
  readonly world: World;
}

declare global {
  interface Window {
    __FORGE_RIG__: ForgeRigApi;
    __FORGE_ART_TOOL__: ForgeRigApi;
  }
}

// 0) URL flags — read BEFORE constructing the renderer (readonly class fields).
const params = new URLSearchParams(window.location.search);
const flagsOk = params.get('mesh') === '0' && params.get('combat') === '1';
const requestedScene = params.get('scene');
const initialScene: SceneName = SCENE_NAMES.includes(requestedScene as SceneName)
  ? (requestedScene as SceneName)
  : 'quiet-helios';

// 1) Host layout BEFORE `new GameRenderer(host)` — the constructor reads
//    host.clientWidth/clientHeight for canvas size AND camera aspect (A4 §1).
const host = document.createElement('div');
host.id = 'stage';
host.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#0B0A12;';
document.body.appendChild(host);

// 2) World fixture — mirror of main.ts:130-134 + A4 §1.1.
const world = new World();
world.civ[0] = 'vespari'; // player side
world.civ[1] = 'aurion'; // rival side
world.fogOfWarEnabled = true;
world.aiDifficulty = 'standard';
world.reset(STAGE_SEED >>> 0);

// 3) Deterministic skies: buildStars/buildNebula consume Math.random (A4 §1.3,
//    §6.4) — override BEFORE init(world). Never re-init on a live page.
Math.random = mulberry32(0xC0FFEE);

// 4) The one live WebGL context on this page (A4 §1.2, §6.1).
const view = new GameRenderer(host);
view.init(world);
view.resize(host.clientWidth, host.clientHeight);

if (!flagsOk) {
  const warn = document.createElement('div');
  warn.id = 'fal-url-warning';
  warn.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:99;background:#B84B45;color:#F0E7D2;' +
    'font:12px/1.4 ui-monospace,monospace;padding:6px 10px;';
  warn.textContent = `FORGE RIG WARNING: URL must be ?mesh=0&combat=1 (found '${window.location.search}'). ` +
    'Those flags are readonly at construction — reload with them for deterministic gates.';
  document.body.appendChild(warn);
  console.warn(
    '[forge-art/context-rig] missing URL flags mesh=0&combat=1; continuing with current readonly flags.',
    window.location.search,
  );
}

let current: SceneName | null = null;
let drawn = false;
let lastSelected = new Set<number>();

function setStatus(text: string): void {
  const el = document.getElementById('fal-status');
  if (el) el.textContent = text;
}

/** Stage + draw one scene; returns snapshot info for the caller/harness. */
async function show(name: string): Promise<SceneSnapshot> {
  const sceneName = SCENE_NAMES.includes(name as SceneName) ? (name as SceneName) : null;
  if (sceneName === null) {
    throw new Error(`unknown scene '${name}' — expected one of: ${SCENE_NAMES.join(', ')}`);
  }
  const staged = stageScene(world, sceneName);
  view.setZoom(staged.camera.halfH);
  view.lookAt(staged.camera.x, staged.camera.z);
  lastSelected = staged.selected;
  view.draw(world, 0, staged.selected, null);
  current = sceneName;
  drawn = true;
  return {
    name: sceneName,
    ids: staged.ids.slice(),
    selected: Array.from(staged.selected),
    camera: { ...staged.camera },
    tick: world.tick,
    fog: staged.fog,
  };
}

const rig: ForgeRigApi = {
  version: 1,
  get ready(): boolean {
    return drawn;
  },
  get sceneNames(): readonly string[] {
    return SCENE_NAMES.slice();
  },
  get current(): SceneName | null {
    return current;
  },
  show,
  view,
  world,
};

window.__FORGE_RIG__ = Object.freeze(rig);
// Harness-facing alias (spec §6 / A4 §6): same handles, one live context.
window.__FORGE_ART_TOOL__ = Object.freeze(rig);

function wireSidebar(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-fal-scene]');
  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const name = btn.dataset.falScene;
      if (!name) return;
      show(name)
        .then((snap) => {
          for (const other of buttons) other.classList.toggle('active', other === btn);
          setStatus(
            `scene ${snap.name} · ids ${snap.ids.length} · tick ${snap.tick} · ` +
              `fog ${snap.fog} · zoom ${snap.camera.halfH}`,
          );
        })
        .catch((err: unknown) => setStatus(`ERROR: ${err instanceof Error ? err.message : String(err)}`));
    });
  }
}

window.addEventListener('resize', () => {
  view.resize(host.clientWidth, host.clientHeight);
  if (drawn) view.draw(world, 0, lastSelected, null);
});

let disposed = false;

/**
 * A4 §5 sanctioned teardown — GameRenderer has no dispose(); this is it.
 * Frames are manual draws (no rAF loop), so there is nothing to cancel.
 */
export function disposeRig(): void {
  if (disposed) return;
  disposed = true;
  view.renderer.dispose();
  view.renderer.forceContextLoss();
  view.renderer.domElement.remove();
  view.overlay.remove();
  host.remove();
}

window.addEventListener('pagehide', disposeRig);

// First paint: use the requested fixed scene when valid; fall back to
// quiet-helios so a missing/invalid scene never produces a black canvas.
wireSidebar();
void show(initialScene).then((snap) => {
  setStatus(
    `scene ${snap.name} · ids ${snap.ids.length} · tick ${snap.tick} · fog ${snap.fog} · ` +
      `zoom ${snap.camera.halfH} · ${flagsOk ? 'mesh=0&combat=1' : 'MISSING URL FLAGS'}`,
  );
  document.querySelector<HTMLButtonElement>(`[data-fal-scene="${snap.name}"]`)?.classList.add('active');
});
