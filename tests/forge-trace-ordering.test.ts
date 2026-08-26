/**
 * FTR-TESTS RED — event ordering (docs/FORGE_TRACE.md §5, §12).
 * In a real short recorded run: seq is 0-based, strictly increasing and
 * gapless; eventIds follow evt-<seq>; ticks are nondecreasing; seconds are
 * tick / TICK_HZ. Checkpoints keep strictly increasing seqs, nondecreasing
 * ticks and 8-hex hashes.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 1200; // bounded: 1 simulated minute

function runMatch(): { events: unknown[]; checkpoints: unknown[] } {
  const config: MatchConfig = normalizeMatchConfig({
    playerFaction: 'sunweaver',
    aiFaction: 'gravemark',
    map: 'helios-rift',
    difficulty: 'standard',
    fogOfWar: true,
    speed: 1,
    tacticalPause: 'enabled',
    seedMode: 'deterministic',
    seed: SEED,
  });
  const world = new World();
  const collector = new ForgeTraceCollector(world, { config, policyId: 'standard-opening' });
  collector.attach();
  runStandardOpening(world, {
    seed: SEED,
    difficulty: 'standard',
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    collector,
    maxTicks: MAX_TICKS,
  });
  collector.finalize();
  return { events: collector.events, checkpoints: collector.checkpoints };
}

function main(): void {
  const { events, checkpoints } = runMatch();

  assert.ok(events.length > 50, 'run produced a real event stream');

  // seq: 0-based, strictly increasing, gapless.
  events.forEach((raw, index) => {
    const event = raw as Record<string, unknown>;
    assert.equal(event.seq, index, `seq[${index}] is gapless from 0`);
    assert.equal(event.eventId, `evt-${index}`, `eventId[${index}] follows evt-<seq>`);
    assert.equal(event.seconds, (event.tick as number) / 20, `seconds[${index}] is tick / 20`);
  });

  // tick: nondecreasing across the whole stream.
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1] as Record<string, unknown>;
    const curr = events[i] as Record<string, unknown>;
    assert.ok(
      (curr.tick as number) >= (prev.tick as number),
      `ticks nondecreasing at index ${i} (${prev.tick} -> ${curr.tick})`,
    );
  }

  // checkpoints: strictly increasing seq, nondecreasing tick, hex hashes.
  assert.ok(checkpoints.length > 0, 'run produced checkpoints');
  checkpoints.forEach((raw, index) => {
    const checkpoint = raw as Record<string, unknown>;
    assert.equal(checkpoint.seq, index, `checkpoint seq[${index}] is gapless from 0`);
    assert.match(checkpoint.worldHash as string, /^[0-9a-f]{8}$/, `checkpoint[${index}] hash is 8-hex`);
    if (index > 0) {
      const prev = checkpoints[index - 1] as Record<string, unknown>;
      assert.ok(
        (checkpoint.tick as number) >= (prev.tick as number),
        `checkpoint ticks nondecreasing at ${index}`,
      );
    }
  });
}

try {
  main();
  console.log('forge-trace-ordering tests: PASS');
} catch (err) {
  console.error('forge-trace-ordering tests: FAIL', err);
  process.exitCode = 1;
}
