/**
 * Forge Art Lab v1 — synchronized workbench store (FAL-STORE).
 *
 * Single source of truth (A5 §2, FORGE_ART_LAB §6): every view — catalog
 * selection, transport, passes, wipe, zoom, metrics, roster — derives from one
 * `ForgeLabState`; mutations go through one `update(partial)` that applies the
 * change, notifies subscribers, and re-serializes the URL hash (debounced).
 *
 * Persistence contract (A5 §3): URL hash is the source of truth on reload
 * (`#fal=a=..&d=..&p=..&f=..`); sessionStorage['fal.state.v1'] restores
 * anything hash-incompatible (mid-session wipe drags etc.). Hash wins on
 * conflict. Banned legacy vocabulary is rejected, never adapted.
 *
 * Amendments over A5 §2.1 (frozen for Wave B2): facing is a dir8 number 0..7
 * (engine `dir8`: 0=E 1=NE 2=N 3=NW 4=W 5=SW 6=S 7=SE); pose is a frame-group
 * name ('primary' default; 'actions' selectable on sunweaver-worker); frame is
 * the pose-row index within the current group; background is the stage
 * backdrop ('checker'|'ink'|'slate'); cameraHalfH drives world-scale rows;
 * passes hold exactly five toggles (diff is an A/B mode, not a pass).
 */
import { isPublicAssetId } from './registry';

export type AbMode = 'split' | 'side-by-side' | 'diff';
/** Stage view: single-side inspection or the classic A/B comparison modes. */
export type ViewMode = 'baseline' | 'candidate' | 'split' | 'side-by-side' | 'diff';
export type ZoomLevel = '1x' | '4x' | '8x';
export type BackgroundId = 'checker' | 'ink' | 'slate';
export type PassId = 'silhouette' | 'value' | 'alpha' | 'team' | 'emissive';

/** UI order == compose order (A5 §2.1: "ordered booleans; UI order = this order"). */
export const PASS_IDS: readonly PassId[] = ['silhouette', 'value', 'alpha', 'team', 'emissive'];

/** data-fal-view order (FAL-IMAGE: baseline, candidate, split, side-by-side, diff). */
export const VIEW_MODES: readonly ViewMode[] = ['baseline', 'candidate', 'split', 'side-by-side', 'diff'];

export interface ForgeLabState {
  /** Canonical stable id, e.g. 'sunweaver-core', 'gravemark-rift-guard'. */
  assetId: string;
  /** dir8 facing 0..7 (0=E 1=NE 2=N 3=NW 4=W 5=SW 6=S 7=SE). */
  facing: number;
  /** Frame group: 'primary' (baseline grid) or an asset group ('actions'). */
  pose: string;
  /** Pose-row index within the current group (0..rows-1). */
  frame: number;
  playing: boolean;
  /** Playback multiplier 0.25..4. */
  speed: number;
  /** Orthographic camera half-height (harness close=5 / normal=14 / far=32). */
  cameraHalfH: number;
  background: BackgroundId;
  abMode: AbMode;
  /**
   * Stage view (FAL-IMAGE): 'baseline'/'candidate' show a single side;
   * 'split'/'side-by-side'/'diff' are the classic A/B comparison modes and
   * stay synchronized with abMode.
   */
  view: ViewMode;
  /** 0..100, split mode only. */
  wipePosition: number;
  zoom: ZoomLevel;
  passes: {
    silhouette: boolean;
    value: boolean;
    alpha: boolean;
    team: boolean;
    emissive: boolean;
  };
}

export const DEFAULT_STATE: ForgeLabState = {
  assetId: 'sunweaver-lumen-guard',
  facing: 0,
  pose: 'primary',
  frame: 0,
  playing: false,
  speed: 1,
  cameraHalfH: 14,
  background: 'checker',
  abMode: 'split',
  view: 'split',
  wipePosition: 50,
  zoom: '1x',
  passes: { silhouette: false, value: false, alpha: false, team: false, emissive: false },
};

const HASH_PREFIX = '#fal=';
const SS_KEY = 'fal.state.v1';

/** Banned vocabulary — must never appear in URLs, hash keys/values, or the UI. */
const BANNED_RE = /starhold|sunfold|sunwoven|helion compact|kryos conclave|nihiline/i;

const ZOOMS: readonly ZoomLevel[] = ['1x', '4x', '8x'];
const AB_MODES: readonly AbMode[] = ['split', 'side-by-side', 'diff'];
const BACKGROUNDS: readonly BackgroundId[] = ['checker', 'ink', 'slate'];

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function clonePasses(p: ForgeLabState['passes']): ForgeLabState['passes'] {
  return { ...p };
}

/** Current canonical deep link (`#fal=...`). A5 §2.2 key map, amended d=facing. */
export function canonicalHash(s: ForgeLabState): string {
  const pairs: Array<[string, string]> = [
    ['a', s.assetId],
    ['d', String(s.facing)],
    ['p', s.pose],
    ['f', String(s.frame)],
    ['pl', s.playing ? '1' : '0'],
    ['sp', String(s.speed)],
    ['c', String(s.cameraHalfH)],
    ['b', s.background],
    ['m', s.abMode],
    ['v', s.view],
    ['w', String(s.wipePosition)],
    ['z', s.zoom],
    ['pa', PASS_IDS.filter((id) => s.passes[id]).join(',')],
  ];
  return HASH_PREFIX + pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function parsePassesCsv(csv: string): ForgeLabState['passes'] {
  const set = new Set(csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0));
  return {
    silhouette: set.has('silhouette'),
    value: set.has('value'),
    alpha: set.has('alpha'),
    team: set.has('team'),
    emissive: set.has('emissive'),
  };
}

/**
 * Parse a canonical hash. Absent keys stay undefined (caller falls back to
 * sessionStorage then defaults); unknown keys ignored (forward-compat);
 * malformed or banned values are ignored, never adapted.
 */
export function parseHash(hash: string): Partial<ForgeLabState> | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const out: Partial<ForgeLabState> = {};
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(hash.slice(HASH_PREFIX.length));
  } catch {
    return null;
  }
  for (const [key, raw] of params) {
    if (BANNED_RE.test(raw)) continue;
    switch (key) {
      case 'a':
        if (isPublicAssetId(raw)) out.assetId = raw;
        break;
      case 'd': {
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 0 && n <= 7) out.facing = n;
        break;
      }
      case 'p':
        if (/^[a-z0-9-]{1,32}$/.test(raw)) out.pose = raw;
        break;
      case 'f': {
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 0) out.frame = n;
        break;
      }
      case 'pl':
        if (raw === '0' || raw === '1') out.playing = raw === '1';
        break;
      case 'sp': {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) out.speed = clamp(n, 0.25, 4);
        break;
      }
      case 'c': {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) out.cameraHalfH = n;
        break;
      }
      case 'b':
        if ((BACKGROUNDS as readonly string[]).includes(raw)) out.background = raw as BackgroundId;
        break;
      case 'm':
        if ((AB_MODES as readonly string[]).includes(raw)) {
          out.abMode = raw as AbMode;
          out.view = raw as ViewMode;
        }
        break;
      case 'v':
        if ((VIEW_MODES as readonly string[]).includes(raw)) out.view = raw as ViewMode;
        break;
      case 'w': {
        const n = Number(raw);
        if (Number.isFinite(n)) out.wipePosition = clamp(Math.round(n), 0, 100);
        break;
      }
      case 'z':
        if ((ZOOMS as readonly string[]).includes(raw)) out.zoom = raw as ZoomLevel;
        break;
      case 'pa':
        out.passes = parsePassesCsv(raw);
        break;
      default:
        break; // unknown keys ignored (forward-compat)
    }
  }
  return out;
}

function readSessionStorage(): Partial<ForgeLabState> | null {
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Partial<ForgeLabState> } | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.state) return null;
    const s = parsed.state;
    const out: Partial<ForgeLabState> = {};
    if (typeof s.assetId === 'string' && isPublicAssetId(s.assetId)) out.assetId = s.assetId;
    if (typeof s.facing === 'number') out.facing = clamp(Math.round(s.facing), 0, 7);
    if (typeof s.pose === 'string') out.pose = s.pose;
    if (typeof s.frame === 'number') out.frame = Math.max(0, Math.round(s.frame));
    if (typeof s.playing === 'boolean') out.playing = s.playing;
    if (typeof s.speed === 'number') out.speed = clamp(s.speed, 0.25, 4);
    if (typeof s.cameraHalfH === 'number') out.cameraHalfH = s.cameraHalfH;
    if (typeof s.background === 'string' && (BACKGROUNDS as readonly string[]).includes(s.background)) {
      out.background = s.background as BackgroundId;
    }
    if (typeof s.abMode === 'string' && (AB_MODES as readonly string[]).includes(s.abMode)) {
      out.abMode = s.abMode as AbMode;
      out.view = s.abMode as ViewMode;
    }
    if (typeof s.view === 'string' && (VIEW_MODES as readonly string[]).includes(s.view)) out.view = s.view as ViewMode;
    if (typeof s.wipePosition === 'number') out.wipePosition = clamp(Math.round(s.wipePosition), 0, 100);
    if (typeof s.zoom === 'string' && (ZOOMS as readonly string[]).includes(s.zoom)) out.zoom = s.zoom as ZoomLevel;
    if (s.passes && typeof s.passes === 'object') {
      out.passes = {
        silhouette: s.passes.silhouette === true,
        value: s.passes.value === true,
        alpha: s.passes.alpha === true,
        team: s.passes.team === true,
        emissive: s.passes.emissive === true,
      };
    }
    return out;
  } catch {
    return null;
  }
}

function applyPartial(target: ForgeLabState, partial: Partial<ForgeLabState>): void {
  const keys = Object.keys(partial) as Array<keyof ForgeLabState>;
  for (const key of keys) {
    if (key === 'passes') {
      if (partial.passes) target.passes = { ...target.passes, ...partial.passes };
    } else {
      const value = partial[key];
      if (value !== undefined) (target as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

/**
 * Assemble the initial state: defaults <- sessionStorage (non-hash extras) <-
 * URL hash (wins on conflict). Reduced-motion hosts boot paused (A5 §4).
 */
export function loadInitialState(): ForgeLabState {
  const state: ForgeLabState = { ...DEFAULT_STATE, passes: clonePasses(DEFAULT_STATE.passes) };
  const fromSession = readSessionStorage();
  const fromHash = parseHash(window.location.hash);
  if (fromSession) applyPartial(state, fromSession);
  if (fromHash) applyPartial(state, fromHash);
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.playing = false;
  }
  return state;
}

export type StoreSubscriber = () => void;

export class ForgeLabStore {
  private state: ForgeLabState;
  private subscribers = new Set<StoreSubscriber>();
  private hashTimer: number | null = null;

  constructor(initial: ForgeLabState) {
    this.state = { ...initial, passes: clonePasses(initial.passes) };
  }

  /** Live reference — read-only by convention. */
  get(): Readonly<ForgeLabState> {
    return this.state;
  }

  /** Detached copy for probes / persistence. */
  snapshot(): ForgeLabState {
    return { ...this.state, passes: clonePasses(this.state.passes) };
  }

  update(partial: Partial<ForgeLabState>): void {
    const next: ForgeLabState = { ...this.state, ...partial };
    if (partial.passes) next.passes = { ...this.state.passes, ...partial.passes };
    // view <-> abMode synchronization: ab modes are the same stage concept.
    if (partial.view && (AB_MODES as readonly string[]).includes(partial.view)) {
      next.abMode = partial.view as AbMode;
    }
    if (partial.abMode) next.view = partial.abMode;
    next.facing = (((Math.round(next.facing) % 8) + 8) % 8);
    next.speed = clamp(next.speed, 0.25, 4);
    next.wipePosition = clamp(Math.round(next.wipePosition), 0, 100);
    next.cameraHalfH = clamp(next.cameraHalfH, 1, 64);
    if (!isPublicAssetId(next.assetId)) next.assetId = DEFAULT_STATE.assetId;
    this.state = next;
    this.persist();
    for (const fn of [...this.subscribers]) {
      try {
        fn();
      } catch (err) {
        console.error('[forge-art/store] subscriber error', err);
      }
    }
  }

  subscribe(fn: StoreSubscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private persist(): void {
    if (this.hashTimer !== null) window.clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => {
      this.hashTimer = null;
      try {
        // Keep path + query (?sandbox=1 must survive hash updates).
        const url = `${window.location.pathname}${window.location.search}${canonicalHash(this.state)}`;
        window.history.replaceState(null, '', url);
      } catch {
        // some embedded contexts disallow history writes; hash still readable
      }
      try {
        window.sessionStorage.setItem(
          SS_KEY,
          JSON.stringify({ state: this.snapshot(), savedAt: Date.now() }),
        );
      } catch {
        // private mode / quota — persistence is best-effort
      }
    }, 120);
  }
}
