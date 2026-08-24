import assert from 'node:assert/strict';
import { Kind, Ord, Tile } from '../src/engine';
import { World } from '../src/sim';
import { AppFlow } from '../src/app-flow';
import { QA_SCENARIOS } from '../src/qa-scenarios';

const world = new World();
world.reset(0x5eed);

assert.deepEqual(world.matchStats(), {
  tick: 0,
  teams: [
    {
      resources: { ore: 0, gas: 0, energy: 0 },
      unitsTrained: 0,
      unitsLost: 0,
      coreDamage: 0,
    },
    {
      resources: { ore: 0, gas: 0, energy: 0 },
      unitsTrained: 0,
      unitsLost: 0,
      coreDamage: 0,
    },
  ],
});

const snapshot = world.matchStats();
(snapshot.teams[0].resources as { ore: number }).ore = 999;
assert.equal(world.matchStats().teams[0].resources.ore, 0, 'stats snapshots are defensive');

console.log('VS3 stats RED: PASS');

{
  const postReset = new World();
  postReset.reset(0x5eed);
  const worker = postReset.spawn(0, postReset.civ[0], 0, 18, 18);
  const fighter = postReset.spawn(2, postReset.civ[1], 1, 54, 54);
  const building = postReset.spawn(12, postReset.civ[0], 0, 18, 20);
  const resource = postReset.spawn(20, postReset.civ[0], 3, 20, 20);
  assert.ok(worker && fighter && building && resource, 'post-reset fixtures spawn');
  assert.deepEqual(
    postReset.matchStats().teams.map((team) => team.unitsTrained),
    [1, 1],
    'only post-reset team units count as trained',
  );
}

console.log('VS3 spawn stats: PASS');

{
  const income = new World();
  income.reset(0x5eed);
  const hall = income.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  const worker = income.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker);
  assert.ok(hall && worker, 'initial Hall/Worker exist');
  worker.x = worker.px = hall.x;
  worker.z = worker.pz = hall.z;
  for (const [cargoType, cargo] of [[Tile.Ore, 3], [Tile.Gas, 2], [Tile.Solar, 4]] as const) {
    worker.cargoType = cargoType;
    worker.cargo = cargo;
    worker.order = Ord.Return;
    income.step();
  }
  assert.deepEqual(income.matchStats().teams[0].resources, { ore: 3, gas: 2, energy: 4 });
}

{
  const solar = new World();
  solar.reset(0x5eed);
  const node = solar.ents.find(
    (entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.Solar,
  );
  const worker = solar.spawn(Kind.Worker, solar.civ[0], 0, node!.x, node!.z);
  assert.ok(node && worker, 'Solar link fixtures exist');
  worker.order = Ord.Gather;
  worker.tid = node.id;
  worker.tx = node.x;
  worker.tz = node.z;
  solar.step();
  assert.equal(solar.matchStats().teams[0].resources.energy, 1, 'Solar link income is gathered Charge');
}

{
  const rig = new World();
  rig.civ[0] = 'aurion';
  rig.reset(0x5eed);
  const node = rig.ents.find(
    (entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.Ore,
  );
  const worker = rig.spawn(Kind.Worker, 'aurion', 0, node!.x, node!.z);
  assert.ok(node && worker, 'rig fixtures exist');
  worker.order = Ord.Build;
  worker.tid = node.id;
  worker.tx = node.x;
  worker.tz = node.z;
  for (let step = 0; step < 230; step++) rig.step();
  assert.ok(node.rigProgress >= 1, 'rig completes through ordinary build steps');
  assert.ok(rig.matchStats().teams[0].resources.ore > 0, 'rig income is gathered Ore');
}

{
  const lumen = new World();
  lumen.reset(0x5eed);
  const landmark = lumen.landmarks.find((entry) => entry.id === 'central-lumen-field');
  const fighter = lumen.spawn(Kind.Fighter, lumen.civ[0], 0, landmark!.x, landmark!.z);
  assert.ok(landmark && fighter, 'Lumen fixtures exist');
  fighter.order = Ord.Move;
  fighter.tx = landmark.x;
  fighter.tz = landmark.z;
  for (let step = 0; step < 160; step++) lumen.step();
  assert.equal(lumen.lumenState().owner, 0, 'Lumen capture completes');
  assert.ok(lumen.matchStats().teams[0].resources.energy > 0, 'Lumen income is gathered Charge');
}

console.log('VS3 income stats: PASS');

{
  const melee = new World();
  melee.reset(0x5eed);
  const meleeVictim = melee.spawn(Kind.Fighter, melee.civ[1], 1, 40, 40);
  const meleeAttacker = melee.spawn(Kind.Ravager, melee.civ[0], 0, 40.5, 40);
  assert.ok(meleeVictim && meleeAttacker, 'ordinary melee loss fixtures spawn');
  meleeVictim.hp = 1;
  meleeAttacker.order = Ord.Attack;
  meleeAttacker.tid = meleeVictim.id;
  meleeAttacker.tx = meleeVictim.x;
  meleeAttacker.tz = meleeVictim.z;
  melee.step();
  assert.equal(meleeVictim.hp, 0, 'ordinary melee crosses positive HP to corpse');
  assert.equal(melee.matchStats().teams[1].unitsLost, 1, 'ordinary melee records victim-team loss');
  melee.kill(meleeVictim);
  assert.equal(melee.matchStats().teams[1].unitsLost, 1, 'repeated melee kill does not duplicate loss');

  const bolt = new World();
  bolt.reset(0x5eed);
  const boltVictim = bolt.spawn(Kind.Ravager, bolt.civ[1], 1, 40, 40);
  const boltAttacker = bolt.spawn(Kind.Fighter, bolt.civ[0], 0, 39.2, 40);
  assert.ok(boltVictim && boltAttacker, 'ordinary bolt loss fixtures spawn');
  boltVictim.hp = 1;
  boltAttacker.order = Ord.Attack;
  boltAttacker.tid = boltVictim.id;
  boltAttacker.tx = boltVictim.x;
  boltAttacker.tz = boltVictim.z;
  bolt.step();
  assert.equal(boltVictim.hp, 0, 'ordinary bolt crosses positive HP to corpse');
  assert.equal(bolt.matchStats().teams[1].unitsLost, 1, 'ordinary bolt records victim-team loss');
  bolt.kill(boltVictim);
  assert.equal(bolt.matchStats().teams[1].unitsLost, 1, 'repeated bolt kill does not duplicate loss');
}

console.log('VS3 ordinary combat loss: PASS');

{
  const deaths = new World();
  deaths.reset(0x5eed);
  const worker = deaths.spawn(Kind.Worker, deaths.civ[0], 0, 18, 18);
  const building = deaths.spawn(Kind.Barracks, deaths.civ[0], 0, 20, 20);
  const resource = deaths.spawn(Kind.Resource, deaths.civ[0], 3, 22, 22);
  assert.ok(worker && building && resource, 'death fixtures spawn');
  deaths.kill(worker);
  assert.equal(worker.hp, 0, 'unit corpse begins at zero HP');
  assert.equal(worker.alive, true, 'unit corpse remains for dissolve');
  deaths.kill(worker);
  deaths.kill(building);
  deaths.kill(resource);
  assert.equal(deaths.matchStats().teams[0].unitsLost, 1, 'unit corpse counts lost once');
  assert.equal(deaths.matchStats().teams[0].coreDamage, 0, 'building/resource death is not core damage');
}

console.log('VS3 loss stats: PASS');

{
  const melee = new World();
  melee.reset(0x5eed);
  const enemyHall = melee.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Hall);
  const attacker = melee.spawn(Kind.Ravager, melee.civ[0], 0, enemyHall!.x + 0.5, enemyHall!.z);
  assert.ok(enemyHall && attacker, 'melee core fixtures spawn');
  enemyHall.hp = 10;
  attacker.order = Ord.Attack;
  attacker.tid = enemyHall.id;
  attacker.tx = enemyHall.x;
  attacker.tz = enemyHall.z;
  melee.step();
  assert.equal(melee.matchStats().teams[0].coreDamage, 10, 'melee damage caps at remaining Core HP');
}

{
  const bolt = new World();
  bolt.reset(0x5eed);
  const enemyHall = bolt.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Hall);
  const attacker = bolt.spawn(Kind.Fighter, bolt.civ[0], 0, enemyHall!.x - 0.8, enemyHall!.z);
  assert.ok(enemyHall && attacker, 'bolt core fixtures spawn');
  enemyHall.hp = 5;
  attacker.order = Ord.Attack;
  attacker.tid = enemyHall.id;
  attacker.tx = enemyHall.x;
  attacker.tz = enemyHall.z;
  bolt.step();
  assert.equal(bolt.matchStats().teams[0].coreDamage, 5, 'bolt damage caps at remaining Core HP');
}

{
  const turret = new World();
  turret.reset(0x5eed);
  const playerHall = turret.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  const attacker = turret.spawn(Kind.UniqueB, turret.civ[1], 1, playerHall!.x + 0.8, playerHall!.z);
  assert.ok(playerHall && attacker, 'turret core fixtures spawn');
  playerHall.hp = 7;
  playerHall.progress = 0.99;
  playerHall.seenBy |= 2;
  turret.step();
  assert.equal(turret.matchStats().teams[1].coreDamage, 7, 'turret bolt credits the attacker team');
}

console.log('VS3 core damage stats: PASS');

{
  const reset = new World();
  reset.reset(0x5eed);
  const extra = reset.spawn(Kind.Worker, reset.civ[0], 0, 18, 18);
  assert.ok(extra, 'reset fixture spawns');
  reset.kill(extra);
  assert.equal(reset.matchStats().teams[0].unitsLost, 1);
  reset.teams[0].techPath = 'sky-dominion';
  reset.winner = 0;
  reset.reset(0xbeef);
  assert.equal(reset.tick, 0, 'reset returns tick to zero');
  assert.equal(reset.winner, -1, 'reset clears winner');
  assert.equal(reset.seed, 0xbeef, 'reset applies the new seed');
  assert.deepEqual(reset.matchStats(), {
    tick: 0,
    teams: [
      {
        resources: { ore: 0, gas: 0, energy: 0 },
        unitsTrained: 0,
        unitsLost: 0,
        coreDamage: 0,
      },
      {
        resources: { ore: 0, gas: 0, energy: 0 },
        unitsTrained: 0,
        unitsLost: 0,
        coreDamage: 0,
      },
    ],
  });
  assert.equal(reset.techPathOf(0), null, 'reset preserves path contract');
  assert.equal(reset.lumenState().owner, -1, 'reset preserves Lumen contract');
}

console.log('VS3 reset stats: PASS');

{
  const flow = new AppFlow({ logger: () => undefined });
  for (const event of ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY'] as const) {
    assert.equal(flow.dispatch(event).accepted, true);
  }
  assert.equal(flow.state, 'Playing');
  assert.equal(flow.canAdvanceSimulation, true);
  assert.equal(flow.dispatch('MATCH_WON').to, 'Victory');
  assert.equal(flow.canAdvanceSimulation, false);
  assert.equal(flow.dispatch('CONTINUE').to, 'Results');
  assert.equal(flow.dispatch('REMATCH').to, 'MatchSetup');
  assert.equal(flow.dispatch('START_MATCH').to, 'Loading');
  assert.equal(flow.dispatch('LOAD_READY').to, 'Playing');
  assert.equal(flow.dispatch('MATCH_LOST').to, 'Defeat');
  assert.equal(flow.dispatch('CONTINUE').to, 'Results');
  assert.equal(flow.dispatch('MAIN_MENU').to, 'MainMenu');
  assert.equal(flow.canAdvanceSimulation, false);
}

for (const id of ['victory', 'defeat', 'results'] as const) {
  assert.equal(QA_SCENARIOS.find((scenario) => scenario.id === id)?.scaffold, false, `${id} is a real route`);
}

console.log('VS3 flow/scenario stats: PASS');

{
  const frozen = new World();
  frozen.reset(0x5eed);
  const playerHall = frozen.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  assert.ok(playerHall, 'terminal freeze Core exists');
  frozen.kill(playerHall);
  const before = frozen.matchStats();
  frozen.step();
  assert.deepEqual(frozen.matchStats(), before, 'World tick/stats freeze after terminal');
}

console.log('VS3 terminal freeze stats: PASS');
