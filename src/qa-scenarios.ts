import { type AppEvent, type AppState } from './app-flow';
import { type MatchConfig, QA_MATCH_CONFIG, cloneMatchConfig } from './match-config';

export type QaPrimaryRoute =
  | 'start-menu'
  | 'match-setup'
  | 'opening'
  | 'scouting'
  | 'tech-choice'
  | 'midgame-sunweaver'
  | 'midgame-gravemark'
  | 'battle'
  | 'victory';

export type QaSupplementalRoute =
  | 'loading'
  | 'tactical-pause'
  | 'defeat'
  | 'results';

export type QaRoute = QaPrimaryRoute | QaSupplementalRoute;

export interface QaCameraSpec {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly halfH: number;
}

export interface QaScenario {
  readonly id: QaRoute;
  readonly expectedState: AppState;
  readonly eventSequence: readonly AppEvent[];
  readonly config: MatchConfig;
  readonly camera: QaCameraSpec;
  readonly scaffold: boolean;
}

const START_MENU_SEQUENCE: readonly AppEvent[] = ['BOOT_READY'];
const MATCH_SETUP_SEQUENCE: readonly AppEvent[] = [...START_MENU_SEQUENCE, 'OPEN_SETUP'];
const LOADING_SEQUENCE: readonly AppEvent[] = [...MATCH_SETUP_SEQUENCE, 'START_MATCH'];
const PLAYING_SEQUENCE: readonly AppEvent[] = [...LOADING_SEQUENCE, 'LOAD_READY'];
const TACTICAL_PAUSE_SEQUENCE: readonly AppEvent[] = [...PLAYING_SEQUENCE, 'TOGGLE_PAUSE'];
const VICTORY_SEQUENCE: readonly AppEvent[] = [...PLAYING_SEQUENCE, 'MATCH_WON'];
const DEFEAT_SEQUENCE: readonly AppEvent[] = [...PLAYING_SEQUENCE, 'MATCH_LOST'];
const RESULTS_SEQUENCE: readonly AppEvent[] = [...VICTORY_SEQUENCE, 'CONTINUE'];

const gravemarkSwappedConfig = (): MatchConfig => {
  const config = cloneMatchConfig(QA_MATCH_CONFIG);
  return {
    ...config,
    playerFaction: config.aiFaction,
    aiFaction: config.playerFaction,
  };
};

const makeScenario = (
  id: QaRoute,
  expectedState: AppState,
  eventSequence: readonly AppEvent[],
  camera: QaCameraSpec,
  scaffold: boolean,
  config: MatchConfig = cloneMatchConfig(QA_MATCH_CONFIG),
): QaScenario => ({ id, expectedState, eventSequence, config, camera, scaffold });

export const QA_PRIMARY_ROUTES: readonly QaPrimaryRoute[] = [
  'start-menu',
  'match-setup',
  'opening',
  'scouting',
  'tech-choice',
  'midgame-sunweaver',
  'midgame-gravemark',
  'battle',
  'victory',
];

export const QA_SUPPLEMENTAL_ROUTES: readonly QaSupplementalRoute[] = [
  'loading',
  'tactical-pause',
  'defeat',
  'results',
];

export const QA_SCENARIOS: readonly QaScenario[] = [
  makeScenario('start-menu', 'MainMenu', START_MENU_SEQUENCE, { id: 'cam-start-menu', x: 36, z: 36, halfH: 24 }, true),
  makeScenario('match-setup', 'MatchSetup', MATCH_SETUP_SEQUENCE, { id: 'cam-match-setup', x: 36, z: 36, halfH: 28 }, true),
  makeScenario('opening', 'Playing', PLAYING_SEQUENCE, { id: 'cam-opening-base', x: 12, z: 12, halfH: 30 }, true),
  makeScenario('scouting', 'Playing', PLAYING_SEQUENCE, { id: 'cam-scouting-north', x: 24, z: 22, halfH: 34 }, true),
  makeScenario('tech-choice', 'Playing', PLAYING_SEQUENCE, { id: 'cam-tech-lab', x: 14, z: 14, halfH: 30 }, true),
  makeScenario('midgame-sunweaver', 'Playing', PLAYING_SEQUENCE, { id: 'cam-sunweaver-weave', x: 16, z: 16, halfH: 36 }, true),
  makeScenario(
    'midgame-gravemark',
    'Playing',
    PLAYING_SEQUENCE,
    { id: 'cam-gravemark-rift', x: 56, z: 56, halfH: 36 },
    true,
    gravemarkSwappedConfig(),
  ),
  makeScenario('battle', 'Playing', PLAYING_SEQUENCE, { id: 'cam-frontline-clash', x: 36, z: 38, halfH: 32 }, true),
  makeScenario('victory', 'Victory', VICTORY_SEQUENCE, { id: 'cam-victory-overlook', x: 56, z: 56, halfH: 40 }, true),
  makeScenario('loading', 'Loading', LOADING_SEQUENCE, { id: 'cam-loading-hold', x: 36, z: 36, halfH: 26 }, false),
  makeScenario('tactical-pause', 'TacticalPause', TACTICAL_PAUSE_SEQUENCE, { id: 'cam-tactical-freeze', x: 36, z: 36, halfH: 33 }, false),
  makeScenario('defeat', 'Defeat', DEFEAT_SEQUENCE, { id: 'cam-defeat-aftermath', x: 12, z: 12, halfH: 38 }, false),
  makeScenario('results', 'Results', RESULTS_SEQUENCE, { id: 'cam-results-summary', x: 36, z: 36, halfH: 42 }, false),
];

const QA_SCENARIO_INDEX: ReadonlyMap<QaRoute, QaScenario> = new Map<QaRoute, QaScenario>(
  QA_SCENARIOS.map((scenario): [QaRoute, QaScenario] => [scenario.id, scenario]),
);

export function getQaScenario(id: QaRoute): QaScenario | undefined {
  return QA_SCENARIO_INDEX.get(id);
}

const decodeQueryPart = (part: string): string => {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '));
  } catch {
    return part;
  }
};

const queryParam = (search: string, key: string): string | undefined => {
  const raw = search.startsWith('?') ? search.slice(1) : search.trim();
  for (const pair of raw.split('&')) {
    if (pair.length === 0) continue;
    const separator = pair.indexOf('=');
    const name = decodeQueryPart(separator === -1 ? pair : pair.slice(0, separator));
    if (name !== key) continue;
    return decodeQueryPart(separator === -1 ? '' : pair.slice(separator + 1));
  }
  return undefined;
};

export function parseQaScenario(search: string): QaScenario | undefined {
  const requested = queryParam(search, 'qa');
  const candidate = requested !== undefined ? requested : search;
  const id = candidate.trim().toLowerCase();
  if (id.length === 0) return undefined;
  return QA_SCENARIOS.find((scenario) => scenario.id === id);
}