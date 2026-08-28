import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_DISPATCH_VERSION,
  DEFAULT_DISPATCH_VERSION,
  MAX_RECENT_MATCHES,
  PLAYER_PROFILE_SCHEMA_VERSION,
  PLAYER_PROFILE_STORAGE_KEY,
  appendRecentMatch,
  createDefaultPlayerProfile,
  loadPlayerProfile,
  markDispatchVersionSeen,
  normalizePlayerProfile,
  recordMatch,
  savePlayerProfile,
  setPreferredFaction,
  type MatchSummary,
  type StorageLike,
} from '../src/player-profile';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function summary(id: string, outcome: MatchSummary['outcome'] = 'win', durationMs = 12_000): MatchSummary {
  return {
    id,
    playedAt: '2026-08-24T12:00:00.000Z',
    outcome,
    playerFaction: 'sunweaver',
    opponentFaction: 'gravemark',
    durationMs,
    difficulty: 'standard',
    resourcesGathered: 120,
    unitsTrained: 8,
    unitsLost: 2,
  };
}

test('defaults are independent and use an unread dispatch version', () => {
  const first = createDefaultPlayerProfile();
  const second = createDefaultPlayerProfile();
  assert.equal(first.preferredFaction, 'sunweaver');
  assert.equal(first.lastSeenDispatchVersion, DEFAULT_DISPATCH_VERSION);
  assert.equal(first.fastestVictoryMs, null);
  assert.notEqual(first.recentMatches, second.recentMatches);
  assert.notEqual(first.recordedMatchIds, second.recordedMatchIds);
  assert.notEqual(first.unlockedAchievements, second.unlockedAchievements);
});

test('normalization accepts partial older data and drops invalid entries', () => {
  const profile = normalizePlayerProfile({
    preferredFaction: 'gravemark',
    wins: 2,
    recentMatches: [summary('ok'), { id: '' }, summary('ok')],
    unlockedAchievements: ['first-win', 'first-win', 4],
  });
  assert.equal(profile.preferredFaction, 'gravemark');
  assert.equal(profile.matchesPlayed, 2);
  assert.deepEqual(profile.recentMatches.map((match) => match.id), ['ok']);
  assert.deepEqual(profile.recordedMatchIds, ['ok']);
  assert.deepEqual(profile.unlockedAchievements, ['first-win']);
  assert.deepEqual(normalizePlayerProfile('{bad json}'), createDefaultPlayerProfile());
  assert.deepEqual(normalizePlayerProfile({ schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION + 1 }), createDefaultPlayerProfile());
});

test('storage adapter fails closed and writes one versioned key', () => {
  const storage = new MemoryStorage();
  const profile = recordMatch(createDefaultPlayerProfile(), summary('one'));
  assert.equal(savePlayerProfile(profile, storage), true);
  assert.equal(storage.values.size, 1);
  assert.ok(storage.values.has(PLAYER_PROFILE_STORAGE_KEY));
  assert.deepEqual(loadPlayerProfile(storage), profile);

  storage.values.set(PLAYER_PROFILE_STORAGE_KEY, '{bad json}');
  assert.deepEqual(loadPlayerProfile(storage), createDefaultPlayerProfile());
  assert.deepEqual(loadPlayerProfile(), createDefaultPlayerProfile());
});

test('helpers do not mutate input, cap history, and de-duplicate IDs', () => {
  let profile = createDefaultPlayerProfile();
  const preferred = setPreferredFaction(profile, 'gravemark');
  assert.equal(profile.preferredFaction, 'sunweaver');
  assert.equal(preferred.preferredFaction, 'gravemark');

  profile = appendRecentMatch(profile, summary('one'));
  const duplicate = appendRecentMatch(profile, summary('one', 'loss'));
  assert.equal(duplicate.recentMatches.length, 1);
  assert.equal(duplicate.recentMatches[0]?.outcome, 'win');

  for (let index = 0; index < MAX_RECENT_MATCHES + 2; index += 1) {
    profile = appendRecentMatch(profile, summary(`id-${index}`));
  }
  assert.equal(profile.recentMatches.length, MAX_RECENT_MATCHES);
  assert.equal(profile.recentMatches[0]?.id, 'id-2');
  assert.equal(profile.recordedMatchIds.length, MAX_RECENT_MATCHES + 3);
});

test('recordMatch updates aggregates and fastest victory once per ID', () => {
  const initial = createDefaultPlayerProfile();
  const won = recordMatch(initial, summary('win', 'win', 9000));
  const lost = recordMatch(won, summary('loss', 'loss', 2000));
  const duplicate = recordMatch(lost, summary('win', 'win', 1000));
  assert.equal(initial.matchesPlayed, 0);
  assert.deepEqual(won, { ...initial, matchesPlayed: 1, wins: 1, fastestVictoryMs: 9000, recentMatches: [summary('win', 'win', 9000)], recordedMatchIds: ['win'] });
  assert.equal(lost.matchesPlayed, 2);
  assert.equal(lost.wins, 1);
  assert.equal(lost.losses, 1);
  assert.equal(lost.fastestVictoryMs, 9000);
  assert.deepEqual(duplicate, lost);
});

test('recordMatch rejects an ID after it leaves the capped display history', () => {
  let profile = createDefaultPlayerProfile();
  for (let index = 0; index < MAX_RECENT_MATCHES + 1; index += 1) {
    profile = recordMatch(profile, summary(`match-${index}`));
  }
  assert.equal(profile.recentMatches.some((match) => match.id === 'match-0'), false);
  const duplicate = recordMatch(profile, summary('match-0', 'loss'));
  assert.deepEqual(duplicate, profile);
});

test('dispatch helper marks the current version without mutation', () => {
  const initial = createDefaultPlayerProfile();
  const seen = markDispatchVersionSeen(initial);
  assert.equal(initial.lastSeenDispatchVersion, DEFAULT_DISPATCH_VERSION);
  assert.equal(seen.lastSeenDispatchVersion, CURRENT_DISPATCH_VERSION);
});
