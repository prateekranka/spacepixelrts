/**
 * FTR-TESTS RED — first divergence (docs/FORGE_TRACE.md §9, §12).
 * Two synthetic traces share a common milestone/checkpoint prefix and then
 * diverge at tick 300 (checkpoint hashes differ, and the passing trace locks
 * its tech path while the failed trace does not). firstDivergence must report
 * earliestDivergingTick / priorCommonMilestone / expectedNextMilestone.
 * Identical traces (including a deep copy) return null.
 */
import assert from 'node:assert/strict';

import { firstDivergence } from '../src/forge-diagnostics';
import {
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
  return specs.map((spec, seq) => ({
    eventId: `evt-${seq}`,
    seq,
    tick: spec.tick,
    seconds: spec.tick / 20,
    type: spec.type,
    team: spec.team === undefined ? 'sunweaver' : spec.team,
    entityIds: spec.entityIds ?? [],
    payload: spec.payload ?? {},
    worldHash: (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(spec.type) ? 'a1b2c3d4' : null,
    frameRef: {
      policyId: 'standard-opening',
      config: makeConfig(),
      seed: 24301,
      tick: spec.tick,
      perspective: 'player',
      camera: { ...DEFAULT_CAMERA_PRESET },
      selectedEntityIds: [],
    },
    severity: 'info',
  }));
}

function makeTrace(
  events: Record<string, unknown>[],
  checkpoints: { seq: number; tick: number; worldHash: string }[],
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    tool: 'forge-trace',
    createdAtNote: null,
    matchConfig: makeConfig(),
    policy: { id: 'standard-opening', identityHash: 'a1b2c3d4' },
    tickHz: 20,
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    terminalResult: { winner: 'gravemark', tick: 12000, reason: 'time-cap' },
    checkpoints,
    events,
  };
}

// Common prefix: match-start @0, yard-complete @100, path-committed @150.
// Passing trace: path-locked @300, unit-completion @400.
// Failed trace: a rejected placement @300 (event-level divergence), then
// unit-completion @500 and path-locked @600 (milestone divergence).
const PASSING_EVENTS: Spec[] = [
  { tick: 0, type: 'match-start', team: null },
  { tick: 100, type: 'construction-complete', entityIds: [12], payload: { kind: 'yard' } },
  { tick: 150, type: 'path-commit-attempt', payload: { ok: true, cost: { ore: 400, gas: 0, energy: 80 }, path: 'sky-dominion' } },
  { tick: 300, type: 'technology-path-lock', payload: { path: 'sky-dominion' } },
  { tick: 400, type: 'unit-completion', entityIds: [12], payload: { kind: 'fighter' } },
  { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
];

const FAILED_EVENTS: Spec[] = [
  { tick: 0, type: 'match-start', team: null },
  { tick: 100, type: 'construction-complete', entityIds: [12], payload: { kind: 'yard' } },
  { tick: 150, type: 'path-commit-attempt', payload: { ok: true, cost: { ore: 400, gas: 0, energy: 80 }, path: 'sky-dominion' } },
  { tick: 300, type: 'placement-attempt', entityIds: [7], payload: { ok: false, kind: 'yard', rejectReason: 'blocked' } },
  { tick: 500, type: 'unit-completion', entityIds: [12], payload: { kind: 'fighter' } },
  { tick: 600, type: 'technology-path-lock', payload: { path: 'sky-dominion' } },
  { tick: 12000, type: 'match-terminal', team: null, payload: { reason: 'time-cap' } },
];

const PASSING_CHECKPOINTS = [
  { seq: 0, tick: 0, worldHash: 'aaaa1111' },
  { seq: 1, tick: 100, worldHash: 'bbbb2222' },
  { seq: 2, tick: 150, worldHash: 'cccc3333' },
  { seq: 3, tick: 300, worldHash: 'dddd4444' },
  { seq: 4, tick: 400, worldHash: 'eeee5555' },
];

// Same tick 300 as the passing trace but a different hash: the divergence is
// pinned to exactly tick 300 no matter how it is detected.
const FAILED_CHECKPOINTS = [
  { seq: 0, tick: 0, worldHash: 'aaaa1111' },
  { seq: 1, tick: 100, worldHash: 'bbbb2222' },
  { seq: 2, tick: 150, worldHash: 'cccc3333' },
  { seq: 3, tick: 300, worldHash: 'ffff6666' },
  { seq: 4, tick: 500, worldHash: 'eeee6666' },
];

function main(): void {
  const passing = makeTrace(buildEvents(PASSING_EVENTS), PASSING_CHECKPOINTS);
  const failed = makeTrace(buildEvents(FAILED_EVENTS), FAILED_CHECKPOINTS);

  const report = firstDivergence(passing, failed);
  assert.ok(report !== null, 'diverging traces produce a report');
  assert.equal(report.earliestDivergingTick, 300, 'earliest diverging tick is the shared divergence tick');
  assert.equal(report.priorCommonMilestone, 'path-committed', 'last milestone common to both traces before divergence');
  assert.equal(report.expectedNextMilestone, 'path-locked', 'next milestone the passing trace reached after divergence');

  // Identical traces (same reference and a deep copy) return null.
  assert.equal(firstDivergence(passing, passing), null, 'identical trace (same reference) returns null');
  assert.equal(firstDivergence(failed, failed), null, 'identical failed trace returns null');
  const passingCopy = JSON.parse(JSON.stringify(passing)) as Record<string, unknown>;
  assert.equal(firstDivergence(passingCopy, passing), null, 'identical deep copy returns null');
}

try {
  main();
  console.log('forge-trace-divergence tests: PASS');
} catch (err) {
  console.error('forge-trace-divergence tests: FAIL', err);
  process.exitCode = 1;
}
