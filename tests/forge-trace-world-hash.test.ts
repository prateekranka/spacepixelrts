/**
 * FTR-TESTS RED — deterministic world identity hashing (docs/FORGE_TRACE.md §6).
 * canonicalWorldSnapshot(world) + worldIdentityHash(world) from
 * ../src/forge-snapshot. Same seed + same operations => equal hashes; any
 * divergence in live world state (ore perturb, fog toggle) flips the hash.
 * The hash reads the LIVE world, so insertion-order tricks do not apply —
 * stability is asserted by rebuilding two worlds with identical operations in
 * the same order.
 */
import assert from 'node:assert/strict';

import { canonicalWorldSnapshot, worldIdentityHash } from '../src/forge-snapshot';
import { World } from '../src/sim';
import { Kind, Ord, Tile } from '../src/engine';
import { STATS } from '../src/content';

const SEED = 24301;
const STEPS = 120;

function placeYard(world: World): void {
  const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  const worker = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
  assert.ok(hall && worker, 'world has a player Nexus and Worker');
  const spots = [
    { x: hall.x - 3.4, z: hall.z - 3.4 },
    { x: hall.x, z: hall.z - 4.4 },
    { x: hall.x + 3.4, z: hall.z - 3.4 },
    { x: hall.x + 4.4, z: hall.z },
  ];
  const spot = spots.find((candidate) => world.canPlace(candidate.x, candidate.z, STATS[Kind.Barracks].radius));
  assert.ok(spot, 'legal Yard spot exists');
  assert.equal(world.tryPlace(0, Kind.Barracks, spot.x, spot.z, worker.id), true, 'Yard places legally');
}

function gatherTwoOre(world: World): void {
  const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  const workers = world.ents.filter((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
  const ore = world.ents
    .filter((e) => e.alive && e.kind === Kind.Resource && e.cargoType === Tile.Ore)
    .sort((a, b) => Math.hypot(a.x - hall.x, a.z - hall.z) - Math.hypot(b.x - hall.x, b.z - hall.z))[0];
  assert.ok(hall && ore && workers.length >= 2, 'gather fixture has Nexus, Ore node, Workers');
  world.issue([workers[0].id, workers[1].id], Ord.Gather, ore.x, ore.z, ore.id);
}

function main(): void {
  // --- Same seed: equal hashes after reset and after N steps. ---
  const a = new World();
  const b = new World();
  a.reset(SEED);
  b.reset(SEED);
  const resetHash = worldIdentityHash(a);
  assert.match(resetHash, /^[0-9a-f]{8}$/, 'hash is a lowercase 8-hex string');
  assert.equal(worldIdentityHash(b), resetHash, 'same-seed reset hashes are equal');
  assert.deepEqual(canonicalWorldSnapshot(a), canonicalWorldSnapshot(b), 'same-seed snapshots are equal');

  for (let i = 0; i < STEPS; i++) {
    a.step();
    b.step();
  }
  assert.equal(worldIdentityHash(a), worldIdentityHash(b), 'same-seed hashes stay equal after N steps');
  assert.deepEqual(canonicalWorldSnapshot(a), canonicalWorldSnapshot(b), 'same-seed snapshots stay equal after N steps');
  assert.notEqual(worldIdentityHash(a), resetHash, 'hash is live: stepping changes it');

  // --- Sensitivity: one ore point flips the hash. ---
  const c = new World();
  c.reset(SEED);
  const before = worldIdentityHash(c);
  const beforeSnapshot = canonicalWorldSnapshot(c);
  c.teams[0].ore += 1;
  assert.notEqual(worldIdentityHash(c), before, 'perturbing teams[0].ore by 1 flips the hash');
  assert.notDeepEqual(canonicalWorldSnapshot(c), beforeSnapshot, 'snapshot reflects the perturbed ore');

  // --- Stability: two fresh worlds built with identical operations in the
  //     same order hash identically (hash reads the live world, so array
  //     insertion-order tricks are not a meaningful probe). ---
  const d = new World();
  const e = new World();
  d.reset(SEED);
  e.reset(SEED);
  placeYard(d);
  placeYard(e);
  gatherTwoOre(d);
  gatherTwoOre(e);
  for (let i = 0; i < STEPS; i++) {
    d.step();
    e.step();
  }
  assert.equal(worldIdentityHash(d), worldIdentityHash(e), 'identical operation order => identical hashes');
  assert.deepEqual(canonicalWorldSnapshot(d), canonicalWorldSnapshot(e), 'identical operation order => identical snapshots');

  // --- Fog flag: toggling fogOfWarEnabled changes the identity hash. ---
  const fogOn = new World();
  fogOn.fogOfWarEnabled = true;
  fogOn.reset(SEED);
  const fogOff = new World();
  fogOff.fogOfWarEnabled = false;
  fogOff.reset(SEED);
  assert.notEqual(worldIdentityHash(fogOn), worldIdentityHash(fogOff), 'fogOfWarEnabled toggles the hash');
  assert.notDeepEqual(canonicalWorldSnapshot(fogOn), canonicalWorldSnapshot(fogOff), 'fog flag is in the snapshot');
}

try {
  main();
  console.log('forge-trace-world-hash tests: PASS');
} catch (err) {
  console.error('forge-trace-world-hash tests: FAIL', err);
  process.exitCode = 1;
}
