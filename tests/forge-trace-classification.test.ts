/**
 * FTR-TESTS RED — failure classification (docs/FORGE_TRACE.md §9, §12).
 * Synthetic minimal-but-valid trace files craft the evidence for each failure
 * id: deadline-miss, starvation, idle-production, hidden-targeting,
 * early-attack, impossible-positive-delta, repeated-rejections, no-terminal.
 * detectMilestones(events) feeds classifyFailures(trace, milestones); each
 * fixture must yield exactly its classification id(s), and a clean trace must
 * yield an empty list.
 */
import assert from 'node:assert/strict';

import { detectMilestones, classifyFailures } from '../src/forge-diagnostics';
import {
  PATH_LOCK_BY_TICK,
  STARVATION_WINDOW_TICKS,
  IDLE_PRODUCTION_WINDOW_TICKS,
  REJECTED_CALL_BURST,
  REJECTED_CALL_WINDOW_TICKS,
  ATTACK_FLOOR_TICK,
  HONEST_STEP_GAIN_BOUND,
  CHECKPOINT_EVENT_TYPES,
  DEFAULT_CAMERA_PRESET,
} from '../src/pacing-contract';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

interface Spec {
  tick: number;
  type: string;
  team?: string | null;
  entityIds?: number[];
  payload?: Record<string, unknown>;
}

function makeConfig(): MatchConfig {
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
  });
}

function buildEvents(specs: Spec[]): Record<string, unknown>[] {
  return specs.map((spec, seq) => {
    const tick = spec.tick;
    return {
      eventId: `evt-${seq}`,
      seq,
      tick,
      seconds: tick / 20,
      type: spec.type,
      team: spec.team === undefined ? 'sunweaver' : spec.team,
      entityIds: spec.entityIds ?? [],
      payload: spec.payload ?? {},
      worldHash: (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(spec.type) ? 'a1b2c3d4' : null,
      frameRef: {
        policyId: 'standard-opening',
        config: makeConfig(),
        seed: 24301,
        tick,
        perspective: 'player',
        camera: { ...DEFAULT_CAMERA_PRESET },
        selectedEntityIds: [],
      },
      severity: 'info',
    };
  });
}

function makeTrace(events: Record<string, unknown>[], terminalResult: Record<string, unknown> | null): Record<string, unknown> {
  return {
    schemaVersion: 1,
    tool: 'forge-trace',
    createdAtNote: null,
    matchConfig: makeConfig(),
    policy: { id: 'standard-opening', identityHash: 'a1b2c3d4' },
    tickHz: 20,
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    terminalResult,
    checkpoints: [{ seq: 0, tick: 0, worldHash: 'a1b2c3d4' }],
    events,
  };
}

/** Constant/rising per-second resource samples for a team across [start, end]. */
function resourceSamples(start: number, end: number, team: string, oreAt: (tick: number) => number): Spec[] {
  const specs: Spec[] = [];
  for (let tick = start; tick <= end; tick += 20) {
    specs.push({ tick, type: 'resource-sample', team, payload: { ore: oreAt(tick), gas: 10, energy: 10 } });
  }
  return specs;
}

function populationSamples(start: number, end: number, team: string, pop: number, cap: number): Spec[] {
  const specs: Spec[] = [];
  for (let tick = start; tick <= end; tick += 20) {
    specs.push({ tick, type: 'population-sample', team, payload: { pop, cap } });
  }
  return specs;
}

function classify(events: Spec[], terminalResult: Record<string, unknown> | null): string[] {
  const built = buildEvents(events);
  const milestones = detectMilestones(built);
  const result = classifyFailures(makeTrace(built, terminalResult), milestones);
  assert.ok(Array.isArray(result), 'classifyFailures returns an array');
  return result
    .map((entry) => (typeof entry === 'string' ? entry : (entry as { id: string }).id))
    .sort();
}

/** terminalResult stays consistent with the fixture's terminal events. */
function terminalFor(events: Spec[]): Record<string, unknown> | null {
  const hasTerminal = events.some(
    (event) => event.type === 'match-terminal' || event.type === 'winner' || event.type === 'core-destruction',
  );
  return hasTerminal ? { winner: 'gravemark', tick: 12000, reason: 'time-cap' } : null;
}

function expectExactly(
  events: Spec[],
  expected: string[],
  label: string,
  terminalResult: Record<string, unknown> | null = terminalFor(events),
): void {
  assert.deepEqual(classify(events, terminalResult), expected.slice().sort(), `${label} classifies exactly as expected`);
}

function main(): void {
  // Sanity anchors on the frozen constants the fixtures build against.
  assert.equal(PATH_LOCK_BY_TICK, 9600);
  assert.equal(STARVATION_WINDOW_TICKS, 1200);
  assert.equal(IDLE_PRODUCTION_WINDOW_TICKS, 400);
  assert.equal(REJECTED_CALL_BURST, 3);
  assert.equal(REJECTED_CALL_WINDOW_TICKS, 200);
  assert.equal(ATTACK_FLOOR_TICK, 9600);
  assert.equal(HONEST_STEP_GAIN_BOUND, 96);

  // 1. deadline-miss: path locked strictly after PATH_LOCK_BY_TICK.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      ...resourceSamples(9500, 9620, 'sunweaver', (t) => 200 + Math.floor((t - 9500) / 20)),
      { tick: 9500, type: 'path-commit-attempt', payload: { ok: true, cost: { ore: 400, gas: 0, energy: 80 }, path: 'sky-dominion' } },
      { tick: PATH_LOCK_BY_TICK + 1, type: 'technology-path-lock', payload: { path: 'sky-dominion' } },
      { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['deadline-miss'],
    'deadline-miss fixture',
  );

  // 2. starvation: >= STARVATION_WINDOW_TICKS with no positive resource delta
  //    while a cost-funded milestone (path-locked) is pending.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 100, type: 'path-commit-attempt', payload: { ok: true, cost: { ore: 400, gas: 0, energy: 80 }, path: 'sky-dominion' } },
      ...resourceSamples(200, 1500, 'sunweaver', () => 50),
      ...resourceSamples(200, 1500, 'gravemark', (t) => 100 + Math.floor((t - 200) / 20) * 5),
      { tick: 1600, type: 'technology-path-lock', payload: { path: 'sky-dominion' } },
      { tick: 2000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['starvation'],
    'starvation fixture',
  );

  // 3. idle-production: >= IDLE_PRODUCTION_WINDOW_TICKS with the required unit
  //    affordable, pop capacity available, and the producer (yard) idle.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 100, type: 'construction-complete', entityIds: [12], payload: { kind: 'yard' } },
      { tick: 400, type: 'path-commit-attempt', payload: { ok: true, cost: { ore: 400, gas: 0, energy: 80 }, path: 'sky-dominion' } },
      { tick: 500, type: 'technology-path-lock', payload: { path: 'sky-dominion' } },
      ...resourceSamples(520, 1400, 'sunweaver', (t) => 500 + Math.floor((t - 520) / 20) * 20),
      ...populationSamples(520, 1400, 'sunweaver', 2, 10),
      { tick: 1000, type: 'training-start', entityIds: [12], payload: { kind: 'fighter' } },
      { tick: 1400, type: 'unit-completion', entityIds: [12], payload: { kind: 'fighter' } },
      { tick: 2000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['idle-production'],
    'idle-production fixture',
  );

  // 4. hidden-targeting: a rival combat engagement on an entity the rival
  //    never discovered, after the attack floor (so early-attack does not fire).
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 100, type: 'entity-discovery', team: 'gravemark', entityIds: [20], payload: { what: 'fighter', x: 1.2, z: -3.4 } },
      { tick: 150, type: 'entity-discovery', team: 'gravemark', entityIds: [21], payload: { what: 'fighter', x: -2.0, z: 5.1 } },
      {
        tick: ATTACK_FLOOR_TICK + 100,
        type: 'combat-engagement',
        team: 'gravemark',
        entityIds: [20, 6],
        payload: { attackerId: 20, victimId: 6, damage: 2.5 },
      },
      { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['hidden-targeting'],
    'hidden-targeting fixture',
  );

  // 5. early-attack: a rival combat engagement before ATTACK_FLOOR_TICK on a
  //    target that WAS discovered (so hidden-targeting does not fire).
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 100, type: 'entity-discovery', team: 'gravemark', entityIds: [6], payload: { what: 'core', x: 0, z: 0 } },
      { tick: 150, type: 'entity-discovery', team: 'gravemark', entityIds: [20], payload: { what: 'fighter', x: 1.2, z: -3.4 } },
      {
        tick: ATTACK_FLOOR_TICK - 600,
        type: 'combat-engagement',
        team: 'gravemark',
        entityIds: [20, 6],
        payload: { attackerId: 20, victimId: 6, damage: 2.5 },
      },
      { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['early-attack'],
    'early-attack fixture',
  );

  // 6. impossible-positive-delta: an economy jump that no honest step can
  //    produce (6000 ore in 20 ticks >> HONEST_STEP_GAIN_BOUND per tick).
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 1000, type: 'resource-sample', team: 'sunweaver', payload: { ore: 100, gas: 0, energy: 10 } },
      { tick: 1020, type: 'resource-sample', team: 'sunweaver', payload: { ore: 6100, gas: 0, energy: 10 } },
      { tick: 1000, type: 'resource-sample', team: 'gravemark', payload: { ore: 200, gas: 40, energy: 90 } },
      { tick: 1020, type: 'resource-sample', team: 'gravemark', payload: { ore: 220, gas: 40, energy: 90 } },
      { tick: 2000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['impossible-positive-delta'],
    'impossible-positive-delta fixture',
  );

  // 7. repeated-rejections: >= REJECTED_CALL_BURST rejected calls of one
  //    action within REJECTED_CALL_WINDOW_TICKS.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 100, type: 'placement-attempt', entityIds: [7], payload: { ok: false, kind: 'yard', rejectReason: 'blocked' } },
      { tick: 110, type: 'placement-attempt', entityIds: [7], payload: { ok: false, kind: 'yard', rejectReason: 'blocked' } },
      { tick: 120, type: 'placement-attempt', entityIds: [7], payload: { ok: false, kind: 'yard', rejectReason: 'blocked' } },
      { tick: 1000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
    ],
    ['repeated-rejections'],
    'repeated-rejections fixture',
  );

  // 8. no-terminal: a trace that never reaches a terminal event.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      { tick: 20, type: 'resource-sample', team: 'sunweaver', payload: { ore: 220, gas: 40, energy: 90 } },
      { tick: 40, type: 'resource-sample', team: 'sunweaver', payload: { ore: 240, gas: 40, energy: 90 } },
    ],
    ['no-terminal'],
    'no-terminal fixture',
  );

  // 9. clean trace: honest samples, discovered targets, on-time attacks,
  //    real terminal — no classification fires.
  expectExactly(
    [
      { tick: 0, type: 'match-start', team: null },
      ...resourceSamples(20, 200, 'sunweaver', (t) => 220 + Math.floor(t / 20) * 3),
      ...resourceSamples(20, 200, 'gravemark', (t) => 220 + Math.floor(t / 20) * 3),
      ...populationSamples(20, 200, 'sunweaver', 4, 10),
      ...populationSamples(20, 200, 'gravemark', 4, 10),
      { tick: 12000, type: 'core-destruction', team: null, payload: {} },
      { tick: 12000, type: 'winner', team: null, payload: {} },
      { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'core-destroyed' } },
    ],
    [],
    'clean trace',
    { winner: 'sunweaver', tick: 12000, reason: 'core-destroyed' },
  );
}

try {
  main();
  console.log('forge-trace-classification tests: PASS');
} catch (err) {
  console.error('forge-trace-classification tests: FAIL', err);
  process.exitCode = 1;
}
