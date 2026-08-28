import {
  DIFFICULTY_IDS,
  FACTION_IDS,
  type Difficulty,
  type FactionId,
} from './match-config';

/** Storage methods used by the profile adapter. This small shape also works in tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type MatchOutcome = 'win' | 'loss';

export interface MatchSummary {
  readonly id: string;
  readonly playedAt: string;
  readonly outcome: MatchOutcome;
  readonly playerFaction: FactionId;
  readonly opponentFaction: FactionId;
  readonly durationMs: number;
  readonly difficulty: Difficulty;
  readonly resourcesGathered: number;
  readonly unitsTrained: number;
  readonly unitsLost: number;
}

export interface PlayerProfile {
  readonly preferredFaction: FactionId;
  readonly matchesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly fastestVictoryMs: number | null;
  readonly recentMatches: readonly MatchSummary[];
  /** Durable duplicate protection. This is independent of the capped display history. */
  readonly recordedMatchIds: readonly string[];
  readonly unlockedAchievements: readonly string[];
  readonly lastSeenDispatchVersion: number;
}

/** The key is versioned so a future schema can migrate without reusing old data. */
export const PLAYER_PROFILE_STORAGE_KEY = 'starhaven.player-profile.v1';
export const PLAYER_PROFILE_SCHEMA_VERSION = 1;
/** Dispatch version zero means that the current dispatch has not been read yet. */
export const DEFAULT_DISPATCH_VERSION = 0;
export const CURRENT_DISPATCH_VERSION = 1;
export const DEFAULT_LAST_SEEN_DISPATCH_VERSION = DEFAULT_DISPATCH_VERSION;
export const MAX_RECENT_MATCHES = 20;

const DEFAULT_PROFILE: PlayerProfile = {
  preferredFaction: 'sunweaver',
  matchesPlayed: 0,
  wins: 0,
  losses: 0,
  fastestVictoryMs: null,
  recentMatches: [],
  recordedMatchIds: [],
  unlockedAchievements: [],
  lastSeenDispatchVersion: DEFAULT_LAST_SEEN_DISPATCH_VERSION,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFactionId(value: unknown): value is FactionId {
  return (FACTION_IDS as readonly unknown[]).includes(value);
}

function isDifficulty(value: unknown): value is Difficulty {
  return (DIFFICULTY_IDS as readonly unknown[]).includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || Number.isNaN(Date.parse(value))) {
    return false;
  }
  // Date-only and full ISO timestamps are both valid ISO date representations.
  return /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value);
}

function normalizeMatchSummary(input: unknown): MatchSummary | null {
  if (!isRecord(input)) {
    return null;
  }
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  if (
    id.length === 0 ||
    !isIsoDate(input.playedAt) ||
    (input.outcome !== 'win' && input.outcome !== 'loss') ||
    !isFactionId(input.playerFaction) ||
    !isFactionId(input.opponentFaction) ||
    !isNonNegativeInteger(input.durationMs) ||
    !isDifficulty(input.difficulty) ||
    !isNonNegativeInteger(input.resourcesGathered) ||
    !isNonNegativeInteger(input.unitsTrained) ||
    !isNonNegativeInteger(input.unitsLost)
  ) {
    return null;
  }
  return {
    id,
    playedAt: input.playedAt,
    outcome: input.outcome,
    playerFaction: input.playerFaction,
    opponentFaction: input.opponentFaction,
    durationMs: input.durationMs,
    difficulty: input.difficulty,
    resourcesGathered: input.resourcesGathered,
    unitsTrained: input.unitsTrained,
    unitsLost: input.unitsLost,
  };
}

function normalizeRecentMatches(value: unknown): MatchSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const matches: MatchSummary[] = [];
  const ids = new Set<string>();
  for (const candidate of value) {
    const match = normalizeMatchSummary(candidate);
    if (match === null || ids.has(match.id)) {
      continue;
    }
    ids.add(match.id);
    matches.push(match);
  }
  return matches.slice(-MAX_RECENT_MATCHES);
}

function normalizeAchievements(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const achievements: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const achievement = candidate.trim();
    if (achievement.length === 0 || seen.has(achievement)) {
      continue;
    }
    seen.add(achievement);
    achievements.push(achievement);
  }
  return achievements;
}

function normalizeRecordedMatchIds(value: unknown, recentMatches: readonly MatchSummary[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (typeof candidate !== 'string') continue;
      const id = candidate.trim();
      if (id.length === 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  for (const match of recentMatches) {
    if (seen.has(match.id)) continue;
    seen.add(match.id);
    ids.push(match.id);
  }
  return ids;
}

/** Return a fresh default profile. No returned array is shared between calls. */
export function createDefaultPlayerProfile(): PlayerProfile {
  return clonePlayerProfile(DEFAULT_PROFILE);
}

/** Deep clone a profile so callers can safely mutate their copy. */
export function clonePlayerProfile(profile: Readonly<PlayerProfile>): PlayerProfile {
  return {
    preferredFaction: profile.preferredFaction,
    matchesPlayed: profile.matchesPlayed,
    wins: profile.wins,
    losses: profile.losses,
    fastestVictoryMs: profile.fastestVictoryMs,
    recentMatches: profile.recentMatches.map((match) => ({ ...match })),
    recordedMatchIds: [...profile.recordedMatchIds],
    unlockedAchievements: [...profile.unlockedAchievements],
    lastSeenDispatchVersion: profile.lastSeenDispatchVersion,
  };
}

/** Normalize profile data from storage, including partial data from an older schema. */
export function normalizePlayerProfile(input: unknown): PlayerProfile {
  if (!isRecord(input)) {
    return createDefaultPlayerProfile();
  }

  const schemaVersion = input.schemaVersion;
  if (
    schemaVersion !== undefined &&
    (!isNonNegativeInteger(schemaVersion) || schemaVersion > PLAYER_PROFILE_SCHEMA_VERSION)
  ) {
    return createDefaultPlayerProfile();
  }

  const matchesPlayed = isNonNegativeInteger(input.matchesPlayed) ? input.matchesPlayed : 0;
  const wins = isNonNegativeInteger(input.wins) ? input.wins : 0;
  const losses = isNonNegativeInteger(input.losses) ? input.losses : 0;
  const fastestVictoryMs =
    input.fastestVictoryMs === null || input.fastestVictoryMs === undefined
      ? null
      : isNonNegativeInteger(input.fastestVictoryMs)
        ? input.fastestVictoryMs
        : null;

  const recentMatches = normalizeRecentMatches(input.recentMatches);
  return {
    preferredFaction: isFactionId(input.preferredFaction) ? input.preferredFaction : DEFAULT_PROFILE.preferredFaction,
    matchesPlayed: Math.max(matchesPlayed, wins + losses),
    wins,
    losses,
    fastestVictoryMs,
    recentMatches,
    recordedMatchIds: normalizeRecordedMatchIds(input.recordedMatchIds, recentMatches),
    unlockedAchievements: normalizeAchievements(input.unlockedAchievements),
    lastSeenDispatchVersion: isNonNegativeInteger(input.lastSeenDispatchVersion)
      ? input.lastSeenDispatchVersion
      : DEFAULT_LAST_SEEN_DISPATCH_VERSION,
  };
}

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }
  try {
    const candidate = globalThis.localStorage;
    return candidate === undefined ? null : candidate;
  } catch {
    return null;
  }
}

/** Load a profile. Missing, malformed, unavailable, or throwing storage returns defaults. */
export function loadPlayerProfile(storage?: StorageLike): PlayerProfile {
  const adapter = resolveStorage(storage);
  if (adapter === null) {
    return createDefaultPlayerProfile();
  }
  try {
    const raw = adapter.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (raw === null) {
      return createDefaultPlayerProfile();
    }
    const parsed: unknown = JSON.parse(raw);
    return normalizePlayerProfile(parsed);
  } catch {
    return createDefaultPlayerProfile();
  }
}

/** Save a normalized profile. The return value reports whether storage accepted the write. */
export function savePlayerProfile(profile: Readonly<PlayerProfile>, storage?: StorageLike): boolean {
  const adapter = resolveStorage(storage);
  if (adapter === null) {
    return false;
  }
  try {
    const normalized = normalizePlayerProfile(profile);
    adapter.setItem(
      PLAYER_PROFILE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION, ...normalized }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Set the preferred faction without mutating the input profile. */
export function setPreferredFaction(profile: Readonly<PlayerProfile>, faction: FactionId): PlayerProfile {
  const next = clonePlayerProfile(profile);
  if (isFactionId(faction)) {
    return { ...next, preferredFaction: faction };
  }
  return next;
}

/** Append one match, keep at most twenty entries, and ignore duplicate match IDs. */
export function appendRecentMatch(
  profile: Readonly<PlayerProfile>,
  summary: Readonly<MatchSummary>,
): PlayerProfile {
  const next = clonePlayerProfile(profile);
  const match = normalizeMatchSummary(summary);
  if (match === null || next.recordedMatchIds.includes(match.id)) {
    return next;
  }
  return {
    ...next,
    recentMatches: [...next.recentMatches, match].slice(-MAX_RECENT_MATCHES),
    recordedMatchIds: [...next.recordedMatchIds, match.id],
  };
}

/** Record a completed match and update counts and fastest victory. Duplicate IDs are ignored. */
export function recordMatch(
  profile: Readonly<PlayerProfile>,
  summary: Readonly<MatchSummary>,
): PlayerProfile {
  const match = normalizeMatchSummary(summary);
  const next = clonePlayerProfile(profile);
  if (match === null || next.recordedMatchIds.includes(match.id)) {
    return next;
  }

  const matchesPlayed = next.matchesPlayed + 1;
  let wins = next.wins;
  let losses = next.losses;
  let fastestVictoryMs = next.fastestVictoryMs;
  if (match.outcome === 'win') {
    wins += 1;
    if (fastestVictoryMs === null || match.durationMs < fastestVictoryMs) {
      fastestVictoryMs = match.durationMs;
    }
  } else {
    losses += 1;
  }
  return {
    ...next,
    matchesPlayed,
    wins,
    losses,
    fastestVictoryMs,
    recentMatches: [...next.recentMatches, match].slice(-MAX_RECENT_MATCHES),
    recordedMatchIds: [...next.recordedMatchIds, match.id],
  };
}

/** Mark a dispatch version as seen without mutating the input profile. */
export function markDispatchVersionSeen(
  profile: Readonly<PlayerProfile>,
  version = CURRENT_DISPATCH_VERSION,
): PlayerProfile {
  const next = clonePlayerProfile(profile);
  if (isNonNegativeInteger(version)) {
    return { ...next, lastSeenDispatchVersion: version };
  }
  return next;
}

export const markCurrentDispatchVersionSeen = markDispatchVersionSeen;
