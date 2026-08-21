import type { Civ } from './engine';

export const FACTION_IDS = ['sunweaver', 'gravemark'] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export const MAP_IDS = ['helios-rift'] as const;
export type MapId = (typeof MAP_IDS)[number];

export const DIFFICULTY_IDS = ['cadet', 'standard', 'veteran'] as const;
export type Difficulty = (typeof DIFFICULTY_IDS)[number];

export const MATCH_SPEEDS = [0.75, 1, 1.25] as const;
export type MatchSpeed = (typeof MATCH_SPEEDS)[number];

export const TACTICAL_PAUSE_MODES = ['enabled', 'on-demand'] as const;
export type TacticalPauseMode = (typeof TACTICAL_PAUSE_MODES)[number];

export const SEED_MODES = ['deterministic', 'random'] as const;
export type SeedMode = (typeof SEED_MODES)[number];

export interface MatchConfig {
  readonly playerFaction: FactionId;
  readonly aiFaction: FactionId;
  readonly map: MapId;
  readonly difficulty: Difficulty;
  readonly fogOfWar: boolean;
  readonly speed: MatchSpeed;
  readonly tacticalPause: TacticalPauseMode;
  readonly seedMode: SeedMode;
  readonly seed: number;
}

export interface MatchConfigValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const DEFAULT_SEED = 0x5eed;

const DEFAULT_MATCH_CONFIG_BASE: MatchConfig = {
  playerFaction: 'sunweaver',
  aiFaction: 'gravemark',
  map: 'helios-rift',
  difficulty: 'standard',
  fogOfWar: true,
  speed: 1,
  tacticalPause: 'enabled',
  seedMode: 'random',
  seed: DEFAULT_SEED,
};

const QA_MATCH_CONFIG_BASE: MatchConfig = {
  ...DEFAULT_MATCH_CONFIG_BASE,
  seedMode: 'deterministic',
  seed: DEFAULT_SEED,
};

export const DEFAULT_MATCH_CONFIG: Readonly<MatchConfig> = Object.freeze(
  cloneMatchConfig(DEFAULT_MATCH_CONFIG_BASE),
);

export const QA_MATCH_CONFIG: Readonly<MatchConfig> = Object.freeze(
  cloneMatchConfig(QA_MATCH_CONFIG_BASE),
);

export function cloneMatchConfig(config: Readonly<MatchConfig>): MatchConfig {
  return { ...config };
}

function listIncludes(values: readonly unknown[], candidate: unknown): boolean {
  return values.includes(candidate);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFactionId(value: unknown): value is FactionId {
  return listIncludes(FACTION_IDS, value);
}

function isMapId(value: unknown): value is MapId {
  return listIncludes(MAP_IDS, value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return listIncludes(DIFFICULTY_IDS, value);
}

function isMatchSpeed(value: unknown): value is MatchSpeed {
  return listIncludes(MATCH_SPEEDS, value);
}

function isTacticalPauseMode(value: unknown): value is TacticalPauseMode {
  return listIncludes(TACTICAL_PAUSE_MODES, value);
}

function isSeedMode(value: unknown): value is SeedMode {
  return listIncludes(SEED_MODES, value);
}

export function validateMatchConfig(config: Readonly<MatchConfig>): MatchConfigValidationResult {
  const errors: string[] = [];

  const playerFactionKnown = isFactionId(config.playerFaction);
  const aiFactionKnown = isFactionId(config.aiFaction);

  if (!playerFactionKnown) {
    errors.push(`Invalid playerFaction "${String(config.playerFaction)}"; expected one of ${FACTION_IDS.join(', ')}.`);
  }
  if (!aiFactionKnown) {
    errors.push(`Invalid aiFaction "${String(config.aiFaction)}"; expected one of ${FACTION_IDS.join(', ')}.`);
  }
  if (playerFactionKnown && aiFactionKnown && config.playerFaction === config.aiFaction) {
    errors.push('playerFaction and aiFaction must be different factions.');
  }
  if (!isMapId(config.map)) {
    errors.push(`Invalid map "${String(config.map)}"; expected one of ${MAP_IDS.join(', ')}.`);
  }
  if (!isDifficulty(config.difficulty)) {
    errors.push(`Invalid difficulty "${String(config.difficulty)}"; expected one of ${DIFFICULTY_IDS.join(', ')}.`);
  }
  if (typeof config.fogOfWar !== 'boolean') {
    errors.push('fogOfWar must be a boolean.');
  }
  if (!isMatchSpeed(config.speed)) {
    errors.push(`Invalid speed ${String(config.speed)}; expected one of ${MATCH_SPEEDS.join(', ')}.`);
  }
  if (!isTacticalPauseMode(config.tacticalPause)) {
    errors.push(`Invalid tacticalPause "${String(config.tacticalPause)}"; expected one of ${TACTICAL_PAUSE_MODES.join(', ')}.`);
  }
  if (!isSeedMode(config.seedMode)) {
    errors.push(`Invalid seedMode "${String(config.seedMode)}"; expected one of ${SEED_MODES.join(', ')}.`);
  }
  if (!isFiniteNumber(config.seed)) {
    errors.push('seed must be a finite number.');
  }

  return { valid: errors.length === 0, errors };
}

export function normalizeMatchConfig(input: Partial<Readonly<MatchConfig>> = {}): MatchConfig {
  return {
    playerFaction: isFactionId(input.playerFaction) ? input.playerFaction : DEFAULT_MATCH_CONFIG.playerFaction,
    aiFaction: isFactionId(input.aiFaction) ? input.aiFaction : DEFAULT_MATCH_CONFIG.aiFaction,
    map: isMapId(input.map) ? input.map : DEFAULT_MATCH_CONFIG.map,
    difficulty: isDifficulty(input.difficulty) ? input.difficulty : DEFAULT_MATCH_CONFIG.difficulty,
    fogOfWar: typeof input.fogOfWar === 'boolean' ? input.fogOfWar : DEFAULT_MATCH_CONFIG.fogOfWar,
    speed: isMatchSpeed(input.speed) ? input.speed : DEFAULT_MATCH_CONFIG.speed,
    tacticalPause: isTacticalPauseMode(input.tacticalPause)
      ? input.tacticalPause
      : DEFAULT_MATCH_CONFIG.tacticalPause,
    seedMode: isSeedMode(input.seedMode) ? input.seedMode : DEFAULT_MATCH_CONFIG.seedMode,
    seed: isFiniteNumber(input.seed) ? input.seed : DEFAULT_MATCH_CONFIG.seed,
  };
}

const LEGACY_CIV_BY_FACTION: Readonly<Record<FactionId, string>> = {
  sunweaver: 'vespari',
  gravemark: 'aurion',
};

export function toLegacyCiv(faction: FactionId): Civ {
  return LEGACY_CIV_BY_FACTION[faction] as Civ;
}

export function fromLegacyCiv(civ: Civ): FactionId | null {
  const legacyName = typeof civ === 'string' ? civ : '';
  if (legacyName === 'vespari') {
    return 'sunweaver';
  }
  if (legacyName === 'aurion') {
    return 'gravemark';
  }
  return null;
}
