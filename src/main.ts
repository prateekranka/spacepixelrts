/** Starhaven boot — explicit app flow, deterministic QA, landscape iPad. */

import { DT, Kind, MAP, MAX_ENTS } from './engine';
import type { Civ } from './engine';
import { World } from './sim';
import { GameRenderer } from './render';
import { Input } from './input';
import { Hud } from './hud';
import { Sfx } from './audio';
import { parseBootCiv } from './content';
import { OPENING_CAMERA } from './opening-presentation';
import { StartScreen } from './start-screen';
import { AppFlow, type AppEvent, type AppState, type TransitionResult } from './app-flow';
import {
  DEFAULT_MATCH_CONFIG,
  QA_MATCH_CONFIG,
  cloneMatchConfig,
  fromLegacyCiv,
  normalizeMatchConfig,
  toLegacyCiv,
  type MatchConfig,
} from './match-config';
import { QA_SCENARIOS, parseQaScenario, type QaScenario } from './qa-scenarios';

const VERSION = '0.10.0-m0';
const hostNode = document.getElementById('app');
if (!hostNode) throw new Error('Starhaven boot: #app host missing');
const host: HTMLElement = hostNode;

const params = new URLSearchParams(window.location.search);
const qaScenario = parseQaScenario(window.location.search);
const qaFrozen = qaScenario !== undefined && params.get('qa-run') !== '1';
const uiHidden = params.get('ui') === '0';
const orientationParam = params.get('orientation');
const orientation =
  orientationParam === 'landscape-right' ? 'landscape-right' : 'landscape-left';
document.documentElement.dataset.orientation = orientation;
document.documentElement.dataset.appState = 'Boot';

let activeScenario: QaScenario | null = qaScenario ?? null;
let activeConfig = qaScenario ? cloneMatchConfig(qaScenario.config) : normalBootConfig();
let world: World | null = null;
let view: GameRenderer | null = null;
let input: Input | null = null;
let hud: Hud | null = null;
let startScreen: StartScreen | null = null;
let loadingScreen: HTMLDivElement | null = null;
let matchResetCount = 0;
let terminalStateDispatched = false;
let hitSfx = 0;
let acc = 0;
let last = performance.now();
let fpsSmoothed = 60;
let frames = 0;
let fpsT = 0;
const frameWorkSamples = new Float32Array(120);
let frameWorkCount = 0;
let frameWorkHead = 0;
let p99FrameMs = 0;
const sfx = new Sfx();

const flow = new AppFlow({
  onTransition: (transition) => syncPresentation(transition),
});

function normalBootConfig(): MatchConfig {
  let config = cloneMatchConfig(DEFAULT_MATCH_CONFIG);
  const legacy = parseBootCiv(window.location.search);
  const canonical = legacy ? fromLegacyCiv(legacy) : null;
  if (canonical) {
    config = {
      ...config,
      playerFaction: canonical,
      aiFaction: canonical === 'sunweaver' ? 'gravemark' : 'sunweaver',
    };
  }
  const fog = params.get('fog');
  if (fog === '0' || fog === '1') config = { ...config, fogOfWar: fog === '1' };
  return normalizeMatchConfig(config);
}

function resolvedSeed(config: MatchConfig): number {
  if (config.seedMode === 'deterministic') return config.seed >>> 0;
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  return seed[0] || config.seed >>> 0;
}

function applyCamera(): void {
  if (!input) return;
  const camera = activeScenario?.camera;
  input.pan.x = camera?.x ?? OPENING_CAMERA.x;
  input.pan.z = camera?.z ?? OPENING_CAMERA.z;
  input.halfH = camera?.halfH ?? OPENING_CAMERA.halfH;
}

function prepareMatch(config: MatchConfig): void {
  if (world) throw new Error('M0 supports one initialized match per page load');
  const nextWorld = new World();
  nextWorld.civ[0] = toLegacyCiv(config.playerFaction);
  nextWorld.civ[1] = toLegacyCiv(config.aiFaction);
  nextWorld.fogOfWarEnabled = config.fogOfWar;
  nextWorld.reset(resolvedSeed(config));
  matchResetCount++;

  const nextView = new GameRenderer(host);
  nextView.init(nextWorld);
  nextView.resize(host.clientWidth, host.clientHeight);

  nextWorld.onHit = () => {
    sfx.hit();
    hitSfx++;
  };
  nextWorld.onMuzzle = () => sfx.muzzle();

  const nextInput = new Input(host, nextWorld, nextView, sfx);
  const nextHud = new Hud(host);
  nextHud.bind(
    nextWorld,
    nextInput,
    nextView,
    () => console.error('Starhaven: faction switching moves to MatchSetup in M1'),
    () => dispatchAppEvent('TOGGLE_PAUSE'),
  );
  nextHud.setPaused(false);
  nextHud.setVisible(!uiHidden);

  world = nextWorld;
  view = nextView;
  input = nextInput;
  hud = nextHud;
  hitSfx = 0;
  acc = 0;
  terminalStateDispatched = false;
  applyCamera();
}

function syncPresentation(transition: TransitionResult): void {
  document.documentElement.dataset.appState = transition.to;
  const paused = transition.to === 'TacticalPause';
  hud?.setPaused(paused);
  if (transition.to === 'Loading') {
    startScreen?.destroy();
    startScreen = null;
    showLoadingScreen();
  }
  if (transition.from === 'Loading' && transition.to !== 'Loading') hideLoadingScreen();
  if (transition.to === 'MainMenu') startScreen?.showMainMenu();
  if (transition.to === 'MatchSetup') startScreen?.showMatchSetup(activeConfig, false);
  if (transition.to === 'Playing') hud?.setVisible(!uiHidden);
}

function showLoadingScreen(): void {
  if (loadingScreen) return;
  const root = document.createElement('div');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div style="letter-spacing:.24em;font-size:12px;color:#bfc8d6">STARHAVEN // HELIOS RIFT</div>
    <strong style="font-size:clamp(28px,5vw,54px);font-weight:650">Preparing skirmish</strong>
    <div style="width:min(320px,55vw);height:3px;background:#202938;overflow:hidden">
      <span style="display:block;width:64%;height:100%;background:#52d7c7"></span>
    </div>`;
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '40',
    display: 'grid',
    placeContent: 'center',
    gap: '18px',
    padding: 'max(32px, env(safe-area-inset-top)) max(32px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(32px, env(safe-area-inset-left))',
    color: '#edf7f5',
    background: 'radial-gradient(circle at 50% 42%, #14283a 0%, #09121d 52%, #050911 100%)',
    textAlign: 'center',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  });
  host.append(root);
  loadingScreen = root;
}

function hideLoadingScreen(): void {
  loadingScreen?.remove();
  loadingScreen = null;
}

function dispatchAppEvent(event: AppEvent): TransitionResult {
  if (event === 'LOAD_READY' && !world) {
    try {
      prepareMatch(activeConfig);
    } catch (error) {
      console.error('Starhaven: QA match initialization failed', error);
      return flow.dispatch('LOAD_FAILED');
    }
  }
  return flow.dispatch(event);
}

function runQaScenario(scenario: QaScenario): void {
  activeScenario = scenario;
  activeConfig = cloneMatchConfig(scenario.config ?? QA_MATCH_CONFIG);
  for (const event of scenario.eventSequence) {
    const result = dispatchAppEvent(event);
    if (!result.accepted) throw new Error(`QA scenario ${scenario.id}: rejected ${event}`);
  }
  if (flow.state !== scenario.expectedState) {
    throw new Error(
      `QA scenario ${scenario.id}: expected ${scenario.expectedState}, got ${flow.state}`,
    );
  }
  applyCamera();
}

function createStartScreen(): void {
  startScreen = new StartScreen(host, {
    onNewSkirmish: () => dispatchAppEvent('OPEN_SETUP'),
    onBackToMenu: () => dispatchAppEvent('BACK'),
    onConfigChange: (config) => {
      activeConfig = normalizeMatchConfig(config);
      publish();
    },
    onStartMatch: () => {},
  });
}

createStartScreen();
if (qaScenario) runQaScenario(qaScenario);
else flow.dispatch('BOOT_READY');

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  if (flow.state !== 'Playing' && flow.state !== 'TacticalPause') return;
  event.preventDefault();
  dispatchAppEvent('TOGGLE_PAUSE');
});

function checkTerminalState(): void {
  if (!world || terminalStateDispatched || flow.state !== 'Playing') return;
  if (world.winner === 0) {
    terminalStateDispatched = true;
    flow.dispatch('MATCH_WON');
  } else if (world.winner === 1) {
    terminalStateDispatched = true;
    flow.dispatch('MATCH_LOST');
  }
}

function frame(now: number): void {
  const workStart = performance.now();
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsT += raw;
  frames++;
  if (fpsT >= 0.4) {
    fpsSmoothed = Math.round(frames / fpsT);
    frames = 0;
    fpsT = 0;
  }

  if (input && (flow.state === 'Playing' || flow.state === 'TacticalPause')) input.tick(raw);
  if (flow.canAdvanceSimulation && world && !qaFrozen) {
    acc += raw * activeConfig.speed;
    let steps = 0;
    while (acc >= DT && steps < 5) {
      world.step();
      acc -= DT;
      steps++;
    }
    checkTerminalState();
  } else {
    acc = 0;
  }

  if (world && view) view.draw(world, acc / DT, input?.selected ?? new Set<number>(), input?.box ?? null);
  if (world && input && hud) hud.draw(world, input, fpsSmoothed);
  recordFrameWork(performance.now() - workStart);
  publish();
}
requestAnimationFrame(frame);

function recordFrameWork(ms: number): void {
  frameWorkSamples[frameWorkHead] = ms;
  frameWorkHead = (frameWorkHead + 1) % frameWorkSamples.length;
  frameWorkCount = Math.min(frameWorkCount + 1, frameWorkSamples.length);
  const sorted = Array.from(frameWorkSamples.slice(0, frameWorkCount)).sort((a, b) => a - b);
  p99FrameMs = sorted[Math.max(0, Math.ceil(sorted.length * 0.99) - 1)] ?? 0;
}

interface StarhavenQaProbe {
  readonly version: string;
  readonly state: AppState;
  readonly scenario: string | null;
  readonly config: MatchConfig;
  readonly scenarios: readonly string[];
  readonly resetCount: number;
  readonly tick: number;
  readonly winner: number;
  readonly fps: number;
  readonly p99FrameMs: number;
  readonly draws: number | null;
  readonly entities: number;
  readonly orientation: string;
  readonly frozen: boolean;
  dispatch(event: AppEvent): TransitionResult;
}

interface LegacyProbe {
  version: string;
  tick: number;
  fps: number;
  ents: number;
  selected: number;
  teams: World['teams'] | [];
  civ: Civ[];
  rendererInfo: ReturnType<GameRenderer['info']> | null;
  map: number;
  max: number;
  hall: Kind;
  winner: number;
  hitSfx: number;
  screen: 'start' | 'match';
  matchStarted: boolean;
  paused: boolean;
}

interface StarhavenWindow extends Window {
  __STARHAVEN_QA__?: StarhavenQaProbe;
  __SPACEPIXEL__?: LegacyProbe;
  __STARHOLD__?: LegacyProbe;
  __STARHOLD_INPUT__?: Input;
  __STARHOLD_VIEW__?: GameRenderer;
  __STARHOLD_WORLD__?: World;
}
const appWindow = window as StarhavenWindow;

function activeEntityCount(): number {
  if (!world) return 0;
  return world.ents.reduce((count, entity) => count + (entity.alive ? 1 : 0), 0);
}

function publish(): void {
  const rendererInfo = view?.info() ?? null;
  const qaProbe: StarhavenQaProbe = {
    version: VERSION,
    state: flow.state,
    scenario: activeScenario?.id ?? null,
    config: cloneMatchConfig(activeConfig),
    scenarios: QA_SCENARIOS.map((scenario) => scenario.id),
    resetCount: matchResetCount,
    tick: world?.tick ?? 0,
    winner: world?.winner ?? -1,
    fps: fpsSmoothed,
    p99FrameMs: Math.round(p99FrameMs * 100) / 100,
    draws: rendererInfo?.drawn ?? null,
    entities: activeEntityCount(),
    orientation,
    frozen: qaFrozen,
    dispatch: dispatchAppEvent,
  };
  appWindow.__STARHAVEN_QA__ = Object.freeze(qaProbe);

  const legacy: LegacyProbe = {
    version: VERSION,
    tick: world?.tick ?? 0,
    fps: fpsSmoothed,
    ents: activeEntityCount(),
    selected: input?.selected.size ?? 0,
    teams: world?.teams ?? [],
    civ: world ? world.civ.slice(0, 2) : [],
    rendererInfo,
    map: MAP,
    max: MAX_ENTS,
    hall: Kind.Hall,
    winner: world?.winner ?? -1,
    hitSfx,
    screen: flow.state === 'MainMenu' || flow.state === 'MatchSetup' ? 'start' : 'match',
    matchStarted: world !== null,
    paused: flow.state === 'TacticalPause',
  };
  appWindow.__SPACEPIXEL__ = legacy;
  appWindow.__STARHOLD__ = legacy;
  if (input) appWindow.__STARHOLD_INPUT__ = input;
  if (view) appWindow.__STARHOLD_VIEW__ = view;
  if (world) appWindow.__STARHOLD_WORLD__ = world;
}

window.addEventListener('resize', () => {
  view?.resize(host.clientWidth, host.clientHeight);
});

console.log(`Starhaven ${VERSION} — deterministic First Playable flow`);
