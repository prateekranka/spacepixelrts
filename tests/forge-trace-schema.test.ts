/**
 * FTR-TESTS RED — schema validation (docs/FORGE_TRACE.md §5).
 * Import surface frozen by the contract: validateTraceFile + serializeTrace
 * from ../src/forge-schema. These modules do not exist yet — this file is
 * expected to FAIL (module-not-found) until FTR-CORE lands.
 */
import assert from 'node:assert/strict';

import { validateTraceFile, serializeTrace } from '../src/forge-schema';
import { CHECKPOINT_EVENT_TYPES, DEFAULT_CAMERA_PRESET } from '../src/pacing-contract';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

function makeConfig(overrides: Partial<MatchConfig> = {}): MatchConfig {
  return normalizeMatchConfig({
    playerFaction: 'sunweaver',
    aiFaction: 'gravemark',
    map: 'helios-rift',
    difficulty: 'standard',
    fogOfWar: true,
    speed: 1,
    tacticalPause: 'enabled',
    seedMode: 'deterministic',
    seed: 24301,
    ...overrides,
  });
}

function makeFrameRef(tick: number, seed = 24301) {
  return {
    policyId: 'standard-opening',
    config: makeConfig(),
    seed,
    tick,
    perspective: 'player',
    camera: { ...DEFAULT_CAMERA_PRESET },
    selectedEntityIds: [] as number[],
  };
}

function makeEvent(seq: number, tick: number, type: string, overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    eventId: `evt-${seq}`,
    seq,
    tick,
    seconds: tick / 20,
    type,
    team: 'sunweaver',
    entityIds: [] as number[],
    payload: {},
    worldHash: (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(type) ? 'a1b2c3d4' : null,
    frameRef: makeFrameRef(tick),
    severity: 'info',
  };
  return { ...base, ...overrides };
}

function makeValidTrace(overrides: Record<string, unknown> = {}) {
  const events = [
    makeEvent(0, 0, 'match-start', { team: null }),
    makeEvent(1, 20, 'resource-sample', { team: 'sunweaver', payload: { ore: 220, gas: 40, energy: 90 } }),
    makeEvent(2, 20, 'resource-sample', { team: 'gravemark', payload: { ore: 220, gas: 40, energy: 90 } }),
    makeEvent(3, 20, 'population-sample', { team: 'sunweaver', payload: { pop: 0, cap: 0 } }),
    makeEvent(4, 20, 'population-sample', { team: 'gravemark', payload: { pop: 0, cap: 0 } }),
    makeEvent(5, 21600, 'match-terminal', { team: null, payload: { reason: 'time-cap' } }),
  ];
  const trace: Record<string, unknown> = {
    schemaVersion: 1,
    tool: 'forge-trace',
    createdAtNote: null,
    matchConfig: makeConfig(),
    policy: { id: 'standard-opening', identityHash: 'a1b2c3d4' },
    tickHz: 20,
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    terminalResult: { winner: null, tick: 21600, reason: 'time-cap' },
    checkpoints: [{ seq: 0, tick: 0, worldHash: 'a1b2c3d4' }],
    events,
  };
  return { ...trace, ...overrides };
}

function expectReject(fixture: unknown, keyword: RegExp, label: string): void {
  const result = validateTraceFile(fixture);
  assert.equal(result.valid, false, `${label}: must be rejected`);
  assert.ok(result.errors.length > 0, `${label}: rejection must carry errors`);
  const joined = result.errors.join('\n');
  assert.match(joined, keyword, `${label}: error names the problem (got: ${joined})`);
}

function main(): void {
  // --- Accept: a minimal fully-formed trace validates and round-trips. ---
  const minimal = makeValidTrace();
  assert.deepEqual(validateTraceFile(minimal), { valid: true }, 'valid minimal trace accepts');

  const serialized = serializeTrace(minimal);
  assert.equal(typeof serialized, 'string', 'serializeTrace returns a JSON string');
  const parsed = JSON.parse(serialized) as Record<string, unknown>;
  assert.equal(parsed.schemaVersion, 1, 'round-trip keeps schemaVersion');
  assert.equal(parsed.tool, 'forge-trace', 'round-trip keeps tool id');
  assert.equal(parsed.tickHz, 20, 'round-trip keeps tickHz');
  assert.equal((parsed.events as unknown[]).length, 6, 'round-trip keeps events');
  assert.equal((parsed.events as Record<string, unknown>[])[0].eventId, 'evt-0', 'round-trip keeps event ids');
  assert.deepEqual(validateTraceFile(parsed), { valid: true }, 'serialized output re-validates');

  // --- Reject: each malformed fixture fails with a named error, never a throw. ---
  const events = minimal.events as Record<string, unknown>[];

  expectReject(
    makeValidTrace({ schemaVersion: 2 }),
    /version/i,
    'wrong schemaVersion',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 1), { ...events[1], type: 'teleport' }, ...events.slice(2)],
    }),
    /type/i,
    'unknown event type',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 5), { ...events[5], seq: 7, eventId: 'evt-7' }],
    }),
    /seq/i,
    'seq gap',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 4), { ...events[4], seq: 3, eventId: 'evt-3' }],
    }),
    /seq/i,
    'seq duplicate',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 1), { ...events[1], tick: -20, seconds: -1 }, ...events.slice(2)],
    }),
    /tick/i,
    'negative tick',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 5), { ...events[5], tick: 10, seconds: 0.5 }],
    }),
    /tick/i,
    'tick monotonicity',
  );

  expectReject(
    makeValidTrace({
      matchConfig: { ...(minimal.matchConfig as MatchConfig), playerFaction: 'vespari' },
      playerFaction: 'vespari',
    }),
    /faction|canonical|legacy/i,
    'legacy faction id in matchConfig',
  );

  expectReject(
    makeValidTrace({
      events: [...events.slice(0, 1), { ...events[1], team: 'aurion' }, ...events.slice(2)],
    }),
    /faction|canonical|legacy/i,
    'legacy faction id as event team',
  );

  const noFrameRef = [...events];
  delete (noFrameRef[1] as Record<string, unknown>).frameRef;
  expectReject(makeValidTrace({ events: noFrameRef }), /frameRef/i, 'missing frameRef');

  expectReject(
    makeValidTrace({
      checkpoints: [{ seq: 0, tick: 0, worldHash: 'zzzz1234' }],
    }),
    /hash|hex/i,
    'non-hex checkpoint hash',
  );

  expectReject(
    makeValidTrace({
      events: [{ ...events[1], worldHash: 'not-a-hash' }, ...events.slice(2), events[0]],
    }),
    /hash|hex/i,
    'non-hex event worldHash on a checkpoint-class event',
  );

  expectReject(
    makeValidTrace({
      events: [
        { ...events[1], payload: { ore: 1, startedAt: '2026-08-26T12:00:00Z' } },
        ...events.slice(2),
        events[0],
      ],
    }),
    /wall.?clock|clock|timestamp|startedAt|time/i,
    'wall-clock field in payload',
  );

  expectReject(
    makeValidTrace({
      events: [{ ...events[1], payload: { ore: 1, bribes: true } }, ...events.slice(2), events[0]],
    }),
    /key|payload|extra|unknown/i,
    'unknown extra payload key',
  );

  // --- Never throw: partial/garbage inputs yield { valid: false } cleanly. ---
  const garbage = [null, undefined, 42, 'x', [], {}, { schemaVersion: 1 }, { events: [{ seq: 0 }] }];
  for (const bad of garbage) {
    let result: unknown;
    assert.doesNotThrow(() => {
      result = validateTraceFile(bad);
    }, 'validateTraceFile never throws on partial objects');
    const rejected = result as { valid: boolean; errors: string[] };
    assert.equal(rejected.valid, false, `garbage input ${JSON.stringify(bad)} rejects`);
    assert.ok(Array.isArray(rejected.errors), 'rejection carries an errors array');
  }
}

try {
  main();
  console.log('forge-trace-schema tests: PASS');
} catch (err) {
  console.error('forge-trace-schema tests: FAIL', err);
  process.exitCode = 1;
}
