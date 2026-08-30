// Starhaven Forge Review Workbench — injected dev sidebar.
//
// Standalone module: runs on ANY page (game pages included). It detects the
// typed forge review control (window.__STARHAVEN_FORGE__, installed only under
// the DEV && forge=1 guard by src/dev/review-control.ts) and, when present,
// injects the workbench UI into document.body as fixed-position overlays:
//   - left control sidebar (300px, collapsible via the FORGE toggle tab)
//   - identity banner (top center, 4Hz)
//   - live perf chip (bottom right, 1Hz)
//   - frozen panes strip (bottom center) holding captured cell identities
//
// Hard rules (docs/FORGE_REVIEW_DECK.md):
//   - No game module imports; the control is accessed structurally, typed
//     in-file against the frozen interface. Compiles standalone under tsc.
//   - All state reads flow through the control's snapshot()/metrics(). No
//     poking of __STARHOLD_INPUT__/__STARHOLD_VIEW__/__STARHOLD_WORLD__.
//   - Reading window.__STARHAVEN_QA__.scenarios (route id list) is allowed.
//   - The workbench never fakes screenshots: the capture button stores the
//     current cell identity and defers pixels to the forge:review:capture CLI.

import './style.css';

/* ------------------------------------------------------------------ */
/* Structural types — mirror of the FROZEN interface in                */
/* docs/FORGE_REVIEW_DECK.md ("Typed review-control interface").       */
/* Kept intentionally local so this file never imports game modules.   */
/* ------------------------------------------------------------------ */

type ForgePerspective = 'player' | 'rival' | 'omniscient';
type ForgeCameraMode = 'normal' | 'tactical-close' | 'strategic-far';
type ForgeOverlayId = 'paths' | 'hit-regions' | 'line-of-sight' | 'orders' | 'facing' | 'entity-ids';
type ForgeOrientation = 'landscape-left' | 'landscape-right';
type ForgeFaction = 'sunweaver' | 'gravemark';

interface ForgeMatchConfig {
  readonly playerFaction: string;
  readonly aiFaction: string;
  readonly map: string;
  readonly difficulty: string;
  readonly fogOfWar: boolean;
  readonly speed: number | string;
  readonly tacticalPause?: string;
  readonly seedMode?: string;
  readonly seed?: number;
}

interface ForgeReviewSnapshot {
  scenario: string | null;
  requestedSeed: number | null; // what was asked (URL/control), null if n/a
  actualSeed: number; // >>>0 resolved config seed
  config: ForgeMatchConfig;
  state: string;
  tick: number;
  perspective: ForgePerspective;
  cameraMode: ForgeCameraMode;
  camera: { x: number; z: number; halfH: number };
  selection: number[];
  uiVisible: boolean;
  reviewFog: boolean; // false = omniscient-style fog display, true = real fog per perspective
  overlays: Record<ForgeOverlayId, boolean>;
  frozen: boolean;
  liveEntities: number;
  totalEntitySlots: number;
  rendererInfo: { calls: number; triangles: number; points: number; lines: number } | null;
}

interface ForgeMetrics {
  fps: number;
  gameWorkP99Ms: number;
  rafP99Ms: number;
}

interface ForgeReviewControl {
  snapshot(): ForgeReviewSnapshot;
  setRoute(id: string): Promise<void>; // reload-bearing
  setOrientation(o: ForgeOrientation): Promise<void>; // reload-bearing
  setFactions(player: ForgeFaction, rival: ForgeFaction): Promise<void>; // reload-bearing
  setSeed(seed: number): Promise<void>; // reload-bearing; deterministic mode
  setPerspective(p: ForgePerspective): void; // display-only
  setCameraMode(m: ForgeCameraMode): void; // presets: normal=scenario/default, close halfH 5, far halfH 18
  setCamera(x: number, z: number): void;
  setUiVisible(v: boolean): void;
  setReviewFog(v: boolean): void;
  selectIds(ids: number[]): void;
  selectScout(): void;
  clearSelection(): void;
  setFrozen(v: boolean): void;
  step(ticks: number): void; // advances frozen sim deterministically, max 600/call
  setOverlay(id: ForgeOverlayId, on: boolean): void;
  metrics(): ForgeMetrics;
}

// Structural shim for the globals the workbench reads. Deliberately NOT an
// `extends Window` interface: src/dev/review-control.ts augments Window with
// __STARHAVEN_FORGE__ (real MatchConfig types), which would make a re-declared
// property here structurally incompatible when both files compile together
// (tsconfig.forge.json). Casting through `unknown` keeps this file standalone
// AND compatible with the augmentation.
interface ForgeWindowShim {
  __STARHAVEN_FORGE__?: ForgeReviewControl;
  __STARHAVEN_QA__?: { scenarios?: readonly string[] };
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const PANEL_ROOT_ID = 'forge-panel-root';
const LAST_IDENTITY_KEY = 'forge.lastIdentity';
const SEED_MAX = 4294967295; // 2^32 - 1

// Full QA route id list (mirrors src/qa-scenarios.ts; used only as a fallback
// when window.__STARHAVEN_QA__.scenarios is unavailable at inject time).
const FALLBACK_ROUTES: readonly string[] = [
  'start-menu',
  'match-setup',
  'opening',
  'scouting',
  'tech-choice',
  'midgame-sunweaver',
  'midgame-gravemark',
  'battle',
  'victory',
  'loading',
  'tactical-pause',
  'defeat',
  'results',
];

const PERSPECTIVES: readonly { value: ForgePerspective; label: string }[] = [
  { value: 'player', label: 'player' },
  { value: 'rival', label: 'rival-knowledge' },
  { value: 'omniscient', label: 'omniscient' },
];

const CAMERA_MODES: readonly { value: ForgeCameraMode; label: string }[] = [
  { value: 'normal', label: 'normal' },
  { value: 'tactical-close', label: 'tactical-close' },
  { value: 'strategic-far', label: 'strategic-far' },
];

const OVERLAY_IDS: readonly ForgeOverlayId[] = [
  'paths',
  'hit-regions',
  'line-of-sight',
  'orders',
  'facing',
  'entity-ids',
];

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/* ------------------------------------------------------------------ */
/* Small DOM helpers                                                   */
/* ------------------------------------------------------------------ */

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function fmtNum(value: unknown, digits = 1): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : String(value ?? 'n/a');
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string): HTMLElement {
  const sec = el('section', 'fr-section');
  sec.appendChild(el('h2', undefined, title));
  return sec;
}

function field(labelText: string, controlEl: HTMLElement, id?: string): HTMLElement {
  const wrap = el('div', 'fr-field');
  const label = el('label', undefined, labelText);
  if (id) label.setAttribute('for', id);
  wrap.appendChild(label);
  wrap.appendChild(controlEl);
  return wrap;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function radioGroup(
  name: string,
  legend: string,
  options: readonly { value: string; label: string }[],
  getValue: () => string,
  onChange: (value: string) => void,
): HTMLElement {
  const fieldset = el('fieldset', 'fr-radios');
  const legendEl = el('legend', undefined, legend);
  fieldset.appendChild(legendEl);
  for (const option of options) {
    const label = el('label', 'fr-radio');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = option.value;
    input.checked = getValue() === option.value;
    input.addEventListener('change', () => {
      if (input.checked) onChange(option.value);
    });
    label.appendChild(input);
    label.appendChild(document.createTextNode(option.label));
    fieldset.appendChild(label);
  }
  return fieldset;
}

/* ------------------------------------------------------------------ */
/* Workbench state                                                     */
/* ------------------------------------------------------------------ */

interface Workbench {
  root: HTMLElement;
  control: ForgeReviewControl;
  routeSelect: HTMLSelectElement;
  seedInput: HTMLInputElement;
  seedApply: HTMLButtonElement;
  actualSeedReadout: HTMLElement;
  orientButtons: Record<ForgeOrientation, HTMLButtonElement>;
  factionPlayer: HTMLSelectElement;
  factionRival: HTMLSelectElement;
  perspectiveGroup: HTMLElement;
  cameraModeGroup: HTMLElement;
  camX: HTMLInputElement;
  camZ: HTMLInputElement;
  camApply: HTMLButtonElement;
  camReadout: HTMLElement;
  uiVisibleCheck: HTMLInputElement;
  reviewFogCheck: HTMLInputElement;
  selectScoutBtn: HTMLButtonElement;
  clearSelectionBtn: HTMLButtonElement;
  selectionStatus: HTMLElement;
  freezeBtn: HTMLButtonElement;
  stepButtons: HTMLButtonElement[];
  tickReadout: HTMLElement;
  entsReadout: HTMLElement;
  overlayChecks: Record<ForgeOverlayId, HTMLInputElement>;
  captureBtn: HTMLButtonElement;
  banner: HTMLElement;
  perfChip: HTMLElement;
  strip: HTMLElement;
  toast: HTMLElement;
  toastTimer: number | undefined;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function init(): void {
  const forgeWindow = window as unknown as ForgeWindowShim;
  const control = forgeWindow.__STARHAVEN_FORGE__;

  if (document.getElementById(PANEL_ROOT_ID)) return; // idempotent (HMR safety)
  // Capture mode: forge-control without the injected UI, so proof-pack
  // screenshots show the pure game view (forge:review:capture passes this).
  if (new URLSearchParams(window.location.search).get('forge-panel') === '0') return;

  const root = el('div');
  root.id = PANEL_ROOT_ID;
  root.setAttribute('data-forge-panel', 'true');
  (document.body ?? document.documentElement).appendChild(root);

  if (!control) {
    // Honest fallback: control absent -> banner + stop. No timers, no UI.
    const unavailable = el('div');
    unavailable.id = 'forge-unavailable';
    unavailable.setAttribute('data-forge-unavailable', 'true');
    unavailable.textContent = 'FORGE REVIEW CONTROL UNAVAILABLE — open with ?forge=1 under vite dev';
    root.appendChild(unavailable);
    return;
  }

  wbRef = buildWorkbench(root, control);
  refreshAll(wbRef);
  refreshPerf(wbRef);
  window.setInterval(() => refreshAll(wbRef), 250); // banner + live readouts @4Hz
  window.setInterval(() => refreshPerf(wbRef), 1000); // perf chip @1Hz
}

/* ------------------------------------------------------------------ */
/* Workbench construction                                              */
/* ------------------------------------------------------------------ */

function buildWorkbench(root: HTMLElement, control: ForgeReviewControl): Workbench {
  // Toggle tab (collapsible).
  const toggle = button('', 'FORGE', () => {
    root.classList.toggle('collapsed');
  });
  toggle.id = 'forge-toggle';
  toggle.title = 'toggle forge review sidebar';
  root.appendChild(toggle);

  // Sidebar.
  const sidebar = el('aside');
  sidebar.id = 'forge-sidebar';
  root.appendChild(sidebar);

  const header = el('div');
  header.id = 'forge-header';
  header.appendChild(el('h1', undefined, 'FORGE REVIEW'));
  header.appendChild(el('span', 'fr-sub', 'dev workbench'));
  sidebar.appendChild(header);

  /* ---- ROUTE ---- */
  const routeSection = section('route');
  const routeSelect = document.createElement('select');
  routeSelect.id = 'forge-route';
  routeSelect.setAttribute('data-fr-route', 'true');
  const win = window as unknown as ForgeWindowShim;
  const routeIds = win.__STARHAVEN_QA__?.scenarios ?? FALLBACK_ROUTES;
  for (const id of routeIds) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id;
    routeSelect.appendChild(option);
  }
  routeSelect.addEventListener('change', () => {
    const id = routeSelect.value;
    void control.setRoute(id).then(
      () => refreshAll(wbRef),
      (err: unknown) => toast(wbRef, `setRoute failed: ${String(err)}`),
    );
  });
  routeSection.appendChild(field('route', routeSelect, 'forge-route'));
  sidebar.appendChild(routeSection);

  /* ---- SEEDS ---- */
  const seedSection = section('seeds');
  const seedInput = document.createElement('input');
  seedInput.id = 'forge-seed-input';
  seedInput.type = 'number';
  seedInput.min = '0';
  seedInput.max = String(SEED_MAX);
  seedInput.step = '1';
  seedInput.setAttribute('data-fr-seed-input', 'true');
  const seedApply = button('fr-primary', 'APPLY', () => applySeed(wbRef));
  seedApply.id = 'forge-seed-apply';
  seedApply.setAttribute('data-fr-seed-apply', 'true');
  const seedRow = field('seed', seedInput, 'forge-seed-input');
  seedRow.appendChild(seedApply);
  seedSection.appendChild(seedRow);
  const actualSeedReadout = el('div', 'fr-readout');
  actualSeedReadout.id = 'forge-actual-seed';
  actualSeedReadout.setAttribute('data-fr-actual-seed', 'true');
  seedSection.appendChild(actualSeedReadout);
  seedSection.appendChild(el('div', 'fr-hint', 'deterministic mode: requested vs actual must match (hard gate)'));
  sidebar.appendChild(seedSection);

  /* ---- ORIENTATION ---- */
  const orientSection = section('orientation');
  const orientRow = el('div', 'fr-btn-row');
  const orientButtons = {
    'landscape-left': button('', 'LANDSCAPE-L', () => applyOrientation(wbRef, 'landscape-left')),
    'landscape-right': button('', 'LANDSCAPE-R', () => applyOrientation(wbRef, 'landscape-right')),
  };
  orientButtons['landscape-left'].setAttribute('data-fr-orientation', 'landscape-left');
  orientButtons['landscape-right'].setAttribute('data-fr-orientation', 'landscape-right');
  orientRow.appendChild(orientButtons['landscape-left']);
  orientRow.appendChild(orientButtons['landscape-right']);
  orientSection.appendChild(orientRow);
  sidebar.appendChild(orientSection);

  /* ---- FACTIONS ---- */
  const factionSection = section('factions');
  const factionPlayer = factionSelect('forge-faction-player', 'player');
  const factionRival = factionSelect('forge-faction-rival', 'rival');
  factionSection.appendChild(field('player', factionPlayer, 'forge-faction-player'));
  factionSection.appendChild(field('rival', factionRival, 'forge-faction-rival'));
  const applyFactions = () => {
    const player = factionPlayer.value;
    const rival = factionRival.value;
    if (player === 'sunweaver' || player === 'gravemark') {
      if (rival === 'sunweaver' || rival === 'gravemark') {
        void control.setFactions(player as ForgeFaction, rival as ForgeFaction).then(
          () => refreshAll(wbRef),
          (err: unknown) => toast(wbRef, `setFactions failed: ${String(err)}`),
        );
      }
    }
  };
  factionPlayer.addEventListener('change', applyFactions);
  factionRival.addEventListener('change', applyFactions);
  sidebar.appendChild(factionSection);

  /* ---- PERSPECTIVE ---- */
  const perspectiveSection = section('perspective');
  const perspectiveGroup = radioGroup(
    'forge-perspective',
    'perspective (display-only)',
    PERSPECTIVES,
    () => wbRef ? wbRef.perspectiveGroup.getAttribute('data-current') ?? 'player' : 'player',
    (value) => {
      control.setPerspective(value as ForgePerspective);
      refreshAll(wbRef);
    },
  );
  for (const option of PERSPECTIVES) {
    const input = perspectiveGroup.querySelector<HTMLInputElement>(`input[value="${option.value}"]`);
    if (input) input.setAttribute('data-fr-perspective', option.value);
  }
  perspectiveSection.appendChild(perspectiveGroup);
  sidebar.appendChild(perspectiveSection);

  /* ---- CAMERA MODE ---- */
  const cameraSection = section('camera');
  const cameraModeGroup = radioGroup(
    'forge-camera-mode',
    'mode (normal / close halfH 5 / far halfH 18)',
    CAMERA_MODES,
    () => wbRef ? wbRef.cameraModeGroup.getAttribute('data-current') ?? 'normal' : 'normal',
    (value) => {
      control.setCameraMode(value as ForgeCameraMode);
      refreshAll(wbRef);
    },
  );
  for (const option of CAMERA_MODES) {
    const input = cameraModeGroup.querySelector<HTMLInputElement>(`input[value="${option.value}"]`);
    if (input) input.setAttribute('data-fr-camera-mode', option.value);
  }
  cameraSection.appendChild(cameraModeGroup);
  const camX = document.createElement('input');
  camX.id = 'forge-cam-x';
  camX.type = 'number';
  camX.step = 'any';
  camX.setAttribute('data-fr-cam-x', 'true');
  const camZ = document.createElement('input');
  camZ.id = 'forge-cam-z';
  camZ.type = 'number';
  camZ.step = 'any';
  camZ.setAttribute('data-fr-cam-z', 'true');
  const camApply = button('', 'APPLY', () => applyCamera(wbRef));
  camApply.id = 'forge-cam-apply';
  camApply.setAttribute('data-fr-cam-apply', 'true');
  const camRow = field('x / z', camX, 'forge-cam-x');
  camRow.appendChild(camZ);
  camRow.appendChild(camApply);
  cameraSection.appendChild(camRow);
  const camReadout = el('div', 'fr-readout');
  camReadout.id = 'forge-cam-readout';
  cameraSection.appendChild(camReadout);
  sidebar.appendChild(cameraSection);

  /* ---- UI VISIBILITY ---- */
  const uiSection = section('game ui');
  const uiVisibleCheck = document.createElement('input');
  uiVisibleCheck.type = 'checkbox';
  uiVisibleCheck.id = 'forge-ui-visible';
  uiVisibleCheck.setAttribute('data-fr-ui-visible', 'true');
  const uiRow = el('label', 'fr-check-row');
  uiRow.appendChild(uiVisibleCheck);
  uiRow.appendChild(document.createTextNode('show game UI'));
  uiVisibleCheck.addEventListener('change', () => {
    control.setUiVisible(uiVisibleCheck.checked);
    refreshAll(wbRef);
  });
  uiSection.appendChild(uiRow);
  sidebar.appendChild(uiSection);

  /* ---- FOG ---- */
  const fogSection = section('fog');
  const reviewFogCheck = document.createElement('input');
  reviewFogCheck.type = 'checkbox';
  reviewFogCheck.id = 'forge-review-fog';
  reviewFogCheck.setAttribute('data-fr-review-fog', 'true');
  const fogRow = el('label', 'fr-check-row');
  fogRow.appendChild(reviewFogCheck);
  fogRow.appendChild(document.createTextNode('review fog display (real fog per perspective)'));
  reviewFogCheck.addEventListener('change', () => {
    control.setReviewFog(reviewFogCheck.checked);
    refreshAll(wbRef);
  });
  fogSection.appendChild(fogRow);
  sidebar.appendChild(fogSection);

  /* ---- SELECTION ---- */
  const selectionSection = section('selection');
  const selectionRow = el('div', 'fr-btn-row');
  const selectScoutBtn = button('fr-primary', 'SELECT SCOUT', () => {
    control.selectScout();
    refreshAll(wbRef);
  });
  selectScoutBtn.id = 'forge-select-scout';
  selectScoutBtn.setAttribute('data-fr-select-scout', 'true');
  const clearSelectionBtn = button('', 'CLEAR', () => {
    control.clearSelection();
    refreshAll(wbRef);
  });
  clearSelectionBtn.id = 'forge-clear-selection';
  selectionRow.appendChild(selectScoutBtn);
  selectionRow.appendChild(clearSelectionBtn);
  selectionSection.appendChild(selectionRow);
  const selectionStatus = el('div', 'fr-status');
  selectionStatus.id = 'forge-selection';
  selectionSection.appendChild(selectionStatus);
  sidebar.appendChild(selectionSection);

  /* ---- SIMULATION ---- */
  const simSection = section('simulation');
  const freezeBtn = button('fr-danger', 'FREEZE', () => {
    let frozen = false;
    try {
      frozen = control.snapshot().frozen;
    } catch (err) {
      toast(wbRef, `snapshot failed: ${String(err)}`);
      return;
    }
    control.setFrozen(!frozen);
    refreshAll(wbRef);
  });
  freezeBtn.id = 'forge-freeze';
  freezeBtn.setAttribute('data-fr-freeze', 'true');
  const stepRow = el('div', 'fr-btn-row');
  const stepButtons: HTMLButtonElement[] = [];
  for (const n of [1, 20, 200]) {
    const stepBtn = button('', `STEP ${n}`, () => {
      control.step(n);
      refreshAll(wbRef);
    });
    stepBtn.setAttribute('data-fr-step', String(n));
    stepBtn.disabled = true; // enabled by refresh when frozen
    stepRow.appendChild(stepBtn);
    stepButtons.push(stepBtn);
  }
  simSection.appendChild(field('', freezeBtn));
  simSection.appendChild(stepRow);
  const tickReadout = el('div', 'fr-readout');
  tickReadout.id = 'forge-tick';
  tickReadout.setAttribute('data-fr-tick', 'true');
  tickReadout.textContent = 'tick —';
  simSection.appendChild(field('tick', tickReadout));
  const entsReadout = el('div', 'fr-status');
  entsReadout.id = 'forge-ents';
  simSection.appendChild(entsReadout);
  sidebar.appendChild(simSection);

  /* ---- OVERLAYS ---- */
  const overlaySection = section('overlays');
  const overlayChecks = {} as Record<ForgeOverlayId, HTMLInputElement>;
  for (const id of OVERLAY_IDS) {
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.id = `forge-overlay-${id}`;
    check.setAttribute('data-fr-overlay', id);
    const row = el('label', 'fr-check-row');
    row.appendChild(check);
    row.appendChild(document.createTextNode(id));
    check.addEventListener('change', () => {
      control.setOverlay(id, check.checked);
      refreshAll(wbRef);
    });
    overlaySection.appendChild(row);
    overlayChecks[id] = check;
  }
  sidebar.appendChild(overlaySection);

  /* ---- CAPTURE ---- */
  const captureSection = section('capture');
  const captureBtn = button('fr-primary', 'SNAPSHOT CELL', () => captureIdentity(wbRef));
  captureBtn.id = 'forge-capture';
  captureBtn.setAttribute('data-fr-capture', 'true');
  captureSection.appendChild(captureBtn);
  captureSection.appendChild(
    el('div', 'fr-hint', 'stores this cell’s identity; pixels come from forge:review:capture CLI'),
  );
  sidebar.appendChild(captureSection);

  /* ---- floating surfaces ---- */
  const banner = el('div');
  banner.id = 'forge-banner';
  banner.setAttribute('data-forge-banner', 'true');
  banner.setAttribute('aria-live', 'off');
  root.appendChild(banner);

  const perfChip = el('div');
  perfChip.id = 'forge-perf';
  perfChip.setAttribute('data-forge-perf', 'true');
  root.appendChild(perfChip);

  const strip = el('div');
  strip.id = 'forge-strip';
  strip.setAttribute('data-forge-strip', 'true');
  root.appendChild(strip);

  const toastEl = el('div');
  toastEl.id = 'forge-toast';
  toastEl.setAttribute('role', 'status');
  root.appendChild(toastEl);

  const wb: Workbench = {
    root,
    control,
    routeSelect,
    seedInput,
    seedApply,
    actualSeedReadout,
    orientButtons,
    factionPlayer,
    factionRival,
    perspectiveGroup,
    cameraModeGroup,
    camX,
    camZ,
    camApply,
    camReadout,
    uiVisibleCheck,
    reviewFogCheck,
    selectScoutBtn,
    clearSelectionBtn,
    selectionStatus,
    freezeBtn,
    stepButtons,
    tickReadout,
    entsReadout,
    overlayChecks,
    captureBtn,
    banner,
    perfChip,
    strip,
    toast: toastEl,
    toastTimer: undefined,
  };
  wbRef = wb;
  renderStrip(wb);
  return wb;
}

function factionSelect(id: string, labelText: string): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = id;
  select.setAttribute('aria-label', labelText);
  for (const faction of ['sunweaver', 'gravemark']) {
    const option = document.createElement('option');
    option.value = faction;
    option.textContent = faction;
    select.appendChild(option);
  }
  return select;
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function applySeed(wb: Workbench): void {
  const raw = wb.seedInput.value.trim();
  if (!/^\d+$/.test(raw)) {
    toast(wb, 'seed must be an integer 0..4294967295');
    return;
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0 || n > SEED_MAX) {
    toast(wb, `seed out of range 0..${SEED_MAX}`);
    return;
  }
  void wb.control.setSeed(n).then(
    () => refreshAll(wb),
    (err: unknown) => toast(wb, `setSeed failed: ${String(err)}`),
  );
}

function applyOrientation(wb: Workbench, orientation: ForgeOrientation): void {
  void wb.control.setOrientation(orientation).then(
    () => refreshAll(wb),
    (err: unknown) => toast(wb, `setOrientation failed: ${String(err)}`),
  );
}

function applyCamera(wb: Workbench): void {
  const x = Number(wb.camX.value);
  const z = Number(wb.camZ.value);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    toast(wb, 'camera x/z must be numbers');
    return;
  }
  wb.control.setCamera(x, z);
  refreshAll(wb);
}

function captureIdentity(wb: Workbench): void {
  let snap: ForgeReviewSnapshot;
  try {
    snap = wb.control.snapshot();
  } catch (err) {
    toast(wb, `snapshot failed: ${String(err)}`);
    return;
  }
  const metrics = wb.control.metrics ? wb.control.metrics() : null;
  const identity = {
    tool: 'forge-review-workbench',
    capturedAt: new Date().toISOString(),
    scenario: snap.scenario,
    requestedSeed: snap.requestedSeed,
    actualSeed: snap.actualSeed,
    seedMatch: snap.requestedSeed == null ? null : snap.requestedSeed === snap.actualSeed,
    state: snap.state,
    tick: snap.tick,
    perspective: snap.perspective,
    cameraMode: snap.cameraMode,
    camera: { x: snap.camera.x, z: snap.camera.z, halfH: snap.camera.halfH },
    selection: snap.selection.slice(),
    frozen: snap.frozen,
    uiVisible: snap.uiVisible,
    reviewFog: snap.reviewFog,
    overlays: { ...snap.overlays },
    config: {
      playerFaction: snap.config.playerFaction,
      aiFaction: snap.config.aiFaction,
      map: snap.config.map,
      difficulty: snap.config.difficulty,
      speed: snap.config.speed,
      fogOfWar: snap.config.fogOfWar,
    },
    metrics,
  };
  try {
    localStorage.setItem(LAST_IDENTITY_KEY, JSON.stringify(identity));
  } catch (err) {
    toast(wb, `identity store failed: ${String(err)}`);
    return;
  }
  toast(wb, 'identity stored — use forge:review:capture CLI for pixels');
  renderStrip(wb);
}

/* ------------------------------------------------------------------ */
/* Refresh loops                                                       */
/* ------------------------------------------------------------------ */

function snapshotSafe(wb: Workbench): ForgeReviewSnapshot | null {
  try {
    return wb.control.snapshot();
  } catch (err) {
    toast(wb, `snapshot failed: ${String(err)}`);
    return null;
  }
}

function refreshAll(wb: Workbench): void {
  const snap = snapshotSafe(wb);
  if (!snap) return;
  const focused = document.activeElement;

  // Route select (skip while the user is interacting with it).
  if (snap.scenario && focused !== wb.routeSelect) {
    wb.routeSelect.value = snap.scenario;
  }

  // Seed readouts: requested vs actual, red on mismatch.
  const requested = snap.requestedSeed;
  const mismatch = requested != null && requested !== snap.actualSeed;
  wb.actualSeedReadout.textContent =
    requested == null
      ? `requested n/a · actual ${snap.actualSeed}`
      : `requested ${requested} · actual ${snap.actualSeed}${mismatch ? ' · MISMATCH' : ''}`;
  wb.actualSeedReadout.classList.toggle('fr-mismatch', mismatch);
  wb.actualSeedReadout.classList.toggle('fr-dim', requested == null);

  // Orientation buttons (derived from URL; snapshot has no orientation field).
  const orientation = orientationFromUrl();
  for (const key of ['landscape-left', 'landscape-right'] as const) {
    wb.orientButtons[key].classList.toggle('fr-active', orientation === key);
  }

  // Faction selects (skip while focused).
  if (focused !== wb.factionPlayer) wb.factionPlayer.value = snap.config.playerFaction;
  if (focused !== wb.factionRival) wb.factionRival.value = snap.config.aiFaction;

  // Perspective + camera mode radios (skip while focused).
  wb.perspectiveGroup.setAttribute('data-current', snap.perspective);
  syncRadios(wb.perspectiveGroup, snap.perspective, focused);
  wb.cameraModeGroup.setAttribute('data-current', snap.cameraMode);
  syncRadios(wb.cameraModeGroup, snap.cameraMode, focused);

  // Camera readout.
  wb.camReadout.textContent = `x ${fmtNum(snap.camera.x, 0)} · z ${fmtNum(snap.camera.z, 0)} · halfH ${fmtNum(snap.camera.halfH, 0)}`;

  // UI visibility + review fog.
  if (focused !== wb.uiVisibleCheck) wb.uiVisibleCheck.checked = snap.uiVisible;
  if (focused !== wb.reviewFogCheck) wb.reviewFogCheck.checked = snap.reviewFog;

  // Selection status: count + first ids.
  const ids = snap.selection.slice(0, 8).map(String).join(', ');
  const more = snap.selection.length > 8 ? ', …' : '';
  wb.selectionStatus.innerHTML = `selected <b>${snap.selection.length}</b>: <span>${esc(ids)}${more}</span>`;

  // Simulation: freeze toggle + step buttons (only legal while frozen).
  wb.freezeBtn.textContent = snap.frozen ? 'UNFREEZE' : 'FREEZE';
  wb.freezeBtn.classList.toggle('fr-active', snap.frozen);
  for (const stepBtn of wb.stepButtons) {
    stepBtn.disabled = !snap.frozen;
    stepBtn.title = snap.frozen ? 'step frozen sim' : 'freeze the sim to step';
  }
  wb.tickReadout.textContent = `tick ${snap.tick}`;
  wb.entsReadout.textContent = `ents ${snap.liveEntities}/${snap.totalEntitySlots} · draws ${snap.rendererInfo ? snap.rendererInfo.calls : 'n/a'}`;

  // Overlay checkboxes.
  for (const id of OVERLAY_IDS) {
    const check = wb.overlayChecks[id];
    if (focused !== check) check.checked = Boolean(snap.overlays[id]);
  }

  // Identity banner.
  wb.banner.innerHTML = bannerHtml(snap);
}

function syncRadios(group: HTMLElement, value: string, focused: Element | null): void {
  for (const input of Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]'))) {
    if (focused !== input) input.checked = input.value === value;
  }
}

function refreshPerf(wb: Workbench): void {
  let metrics: ForgeMetrics | null = null;
  try {
    metrics = wb.control.metrics ? wb.control.metrics() : null;
  } catch {
    metrics = null;
  }
  if (!metrics) {
    wb.perfChip.textContent = 'fps — · gameP99 — · rafP99 —';
    return;
  }
  wb.perfChip.innerHTML =
    `fps <b>${fmtNum(metrics.fps, 1)}</b> · gameP99 <b>${fmtNum(metrics.gameWorkP99Ms, 2)}ms</b>` +
    ` · rafP99 <b>${fmtNum(metrics.rafP99Ms, 2)}ms</b>`;
}

function bannerHtml(snap: ForgeReviewSnapshot): string {
  const requested = snap.requestedSeed;
  const mismatch = requested != null && requested !== snap.actualSeed;
  const seedText =
    requested == null
      ? `seed req n/a · act ${snap.actualSeed}`
      : `seed req ${requested} · act ${snap.actualSeed}${mismatch ? ' · MISMATCH' : ''}`;
  const cfg = snap.config;
  const cfgBits = [
    `${esc(cfg.playerFaction)} vs ${esc(cfg.aiFaction)}`,
    esc(cfg.map),
    esc(cfg.difficulty),
    `x${esc(cfg.speed)}`,
    cfg.fogOfWar ? 'fog:on' : 'fog:off',
  ].join(' · ');
  const cam = snap.camera;
  return (
    `<span class="fr-b-scenario">${esc(snap.scenario ?? '—')} [${esc(snap.state)}]</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-seed${mismatch ? ' fr-mismatch' : ''}">${esc(seedText)}</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-cfg">${cfgBits}</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-tick">tick ${snap.tick}</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-persp">${esc(snap.perspective)}</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-cam">cam ${esc(snap.cameraMode)} ${fmtNum(cam.x, 0)}/${fmtNum(cam.z, 0)}/${fmtNum(cam.halfH, 0)}</span>` +
    `<span class="fr-b-sep">|</span>` +
    `<span class="fr-b-sel">sel ${snap.selection.length}</span>`
  );
}

/* ------------------------------------------------------------------ */
/* Frozen panes strip                                                  */
/* ------------------------------------------------------------------ */

function renderStrip(wb: Workbench): void {
  wb.strip.textContent = '';
  let stored: unknown = null;
  try {
    const raw = localStorage.getItem(LAST_IDENTITY_KEY);
    if (raw) stored = JSON.parse(raw) as unknown;
  } catch {
    stored = null;
  }
  if (stored && typeof stored === 'object') {
    const pane = el('div', 'fr-pane');
    pane.setAttribute('data-forge-pane', 'identity');
    const clear = button('fr-pane-clear', '✕', () => {
      try {
        localStorage.removeItem(LAST_IDENTITY_KEY);
      } catch {
        /* storage unavailable — ignore */
      }
      renderStrip(wb);
    });
    clear.title = 'clear stored identity';
    pane.appendChild(clear);
    pane.appendChild(el('div', 'fr-pane-title', 'last captured cell'));
    pane.appendChild(el('div', 'fr-pane-line', identityLine(stored)));
    pane.appendChild(el('div', 'fr-pane-note', 'pixels: forge:review:capture CLI'));
    wb.strip.appendChild(pane);
  } else {
    const pane = el('div', 'fr-pane');
    pane.setAttribute('data-forge-pane', 'empty');
    pane.appendChild(el('div', 'fr-pane-title', 'frozen panes'));
    pane.appendChild(el('div', 'fr-pane-note', 'no captured cell yet — press SNAPSHOT CELL'));
    wb.strip.appendChild(pane);
  }
}

function identityLine(identity: unknown): string {
  const id = identity as Record<string, unknown>;
  const scenario = typeof id.scenario === 'string' ? id.scenario : '?';
  const req = id.requestedSeed == null ? 'n/a' : String(id.requestedSeed);
  const act = String(id.actualSeed ?? '?');
  const tick = String(id.tick ?? '?');
  const persp = String(id.perspective ?? '?');
  return `${scenario} · seed ${req}=${act} · tick ${tick} · ${persp}`;
}

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

function toast(wb: Workbench, message: string): void {
  wb.toast.textContent = message;
  wb.toast.classList.add('show');
  if (wb.toastTimer !== undefined) window.clearTimeout(wb.toastTimer);
  wb.toastTimer = window.setTimeout(() => {
    wb.toast.classList.remove('show');
  }, 3500);
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function orientationFromUrl(): ForgeOrientation {
  const raw = new URLSearchParams(window.location.search).get('orientation');
  return raw === 'landscape-right' ? 'landscape-right' : 'landscape-left';
}

// Handlers built during construction reference the assembled workbench; the
// definite-assignment assertion is safe because no handler can fire before
// buildWorkbench returns.
let wbRef!: Workbench;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
