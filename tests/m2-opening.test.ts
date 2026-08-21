import assert from 'node:assert/strict';
import { Kind, MAP, Ord, Tile } from '../src/engine';
import { POP_HALL } from '../src/content';
import { World } from '../src/sim';
import { OPENING_CENTER } from '../src/opening-presentation';

const SEED = 0x5eed;
const BASE_X = 10.5;
const BASE_Z = 10.5;

interface Row {
  kind: Kind;
  x: number;
  z: number;
}

function unitsOf(world: World, team: number): Row[] {
  const rows: Row[] = [];
  for (const e of world.ents) {
    if (!e.alive || e.team !== team || e.kind === Kind.Resource) continue;
    rows.push({ kind: e.kind, x: e.x, z: e.z });
  }
  return rows;
}

function countKind(rows: Row[], kind: Kind): number {
  return rows.reduce((n, r) => (r.kind === kind ? n + 1 : n), 0);
}

function snapshot(world: World): string {
  return world.ents
    .filter((e) => e.alive)
    .map((e) => `${e.id}:${e.kind}:${e.team}:${e.civ}:${e.x.toFixed(4)}:${e.z.toFixed(4)}`)
    .sort()
    .join('|');
}

function assertMirrored(playerRows: Row[], rivalRows: Row[]): void {
  assert.equal(rivalRows.length, playerRows.length);
  const used = new Set<number>();
  for (const row of playerRows) {
    const hit = rivalRows.findIndex(
      (r, i) =>
        !used.has(i) &&
        r.kind === row.kind &&
        Math.abs(r.x - (MAP - row.x)) < 1e-6 &&
        Math.abs(r.z - (MAP - row.z)) < 1e-6,
    );
    assert.notEqual(hit, -1, `rival lacks mirror of ${Kind[row.kind]} at ${row.x},${row.z}`);
    used.add(hit);
  }
}

// Exact counts — one Core, four workers, one scout per side; nothing else.
const world = new World();
assert.equal(world.fogOfWarEnabled, true);
world.reset(SEED);

{
  const player = unitsOf(world, 0);
  const rival = unitsOf(world, 1);
  const military: Kind[] = [
    Kind.Fighter,
    Kind.Ravager,
    Kind.Prism,
    Kind.Shade,
    Kind.Siege,
    Kind.UniqueB,
  ];
  for (const [team, rows] of [
    [0, player],
    [1, rival],
  ] as const) {
    assert.equal(rows.length, 6, `team ${team} total starting entity count`);
    assert.equal(countKind(rows, Kind.Hall), 1, `team ${team} core count`);
    assert.equal(countKind(rows, Kind.Worker), 4, `team ${team} worker count`);
    assert.equal(countKind(rows, Kind.Scout), 1, `team ${team} scout count`);
    assert.equal(countKind(rows, Kind.House), 0, `team ${team} house count`);
    assert.equal(countKind(rows, Kind.Barracks), 0, `team ${team} yard count`);
    for (const kind of military) {
      assert.equal(countKind(rows, kind), 0, `team ${team} military ${Kind[kind]}`);
    }
  }
  for (const e of world.ents) {
    if (!e.alive) continue;
    assert.equal(e.corpseT, 0, 'no forced corpses');
    assert.equal(e.dissolveT, 0, 'no dissolving units');
  }
  assertMirrored(player, rival);
}

// Idle — fresh units carry no orders or paths.
for (const e of world.ents) {
  if (!e.alive || e.team > 1 || e.kind === Kind.Resource) continue;
  if (e.kind !== Kind.Worker && e.kind !== Kind.Scout) continue;
  assert.equal(e.order, Ord.Idle, `${Kind[e.kind]} order`);
  assert.equal(e.tid, -1, `${Kind[e.kind]} target`);
  assert.equal(e.path, null, `${Kind[e.kind]} path`);
}

// Pop/cap — five supply used, one Core grants ten.
assert.equal(world.teams[0].pop, 5);
assert.equal(world.teams[1].pop, 5);
assert.equal(world.teams[0].cap, POP_HALL);
assert.equal(world.teams[1].cap, POP_HALL);

// Nearby resource types — ore/gas/solar within reach of each core, tiles stamped.
function resourcesNear(x: number, z: number, radius: number): { cargo: Tile; tile: Tile }[] {
  const out: { cargo: Tile; tile: Tile }[] = [];
  for (const e of world.ents) {
    if (!e.alive || e.kind !== Kind.Resource) continue;
    if (e.cargoType !== Tile.Ore && e.cargoType !== Tile.Gas && e.cargoType !== Tile.Solar) {
      continue;
    }
    const dx = e.x - x;
    const dz = e.z - z;
    if (dx * dx + dz * dz > radius * radius) continue;
    out.push({ cargo: e.cargoType, tile: world.tiles[(e.x | 0) + (e.z | 0) * MAP] as Tile });
  }
  return out;
}

for (const [bx, bz] of [
  [BASE_X, BASE_Z],
  [MAP - BASE_X, MAP - BASE_Z],
]) {
  const nodes = resourcesNear(bx, bz, 10);
  assert.ok(nodes.length >= 3, `base ${bx},${bz} has at least three nearby nodes`);
  const types = new Set(nodes.map((node) => node.cargo));
  for (const type of [Tile.Ore, Tile.Gas, Tile.Solar]) {
    assert.equal(types.has(type), true, `base ${bx},${bz} has resource type ${type}`);
  }
  for (const n of nodes) assert.equal(n.tile, n.cargo, 'node ground tile matches gem');
}

// No overlap — each safe node clears every other entity by radius sum.
const baseNodes = world.ents.filter(
  (e) =>
    e.alive &&
    e.kind === Kind.Resource &&
    ((Math.hypot(e.x - BASE_X, e.z - BASE_Z) < 12) ||
      Math.hypot(e.x - (MAP - BASE_X), e.z - (MAP - BASE_Z)) < 12),
);
assert.ok(baseNodes.length >= 6, 'both bases retain their six guaranteed safe nodes');
for (const node of baseNodes) {
  assert.equal(node.team, 3, 'safe gems are neutral');
  for (const other of world.ents) {
    if (!other.alive || other === node) continue;
    const d = Math.hypot(node.x - other.x, node.z - other.z);
    assert.ok(d >= node.radius + other.radius, `node at ${node.x},${node.z} overlaps another entity`);
  }
}

// Center fog — honest fog leaves Helios Rift center unexplored at reset.
{
  const centerIdx = (OPENING_CENTER.x | 0) + (OPENING_CENTER.z | 0) * MAP;
  assert.equal(world.visible[0][centerIdx], 0, 'center not currently visible');
  assert.equal(world.explored[0][centerIdx], 0, 'center not explored');
  const ownIdx = (BASE_X | 0) + (BASE_Z | 0) * MAP;
  assert.equal(world.visible[0][ownIdx], 1, 'own base lit by core LOS');
  const foeIdx = ((MAP - BASE_X) | 0) + ((MAP - BASE_Z) | 0) * MAP;
  assert.equal(world.visible[0][foeIdx], 0, 'rival base hidden');
  const rivalHall = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Hall);
  assert.ok(rivalHall);
  assert.equal(rivalHall.vis, false, 'rival core not revealed');
}

// Fog off — full reveal across both teams and every entity.
{
  const clear = new World();
  clear.fogOfWarEnabled = false;
  clear.reset(SEED);
  for (const team of [0, 1]) {
    assert.equal(clear.visible[team].every((v) => v === 1), true, `visible[${team}] full`);
    assert.equal(clear.explored[team].every((v) => v === 1), true, `explored[${team}] full`);
  }
  for (const e of clear.ents) {
    if (e.alive) assert.equal(e.vis, true, 'every entity visible without fog');
  }
}

// Full re-reset — replaying reset on the same world reproduces the layout exactly.
{
  const before = snapshot(world);
  world.reset(SEED);
  assert.equal(snapshot(world), before, 'full re-reset is identical');
}

// Same-seed positions — independent worlds agree entity for entity.
{
  const a = new World();
  a.reset(SEED);
  const b = new World();
  b.reset(SEED);
  assert.equal(snapshot(a), snapshot(b), 'same seed yields same positions');
}

console.log('M2 opening tests: PASS');
