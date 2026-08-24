// M5-A — frozen compact army roster, labels, and presentation-facing sim rules.

import assert from 'node:assert/strict';
import { Kind, Ord } from '../src/engine';
import type { TechPathId } from '../src/content';
import { STATS, TECH_PATHS, fighterName, labelOf } from '../src/content';
import { World } from '../src/sim';

// ---- frozen stat table --------------------------------------------------------------
{
  assert.deepEqual(STATS[Kind.Scout], {
    hp: 40,
    spd: 3.15,
    atk: 5,
    range: 0.8,
    los: 9.5,
    radius: 0.26,
    ore: 40,
    gas: 0,
    energy: 15,
    train: 6,
    pop: 1,
    melee: true,
    building: false,
  });
  assert.deepEqual(STATS[Kind.Fighter], {
    hp: 96,
    spd: 1.85,
    atk: 10,
    range: 3.1,
    los: 6,
    radius: 0.32,
    ore: 70,
    gas: 0,
    energy: 20,
    train: 10,
    pop: 2,
    melee: false,
    building: false,
  });
  assert.deepEqual(STATS[Kind.Ravager], {
    hp: 96,
    spd: 2.35,
    atk: 15,
    range: 0.95,
    los: 5.5,
    radius: 0.36,
    ore: 90,
    gas: 35,
    energy: 20,
    train: 16,
    pop: 2,
    melee: true,
    building: false,
  });
  assert.deepEqual(STATS[Kind.Prism], {
    hp: 165,
    spd: 0.95,
    atk: 24,
    range: 6.2,
    los: 7,
    radius: 0.48,
    ore: 110,
    gas: 45,
    energy: 30,
    train: 20,
    pop: 3,
    melee: false,
    building: false,
  });
}

// ---- frozen labels and M4 copy ------------------------------------------------------
{
  assert.equal(fighterName('vespari'), 'Lumen Guard');
  assert.equal(fighterName('aurion'), 'Rift Guard');
  assert.equal(labelOf(Kind.Fighter, 'vespari'), 'Lumen Guard');
  assert.equal(labelOf(Kind.Fighter, 'aurion'), 'Rift Guard');
  assert.equal(labelOf(Kind.Scout, 'vespari'), 'Wind Strider');
  assert.equal(labelOf(Kind.Scout, 'aurion'), 'Grav-Skimmer');
  assert.equal(labelOf(Kind.Ravager, 'vespari'), 'Solar Strider');
  assert.equal(labelOf(Kind.Prism, 'aurion'), 'Burden Walker');
  assert.match(TECH_PATHS.find((p) => p.id === 'sky-dominion')!.blurb, /Wind Striders/);
  assert.match(TECH_PATHS.find((p) => p.id === 'rift-engineering')!.blurb, /Burden Walkers/);
}

function trainingWorld(civ: 'vespari' | 'aurion', techPath: TechPathId | null): { w: World; yard: NonNullable<ReturnType<World['spawn']>> } {
  const w = new World();
  w.civ[0] = civ;
  const yard = w.spawn(Kind.Barracks, civ, 0, 14.5, 14.5);
  assert.ok(yard, 'yard spawns');
  w.teams[0].ore = 1000;
  w.teams[0].gas = 1000;
  w.teams[0].energy = 1000;
  w.teams[0].cap = 100;
  w.teams[0].techPath = techPath;
  return { w, yard };
}

// ---- out-of-roster kinds cannot train, including after a path is open --------------
{
  const { w, yard } = trainingWorld('aurion', 'rift-engineering');
  const before = { ...w.teams[0] };
  assert.equal(w.tryTrain(yard, Kind.Siege), false, 'legacy Siege is not trainable');
  assert.equal(w.tryTrain(yard, Kind.Shade), false, 'legacy Shade is not trainable');
  assert.deepEqual(w.teams[0], before, 'rejected legacy training spends nothing');
  assert.equal(yard.trainT, 0, 'rejected legacy training starts no queue');
}

// ---- rift-engineering only accelerates Burden Walkers -------------------------------
{
  function trainTime(kind: Kind, path: TechPathId): number {
    const { w, yard } = trainingWorld('aurion', path);
    assert.ok(w.tryTrain(yard, kind), `${Kind[kind]} trains on ${path}`);
    return yard.trainT;
  }

  assert.equal(trainTime(Kind.Prism, 'iron-colossus'), 20, 'baseline Prism stays at 20 s');
  assert.equal(trainTime(Kind.Prism, 'rift-engineering'), 14, 'rift Prism trains at 14 s');
  assert.equal(trainTime(Kind.Fighter, 'rift-engineering'), 10, 'rift Fighter stays at 10 s');
}

// ---- Prism, but not legacy Siege, gets the building-damage modifier -----------------
{
  function damageToHouse(kind: Kind): number {
    const w = new World();
    const attacker = w.spawn(kind, 'vespari', 0, 10, 60);
    const target = w.spawn(Kind.House, 'vespari', 1, 10.5, 60);
    assert.ok(attacker && target, `${Kind[kind]} and target spawn`);
    attacker.order = Ord.Attack;
    attacker.tid = target.id;
    attacker.cooldown = 0;
    const hp = target.hp;
    w.step();
    return hp - target.hp;
  }

  assert.ok(Math.abs(damageToHouse(Kind.Prism) - STATS[Kind.Prism].atk * 1.8) < 1e-9);
  assert.ok(Math.abs(damageToHouse(Kind.Siege) - STATS[Kind.Siege].atk) < 1e-9);
}

// ---- the scripted marshal never recreates the retired production kinds --------------
{
  const w = new World();
  w.scriptedMarshalEnabled = true;
  w.reset(0x5eed);
  for (let i = 0; i <= 260; i++) w.step();
  assert.equal(
    w.ents.some((e) => e.alive && e.team === 1 && (e.kind === Kind.Siege || e.kind === Kind.Shade)),
    false,
    'marshal does not spawn retired kinds',
  );
}

console.log('M5-A army tests: PASS');
