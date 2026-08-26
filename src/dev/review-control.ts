/**
 * FRD-2a — typed forge review control + install guard (docs/FORGE_REVIEW_DECK.md).
 *
 * Installed at `window.__STARHAVEN_FORGE__` ONLY when
 * `import.meta.env.DEV === true` AND the query contains `forge`. Otherwise
 * `installForgeReviewControl` returns null and touches nothing (production
 * builds short-circuit on the DEV check; no globals, no hooks).
 *
 * The control is display/read side only: it never mutates World knowledge,
 * discovery latches, targeting, resources or orders. The only sim mutation is
 * `world.step()` from `step()` while frozen — the same call the rAF loop uses.
 */

import { FACTION_IDS, cloneMatchConfig, toLegacyCiv, type FactionId, type MatchConfig } from '../match-config';
import { QA_SCENARIOS } from '../qa-scenarios';
import type { AppState } from '../app-flow';
import { MAP } from '../engine';

export type { ForgeOverlayId, FORGE_OVERLAY_IDS } from './review-overlays';
import type { ForgeOverlayId } from './review-overlays';

export type ForgePerspective = 'player' | 'rival' | 'omniscient';
export type ForgeCameraMode = 'normal' | 'tactical-close' | 'strategic-far';

/** FROZEN — docs/FORGE_REVIEW_DECK.md "Typed review-control interface". */
export interface ForgeReviewSnapshot {
  scenario: string | null;
  /** What was asked (URL/control), null if n/a. */
  requestedSeed: number | null;
  /** >>>0 resolved config seed. */
  actualSeed: number;
  config: MatchConfig;
  state: AppState;
  tick: number;
  perspective: ForgePerspective;
  cameraMode: ForgeCameraMode;
  camera: { x: number; z: number; halfH: number };
  selection: number[];
  uiVisible: boolean;
  /** false = omniscient-style fog display, true = real fog per perspective. */
  reviewFog: boolean;
  overlays: Record<ForgeOverlayId, boolean>;
  frozen: boolean;
  liveEntities: number;
  totalEntitySlots: number;
  rendererInfo: { calls: number; triangles: number; points: number; lines: number } | null;
}

/** FROZEN — docs/FORGE_REVIEW_DECK.md "Typed review-control interface". */
export interface ForgeReviewControl {
  snapshot(): ForgeReviewSnapshot;
  /** Reload-bearing. */
  setRoute(id: string): Promise<void>;
  /** Reload-bearing. */
  setOrientation(o: 'landscape-left' | 'landscape-right'): Promise<void>;
  /** Reload-bearing when a match exists. */
  setFactions(player: string, rival: string): Promise<void>;
  /** Reload-bearing; deterministic mode. */
  setSeed(seed: number): Promise<void>;
  /** Display-only. */
  setPerspective(p: ForgePerspective): void;
  /** Presets: normal = saved/scenario halfH, tactical-close 5, strategic-far 18. */
  setCameraMode(m: ForgeCameraMode): void;
  setCamera(x: number, z: number): void;
  setUiVisible(v: boolean): void;
  setReviewFog(v: boolean): void;
  selectIds(ids: number[]): void;
  selectScout(): void;
  clearSelection(): void;
  setFrozen(v: boolean): void;
  /** Advances frozen sim deterministically, max 600 ticks per call. */
  step(ticks: number): void;
  setOverlay(id: ForgeOverlayId, on: boolean): void;
  metrics(): { fps: number; gameWorkP99Ms: number; rafP99Ms: number };
}

/**
 * Installed object: the frozen interface plus the two live state accessors the
 * main.ts renderer hook reads every frame (drawOverlays is re-invoked per
 * frame and picks up the latest values).
 */
export interface ForgeReviewControlInstalled extends ForgeReviewControl {
  /** Live overlay toggle map (mutated by setOverlay; read by the renderer hook). */
  readonly overlaysState: Record<ForgeOverlayId, boolean>;
  /** Live perspective (mutated by setPerspective; read by the renderer hook). */
  readonly perspectiveState: ForgePerspective;
}

/** Structural minimal view of World for read-only control access. */
export interface ForgeReviewWorld {
  readonly ents: readonly { readonly alive: boolean }[];
  readonly tick: number;
  readonly seed: number;
  step(): void;
}

/** Structural minimal view of Input for read-only control access. */
export interface ForgeReviewSelection {
  clear(): void;
  add(id: number): void;
  [Symbol.iterator](): IterableIterator<number>;
}

export interface ForgeReviewInput {
  readonly selected: ForgeReviewSelection;
  readonly pan: { x: number; z: number };
  halfH: number;
  focusScout(): void;
}

/** Structural minimal view of GameRenderer for read-only control access. */
export interface ForgeReviewView {
  info?(): { calls: number; tris: number; drawn: number; vfx: number } | undefined;
  setReviewMode?(mode: { perspective: ForgePerspective; showFog: boolean } | null): void;
}

/** Structural minimal view of Hud for visibility control. */
export interface ForgeReviewHud {
  setVisible(visible: boolean): void;
}

export interface ForgeReviewInstallOptions {
  getWorld(): ForgeReviewWorld | null;
  getInput(): ForgeReviewInput | null;
  getView(): ForgeReviewView | null;
  getState(): AppState;
  getConfig(): MatchConfig;
  getScenario(): string | null;
  getHud(): ForgeReviewHud | null;
  getFps(): number;
  getP99FrameMs(): number;
  /** Freeze flag consumed by the rAF loop (blocks sim advance while frozen). */
  setFreeze(frozen: boolean): void;
  /** Rewrites location.search preserving known params, then reloads. */
  reloadWithParams(mutate: (params: URLSearchParams) => void): void;
}

interface ForgeControlState {
  perspective: ForgePerspective;
  cameraMode: ForgeCameraMode;
  uiVisible: boolean;
  reviewFog: boolean;
  frozen: boolean;
  overlays: Record<ForgeOverlayId, boolean>;
  /** halfH saved at camera-mode entry so 'normal' can restore it. */
  savedHalfH: number | null;
}

const clampCamera = (value: number): number => Math.min(MAP - 4, Math.max(4, value));

/**
 * FRD — rAF compositor-spacing ring, owned by the control so `metrics()` can
 * report rafP99Ms from a source that is distinct from main's game-work ring.
 * Samples only while the document is visible; p99 over the last 120 frames.
 */
const rafSpacing = new Float32Array(120);
let rafHead = 0;
let rafCount = 0;
let rafLast: number | null = null;
const tickRafSpacing = (): void => {
  const now = performance.now();
  if (rafLast !== null) {
    rafSpacing[rafHead] = Math.min(1000, now - rafLast);
    rafHead = (rafHead + 1) % rafSpacing.length;
    rafCount = Math.min(rafCount + 1, rafSpacing.length);
  }
  rafLast = now;
  // Self-reschedule: this is a continuous sampler, one frame per tick.
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tickRafSpacing);
};
if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tickRafSpacing);
const RAF_P99_MIN_SAMPLES = 30;
const rafP99 = (): number => {
  if (rafCount < RAF_P99_MIN_SAMPLES) return 0;
  const sorted = Array.from(rafSpacing.slice(0, rafCount)).sort((a, b) => a - b);
  const value = sorted[Math.ceil(sorted.length * 0.99) - 1] ?? 0;
  return Math.round(value * 100) / 100;
};
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      rafLast = null;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tickRafSpacing);
    }
  });
}

const parseRequestedSeed = (params: URLSearchParams): number | null => {
  const raw = params.get('qa-seed');
  if (raw === null) return null;
  if (!/^(0|[1-9][0-9]*)$/.test(raw.trim())) return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff ? value : null;
};

const isSeed = (value: number): value is number =>
  Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

const isFaction = (value: string): value is FactionId =>
  FACTION_IDS.includes(value as FactionId);

/**
 * Install the forge review control. Returns null (and touches nothing) unless
 * running in a Vite dev build AND the page query contains `forge`.
 */
export function installForgeReviewControl(
  opts: ForgeReviewInstallOptions,
): ForgeReviewControlInstalled | null {
  if (!import.meta.env.DEV) return null;
  const searchParams = new URLSearchParams(window.location.search);
  if (!searchParams.has('forge')) return null;

  const state: ForgeControlState = {
    perspective: 'player',
    cameraMode: 'normal',
    uiVisible: searchParams.get('ui') !== '0',
    reviewFog: true,
    frozen: false,
    overlays: {
      paths: false,
      'hit-regions': false,
      'line-of-sight': false,
      orders: false,
      facing: false,
      'entity-ids': false,
    },
    savedHalfH: null,
  };
  const requestedSeed = parseRequestedSeed(searchParams);

  /** Push the display-only fog mode into the renderer (null would restore shipped). */
  const applyReviewMode = (): void => {
    const showFog = state.reviewFog && state.perspective !== 'omniscient';
    opts.getView()?.setReviewMode?.({ perspective: state.perspective, showFog });
  };

  const control: ForgeReviewControlInstalled = {
    get overlaysState(): Record<ForgeOverlayId, boolean> {
      return state.overlays;
    },
    get perspectiveState(): ForgePerspective {
      return state.perspective;
    },

    snapshot(): ForgeReviewSnapshot {
      const world = opts.getWorld();
      const input = opts.getInput();
      const view = opts.getView();
      const config = cloneMatchConfig(opts.getConfig());
      const rawInfo = view?.info?.();
      const rendererInfo =
        rawInfo === undefined
          ? null
          : {
              calls: rawInfo.calls,
              triangles: rawInfo.tris,
              // points/lines map onto the renderer's drawn-sprite/vfx counters.
              points: rawInfo.drawn,
              lines: rawInfo.vfx,
            };
      return {
        scenario: opts.getScenario(),
        requestedSeed,
        actualSeed: (world ? world.seed : config.seed) >>> 0,
        config,
        state: opts.getState(),
        tick: world?.tick ?? 0,
        perspective: state.perspective,
        cameraMode: state.cameraMode,
        camera: {
          x: input?.pan.x ?? 0,
          z: input?.pan.z ?? 0,
          halfH: input?.halfH ?? 0,
        },
        selection: input ? Array.from(input.selected).sort((a, b) => a - b) : [],
        uiVisible: state.uiVisible,
        reviewFog: state.reviewFog,
        overlays: { ...state.overlays },
        frozen: state.frozen,
        liveEntities: world
          ? world.ents.reduce((count, entity) => count + (entity.alive ? 1 : 0), 0)
          : 0,
        totalEntitySlots: world?.ents.length ?? 0,
        rendererInfo,
      };
    },

    async setRoute(id: string): Promise<void> {
      if (!QA_SCENARIOS.some((scenario) => scenario.id === id)) return;
      opts.reloadWithParams((params) => {
        params.set('qa', id);
      });
    },

    async setOrientation(o: 'landscape-left' | 'landscape-right'): Promise<void> {
      if (o !== 'landscape-left' && o !== 'landscape-right') return;
      opts.reloadWithParams((params) => {
        params.set('orientation', o);
      });
    },

    async setFactions(player: string, rival: string): Promise<void> {
      if (!isFaction(player) || !isFaction(rival) || player === rival) return;
      // main.ts maps the legacy `civ` param through parseBootCiv for skirmish
      // boots; QA routes pin their own scenario factions.
      opts.reloadWithParams((params) => {
        params.set('civ', toLegacyCiv(player));
      });
    },

    async setSeed(seed: number): Promise<void> {
      if (!isSeed(seed)) return;
      opts.reloadWithParams((params) => {
        params.set('qa-seed', String(seed >>> 0));
      });
    },

    setPerspective(p: ForgePerspective): void {
      state.perspective = p;
      applyReviewMode();
    },

    setCameraMode(mode: ForgeCameraMode): void {
      const input = opts.getInput();
      if (!input || mode === state.cameraMode) return;
      if (mode === 'normal') {
        if (state.savedHalfH !== null) input.halfH = state.savedHalfH;
      } else {
        // Save the scenario/default halfH at mode entry so 'normal' restores it.
        state.savedHalfH = input.halfH;
        input.halfH = mode === 'tactical-close' ? 5 : 18;
      }
      state.cameraMode = mode;
    },

    setCamera(x: number, z: number): void {
      const input = opts.getInput();
      if (!input) return;
      if (Number.isFinite(x)) input.pan.x = clampCamera(x);
      if (Number.isFinite(z)) input.pan.z = clampCamera(z);
    },

    setUiVisible(v: boolean): void {
      state.uiVisible = v;
      opts.getHud()?.setVisible(v);
    },

    setReviewFog(v: boolean): void {
      state.reviewFog = v;
      applyReviewMode();
    },

    selectIds(ids: number[]): void {
      const input = opts.getInput();
      const world = opts.getWorld();
      if (!input || !world) return;
      input.selected.clear();
      for (const id of ids) {
        if (!Number.isInteger(id) || id < 0 || id >= world.ents.length) continue;
        if (world.ents[id].alive) input.selected.add(id);
      }
    },

    selectScout(): void {
      const input = opts.getInput();
      if (!input) return;
      try {
        input.focusScout();
      } catch (error) {
        console.warn('Starhaven forge: selectScout failed', error);
      }
    },

    clearSelection(): void {
      opts.getInput()?.selected.clear();
    },

    setFrozen(v: boolean): void {
      state.frozen = v;
      opts.setFreeze(v);
    },

    step(ticks: number): boolean {
      const world = opts.getWorld();
      if (!state.frozen || !world) return false;
      const count = Math.max(1, Math.min(600, Math.floor(ticks) || 1));
      for (let index = 0; index < count; index++) world.step();
      return true;
    },

    setOverlay(id: ForgeOverlayId, on: boolean): void {
      state.overlays[id] = on;
    },

    metrics(): { fps: number; gameWorkP99Ms: number; rafP99Ms: number } {
      return {
        fps: opts.getFps(),
        // Distinct sources by contract: game work = main's per-frame work ring;
        // rAF = THIS control's own compositor-spacing ring below. Never conflated.
        gameWorkP99Ms: opts.getP99FrameMs(),
        rafP99Ms: rafP99(),
      };
    },
  };

  applyReviewMode();
  const installed = Object.freeze(control);
  window.__STARHAVEN_FORGE__ = installed;
  return installed;
}

declare global {
  interface Window {
    __STARHAVEN_FORGE__?: ForgeReviewControl;
  }
}
