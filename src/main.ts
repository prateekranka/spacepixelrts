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
  validateMatchConfig,
  type MatchConfig,
} from './match-config';
import { QA_SCENARIOS, parseQaScenario, type QaScenario } from './qa-scenarios';
import {
  clonePlayerProfile,
  loadPlayerProfile,
  markCurrentDispatchVersionSeen,
  recordMatch,
  savePlayerProfile,
  setPreferredFaction,
  type PlayerProfile,
} from './player-profile';
import { mountFrontEndScene, type FrontEndSceneController } from './front-end-scene';
import {
  createLoadingSegmentMarkup,
  loadingSegmentState,
  type LoadingStage,
} from './loading-segments';
import { resolveCombatOverride } from './generated/sunweaver-lumen-guard-candidate';
import type { CombatRowOverride } from './sprites';

const VERSION = '0.12.0-front-end';
const hostNode = document.getElementById('app');
if (!hostNode) throw new Error('Starhaven boot: #app host missing');
const host: HTMLElement = hostNode;

const params = new URLSearchParams(window.location.search);
const qaScenario = parseQaScenario(window.location.search);
const forgeReviewActive = import.meta.env.DEV && params.get('forge') === '1';
const qaFrozen = qaScenario !== undefined && params.get('qa-run') !== '1' && !forgeReviewActive;
const uiHidden = params.get('ui') === '0';
const qaHoldLoading = params.get('qa-hold-loading') === '1';

// Forge candidate seam (docs/LUMEN_GUARD_IMAGE_CANDIDATE.md): the optional
// ?forge-art-candidate=<id> query selects ONLY that candidate's combat row at
// atlas build time. Unknown/missing ids resolve to null -> accepted baseline.
// It is never the default: the normal route has no query and no override.
const forgeArtCandidateId: string | null = params.get('forge-art-candidate');
const combatRowOverrides: readonly CombatRowOverride[] | undefined = (() => {
  const override = resolveCombatOverride(forgeArtCandidateId);
  return override ? [override] : undefined;
})();
const orientationParam = params.get('orientation');
const orientation =
  orientationParam === 'landscape-right' ? 'landscape-right' : 'landscape-left';
document.documentElement.dataset.orientation = orientation;
document.documentElement.dataset.appState = 'Boot';

let activeScenario: QaScenario | null = qaScenario ?? null;
let playerProfile = loadPlayerProfile();
let activeConfig = qaScenario ? cloneMatchConfig(qaScenario.config) : normalBootConfig();
let world: World | null = null;
let view: GameRenderer | null = null;
let input: Input | null = null;
let hud: Hud | null = null;
let startScreen: StartScreen | null = null;
let loadingScreen: HTMLDivElement | null = null;
let loadingScene: FrontEndSceneController | null = null;
let loadingSceneReadyObserver: MutationObserver | null = null;
let matchResetCount = 0;
let matchStartInFlight = false;
let terminalStateDispatched = false;
let activeMatchId: string | null = null;
let activeMatchStartedAt = 0;
let hitSfx = 0;
let acc = 0;
/** FRD-2a — forge review freeze flag; only the review control ever sets it. */
let forgeFreezeRequested = false;
let registerForgeRendererHook: (() => void) | null = null;
let last = performance.now();
let fpsSmoothed = 60;
let frames = 0;
let fpsT = 0;
const frameWorkSamples = new Float32Array(120);
let frameWorkCount = 0;
let frameWorkHead = 0;
let p99FrameMs = 0;
const transitionHistory: AppState[] = ['Boot'];
const sfx = new Sfx();

const flow = new AppFlow({
  onTransition: (transition) => {
    transitionHistory.push(transition.to);
    syncPresentation(transition);
    if (transition.to === 'Victory') recordCompletedMatch('win');
    if (transition.to === 'Defeat') recordCompletedMatch('loss');
  },
});

function normalBootConfig(): MatchConfig {
  let config = normalizeMatchConfig({
    ...cloneMatchConfig(DEFAULT_MATCH_CONFIG),
    playerFaction: playerProfile.preferredFaction,
    aiFaction: playerProfile.preferredFaction === 'sunweaver' ? 'gravemark' : 'sunweaver',
  });
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

function resolveMatchConfig(config: MatchConfig): MatchConfig {
  const normalized = normalizeMatchConfig(config);
  if (normalized.seedMode === 'deterministic') {
    return { ...normalized, seed: normalized.seed >>> 0 };
  }
  const seed = new Uint32Array(1);
  crypto.getRandomValues(seed);
  return { ...normalized, seed: seed[0] || normalized.seed >>> 0 };
}

function applyCamera(): void {
  if (!input) return;
  const camera = activeScenario?.camera;
  input.pan.x = camera?.x ?? OPENING_CAMERA.x;
  input.pan.z = camera?.z ?? OPENING_CAMERA.z;
  input.halfH = camera?.halfH ?? OPENING_CAMERA.halfH;
}

function prepareMatch(config: MatchConfig): void {
  if (!world || !view || !input || !hud) {
    const nextWorld = new World();
    nextWorld.civ[0] = toLegacyCiv(config.playerFaction);
    nextWorld.civ[1] = toLegacyCiv(config.aiFaction);
    nextWorld.fogOfWarEnabled = config.fogOfWar;
    nextWorld.aiDifficulty = config.difficulty;
    nextWorld.reset(config.seed >>> 0);

    const nextView = new GameRenderer(
      host,
      combatRowOverrides !== undefined ? { combatRowOverrides } : undefined,
    );
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
      () => dispatchAppEvent('TOGGLE_PAUSE'),
      (event) => dispatchAppEvent(event),
    );
    nextHud.setPaused(false);
    nextHud.setVisible(!uiHidden);

    world = nextWorld;
    view = nextView;
    input = nextInput;
    hud = nextHud;
  } else {
    world.civ[0] = toLegacyCiv(config.playerFaction);
    world.civ[1] = toLegacyCiv(config.aiFaction);
    world.fogOfWarEnabled = config.fogOfWar;
    world.aiDifficulty = config.difficulty;
    world.reset(config.seed >>> 0);
    view.resetWorld(world);
    input.resetForMatch();
    hud.resetForMatch();
  }

  if (!world || !input || !hud) throw new Error('Starhaven match lifecycle incomplete');
  world.onHit = () => {
    sfx.hit();
    hitSfx++;
  };
  world.onMuzzle = () => sfx.muzzle();
  hitSfx = 0;
  acc = 0;
  terminalStateDispatched = false;
  applyCamera();
  matchResetCount++;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function startConfiguredMatch(config: MatchConfig): Promise<void> {
  if (matchStartInFlight || flow.state !== 'MatchSetup') return;
  const validation = validateMatchConfig(config);
  const seedValid = Number.isInteger(config.seed) && config.seed >= 0 && config.seed <= 0xffffffff;
  if (!validation.valid || !seedValid) return;

  activeScenario = null;
  activeConfig = resolveMatchConfig(config);
  activeMatchStartedAt = Date.now();
  activeMatchId = createMatchId(activeConfig.seed, activeMatchStartedAt);
  matchStartInFlight = true;
  const started = flow.dispatch('START_MATCH');
  if (!started.accepted) {
    activeMatchId = null;
    matchStartInFlight = false;
    return;
  }

  try {
    await nextAnimationFrame();
    await nextAnimationFrame();
    prepareMatch(activeConfig);
    markLoadingMatchReady();
    publish();
    await nextAnimationFrame();
    if (!qaHoldLoading) flow.dispatch('LOAD_READY');
  } catch (error) {
    console.error('Starhaven: match initialization failed', error);
    disconnectLoadingSceneObserver();
    flow.dispatch('LOAD_FAILED');
  } finally {
    matchStartInFlight = false;
  }
}

function syncPresentation(transition: TransitionResult): void {
  document.documentElement.dataset.appState = transition.to;
  const paused = transition.to === 'TacticalPause';
  hud?.setPaused(paused);
  hud?.setAppState(transition.to, activeConfig.difficulty);
  input?.setInteractive(transition.to === 'Playing' || transition.to === 'TacticalPause');
  if (transition.to === 'Loading') {
    startScreen?.destroy();
    startScreen = null;
    showLoadingScreen();
  }
  if (transition.from === 'Loading' && transition.to !== 'Loading') hideLoadingScreen();
  if (transition.to === 'MainMenu') {
    if (!startScreen) createStartScreen();
    startScreen?.showMainMenu();
  }
  if (transition.to === 'MatchSetup') {
    if (!startScreen) createStartScreen();
    startScreen?.showMatchSetup(activeConfig, true);
  }
  if (transition.to === 'Playing') hud?.setVisible(!uiHidden);
}

function showLoadingScreen(): void {
  if (loadingScreen) return;
  const faction = activeConfig.playerFaction === 'sunweaver' ? 'Sunweaver' : 'Gravemark';
  const difficulty = activeConfig.difficulty.charAt(0).toUpperCase() + activeConfig.difficulty.slice(1);
  const seedLabel = activeConfig.seedMode === 'deterministic'
    ? `Deterministic seed ${activeConfig.seed >>> 0}`
    : `Random seed ${activeConfig.seed >>> 0}`;
  const sigil = activeConfig.playerFaction === 'sunweaver'
    ? '/front-end-ui/icons/sunweaver-sigil.svg'
    : '/front-end-ui/icons/gravemark-sigil.svg';
  const root = document.createElement('div');
  root.className = 'front-loading-screen';
  root.dataset.civ = activeConfig.playerFaction;
  root.dataset.loadingScreenCreated = 'false';
  root.dataset.loadingSceneReady = 'false';
  root.dataset.loadingMatchReady = 'false';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-label', `Loading Helios Rift for ${faction}`);
  root.innerHTML = `
    <section class="front-loading-card" data-civ="${activeConfig.playerFaction}" aria-labelledby="front-loading-title">
      <div class="front-loading-content">
        <p class="front-loading-kicker">STARHAVEN // HELIOS RIFT</p>
        <h1 id="front-loading-title">PREPARING SKIRMISH</h1>
        <p class="front-loading-meta" data-loading-meta>
          <span data-loading-civilization>${faction}</span>
          <span aria-hidden="true"> · </span>
          <span data-loading-difficulty>${difficulty}</span>
          <span aria-hidden="true"> · </span>
          <span data-loading-seed>${seedLabel}</span>
        </p>
        <div class="front-loading-segment-track" data-loading-segments role="group" aria-label="Skirmish preparation stages">
          ${createLoadingSegmentMarkup()}
        </div>
        <p class="front-loading-tip" data-loading-tip>Survey the center before you commit your first production line.</p>
      </div>
      <span class="front-loading-sigil-cell" data-faction-sigil>
        <img class="front-loading-sigil px-image" src="${sigil}" alt="" aria-hidden="true" />
      </span>
    </section>`;
  host.append(root);
  loadingScreen = root;
  markLoadingScreenCreated();
  loadingScene = mountFrontEndScene(root, {
    faction: activeConfig.playerFaction,
    mode: 'loading',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  observeLoadingSceneReady();
}

function hideLoadingScreen(): void {
  disconnectLoadingSceneObserver();
  loadingScene?.destroy();
  loadingScene = null;
  loadingScreen?.remove();
  loadingScreen = null;
}

function disconnectLoadingSceneObserver(): void {
  loadingSceneReadyObserver?.disconnect();
  loadingSceneReadyObserver = null;
}

function setLoadingStage(stage: LoadingStage): void {
  if (!loadingScreen) return;
  const current = Number(loadingScreen.dataset.loadingStage || 0);
  const history = loadingScreen.dataset.loadingStageHistory?.split(',').filter(Boolean) ?? [];
  if (!history.includes(String(stage))) history.push(String(stage));
  loadingScreen.dataset.loadingStageHistory = history.join(',');
  if (stage < current) return;
  loadingScreen.dataset.loadingStage = String(stage);
  const segments = loadingScreen.querySelectorAll<HTMLElement>('.front-loading-segment');
  segments.forEach((segment, index) => {
    segment.dataset.state = loadingSegmentState(stage, index);
  });
}

function markLoadingScreenCreated(): void {
  if (!loadingScreen) return;
  loadingScreen.dataset.loadingScreenCreated = 'true';
  setLoadingStage(1);
}

function markLoadingSceneReady(): void {
  if (!loadingScreen) return;
  loadingScreen.dataset.loadingSceneReady = 'true';
  setLoadingStage(2);
}

function markLoadingMatchReady(): void {
  if (!loadingScreen) return;
  loadingScreen.dataset.loadingMatchReady = 'true';
  setLoadingStage(3);
}

function observeLoadingSceneReady(): void {
  disconnectLoadingSceneObserver();
  const sceneRoot = loadingScene?.root;
  if (!sceneRoot) return;
  const checkReady = (): void => {
    if (sceneRoot.dataset.artError && sceneRoot.dataset.artError !== 'loading') {
      disconnectLoadingSceneObserver();
      return;
    }
    if (sceneRoot.dataset.artReady === 'true') markLoadingSceneReady();
  };
  checkReady();
  loadingSceneReadyObserver = new MutationObserver(checkReady);
  loadingSceneReadyObserver.observe(sceneRoot, {
    attributes: true,
    attributeFilter: ['data-art-ready', 'data-art-error'],
  });
}

function dispatchAppEvent(event: AppEvent): TransitionResult {
  if (event === 'LOAD_READY' && !world) {
    try {
      prepareMatch(activeConfig);
      markLoadingMatchReady();
    } catch (error) {
      console.error('Starhaven: QA match initialization failed', error);
      disconnectLoadingSceneObserver();
      return flow.dispatch('LOAD_FAILED');
    }
  }
  if (event === 'LOAD_READY') markLoadingMatchReady();
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
      persistPreferredFaction(activeConfig.playerFaction);
      publish();
    },
    onStartMatch: (config) => {
      void startConfiguredMatch(config);
    },
    onPreferredFactionChange: (faction) => {
      activeConfig = normalizeMatchConfig({
        ...activeConfig,
        playerFaction: faction,
        aiFaction: faction === 'sunweaver' ? 'gravemark' : 'sunweaver',
      });
      persistPreferredFaction(faction);
      publish();
    },
    onDispatchesRead: () => {
      if (activeScenario !== null || qaScenario !== undefined) return;
      playerProfile = markCurrentDispatchVersionSeen(playerProfile);
      savePlayerProfile(playerProfile);
      startScreen?.setProfile(playerProfile);
      publish();
    },
  }, playerProfile);
}

function persistPreferredFaction(faction: MatchConfig['playerFaction']): void {
  if (activeScenario !== null || qaScenario !== undefined) return;
  playerProfile = setPreferredFaction(playerProfile, faction);
  savePlayerProfile(playerProfile);
  startScreen?.setProfile(playerProfile);
}

function createMatchId(seed: number, startedAt: number): string {
  return `helios-rift-${startedAt}-${seed >>> 0}-${matchResetCount + 1}`;
}

function recordCompletedMatch(outcome: 'win' | 'loss'): void {
  if (!world || activeMatchId === null || activeScenario !== null || qaScenario !== undefined) return;
  const stats = world.matchStats();
  const player = stats.teams[0];
  const resourcesGathered = Math.max(
    0,
    Math.round(player.resources.ore + player.resources.gas + player.resources.energy),
  );
  playerProfile = recordMatch(playerProfile, {
    id: activeMatchId,
    playedAt: new Date(activeMatchStartedAt).toISOString(),
    outcome,
    playerFaction: activeConfig.playerFaction,
    opponentFaction: activeConfig.aiFaction,
    durationMs: Math.max(0, Math.round(stats.tick * DT * 1000)),
    difficulty: activeConfig.difficulty,
    resourcesGathered,
    unitsTrained: Math.max(0, Math.round(player.unitsTrained)),
    unitsLost: Math.max(0, Math.round(player.unitsLost)),
  });
  savePlayerProfile(playerProfile);
  activeMatchId = null;
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
  if (flow.canAdvanceSimulation && world && !qaFrozen && !forgeFreezeRequested) {
    checkTerminalState();
    if (flow.canAdvanceSimulation) {
      acc += raw * activeConfig.speed;
      let steps = 0;
      while (flow.canAdvanceSimulation && acc >= DT && steps < 5) {
        world.step();
        acc -= DT;
        steps++;
        checkTerminalState();
      }
    } else {
      acc = 0;
    }
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
  readonly profile: PlayerProfile;
  readonly scenarios: readonly string[];
  readonly scenarioScaffolds: readonly { id: string; scaffold: boolean }[];
  readonly resetCount: number;
  readonly tick: number;
  readonly winner: number;
  readonly stats: ReturnType<World['matchStats']> | null;
  readonly fps: number;
  readonly p99FrameMs: number;
  readonly draws: number | null;
  readonly entities: number;
  readonly orientation: string;
  readonly frozen: boolean;
  readonly transitionHistory: readonly AppState[];
  readonly forgeArtCandidate: string | null;
  readonly discoveries: readonly {
    team: number;
    tick: number;
    id: number | string;
    kind: string;
    label: string;
    x: number;
    z: number;
  }[];
  readonly landmarks: readonly {
    id: string;
    kind: string;
    label: string;
    x: number;
    z: number;
    discoveredBy: number;
  }[];
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
    profile: clonePlayerProfile(playerProfile),
    scenarios: QA_SCENARIOS.map((scenario) => scenario.id),
    scenarioScaffolds: QA_SCENARIOS.map((scenario) => ({ id: scenario.id, scaffold: scenario.scaffold })),
    resetCount: matchResetCount,
    tick: world?.tick ?? 0,
    winner: world?.winner ?? -1,
    stats: world?.matchStats() ?? null,
    fps: fpsSmoothed,
    p99FrameMs: Math.round(p99FrameMs * 100) / 100,
    draws: rendererInfo?.drawn ?? null,
    entities: activeEntityCount(),
    orientation,
    frozen: qaFrozen,
    transitionHistory: transitionHistory.slice(),
    forgeArtCandidate: forgeArtCandidateId,
    discoveries: world?.discoveryLog.map((event) => ({ ...event })) ?? [],
    landmarks: world?.landmarks.map((landmark) => ({ ...landmark })) ?? [],
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
  registerForgeRendererHook?.();
}

const forgeReviewEnabled = forgeReviewActive;
if (forgeReviewEnabled) {
  forgeFreezeRequested = true;
  const bootSpecifier = `/${['src', 'dev', 'forge-install.ts'].join('/')}`;
  void import(/* @vite-ignore */ bootSpecifier).then(({ bootForgeReview }) =>
    bootForgeReview({
      getWorld: () => world,
      getInput: () => input,
      getView: () => view,
      getState: () => flow.state,
      getConfig: () => activeConfig,
      getScenario: () => activeScenario?.id ?? null,
      getHud: () => hud,
      getFps: () => fpsSmoothed,
      getP99FrameMs: () => Math.round(p99FrameMs * 100) / 100,
      setFreeze: (frozen: boolean) => {
        forgeFreezeRequested = frozen;
      },
      reloadWithParams: (mutate: (next: URLSearchParams) => void) => {
        const next = new URLSearchParams();
        for (const key of [
          'qa',
          'qa-seed',
          'qa-player-faction',
          'qa-ai-faction',
          'orientation',
          'ui',
          'fog',
          'forge',
          'forge-art-candidate',
        ]) {
          const value = params.get(key);
          if (value !== null) next.set(key, value);
        }
        mutate(next);
        window.location.search = next.toString();
      },
      registerRendererHook: (register: () => void) => {
        registerForgeRendererHook = register;
        register();
      },
    }),
  );
}

window.addEventListener('resize', () => {
  view?.resize(host.clientWidth, host.clientHeight);
});

console.log(`Starhaven ${VERSION} — deterministic First Playable flow`);
