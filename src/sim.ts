/** P10/P13/P24–P27 — world, pathfinding, combat, economy, fog, AI. */

import {
  DT,
  DISSOLVE_DUR,
  STAIN_DUR,
  COMBAT_BAR_DUR,
  Heap,
  Kind,
  MAP,
  MAX_ENTS,
  Ord,
  Spatial,
  Tile,
  clamp,
  dist2,
  hash2,
  makeEnt,
  mulberry32,
  tileAt,
  MAX_SPARKS,
} from './engine';
import type { Bolt, Civ, Ent, Spark, TeamEco } from './engine';
import {
  BUILD_HP_START,
  GATHER_MAX,
  POP_HALL,
  POP_HOUSE,
  STATS,
  isBuilding,
  isUnit,
  minTrainEpoch,
  uniqueUnit,
} from './content';

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];
const DC = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];
/** Scripted marshal wave trains faster off-screen (DESIGN §6). */
const MARSHAL_FIGHTER_TRAIN = 1;
const MARSHAL_SIEGE_TRAIN = 4;
const MARSHAL_PEEL_STAGGER_TICKS = 3;
/** Enemy forward pad — siege rally / head-start spawn (off opening crop). */
const MARSHAL_FORWARD_X = MAP - 18;
const MARSHAL_FORWARD_Z = MAP - 16;

export class World {
  readonly ents: Ent[] = Array.from({ length: MAX_ENTS }, makeEnt);
  readonly tiles = new Uint8Array(MAP * MAP);
  readonly block = new Uint8Array(MAP * MAP);
  readonly explored = [new Uint8Array(MAP * MAP), new Uint8Array(MAP * MAP)];
  readonly visible = [new Uint8Array(MAP * MAP), new Uint8Array(MAP * MAP)];
  readonly teams: TeamEco[] = [
    { ore: 220, gas: 40, energy: 90, pop: 0, cap: 0, epoch: 0, ageT: 0 },
    { ore: 220, gas: 40, energy: 90, pop: 0, cap: 0, epoch: 0, ageT: 0 },
    { ore: 0, gas: 0, energy: 0, pop: 0, cap: 0, epoch: 0, ageT: 0 },
    { ore: 0, gas: 0, energy: 0, pop: 0, cap: 0, epoch: 0, ageT: 0 },
  ];
  readonly civ: Civ[] = ['vespari', 'aurion', 'voidmarked', 'vespari'];
  readonly bolts: Bolt[] = [];
  readonly sparks: Spark[] = [];
  readonly flags: { x: number; z: number; t: number }[] = [];
  readonly hash = new Spatial();
  readonly q: number[] = [];
  tick = 0;
  seed = 0x5eed;
  /** -1 in play · 0 player win · 1 enemy win */
  winner = -1;
  private heap = new Heap();
  private gScore = new Float32Array(MAP * MAP);
  private came = new Int32Array(MAP * MAP);
  private closed = new Uint16Array(MAP * MAP);
  private stamp = 1;
  private free: number[] = [];
  private sporeT = [0, 0, 0, 0];
  private aiT = 0;
  private marshalPeelBuilt = false;
  private marshalPeelQ: number[] = [];
  private marshalPeelI = 0;
  private marshalSiegeSpawned = false;
  private sparkHead = 0;

  constructor() {
    for (let i = 0; i < MAX_ENTS; i++) {
      this.ents[i].id = i;
      this.free.push(i);
    }
    for (let i = 0; i < MAX_SPARKS; i++) {
      this.sparks.push({
        active: false,
        x: 0,
        z: 0,
        life: 0,
        maxLife: 0.1,
        kind: 0,
        civ: 'vespari',
      });
    }
  }

  reset(seed = 0x5eed): void {
    this.seed = seed;
    this.tick = 0;
    this.winner = -1;
    this.bolts.length = 0;
    for (let i = 0; i < MAX_SPARKS; i++) this.sparks[i].active = false;
    this.sparkHead = 0;
    this.flags.length = 0;
    this.free.length = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      this.ents[i].alive = false;
      this.ents[i].id = i;
      this.free.push(i);
    }
    this.teams[0] = { ore: 220, gas: 40, energy: 90, pop: 0, cap: 0, epoch: 0, ageT: 0 };
    this.teams[1] = { ore: 220, gas: 40, energy: 90, pop: 0, cap: 0, epoch: 0, ageT: 0 };
    this.explored[0].fill(0);
    this.explored[1].fill(0);
    this.visible[0].fill(0);
    this.visible[1].fill(0);
    this.marshalPeelBuilt = false;
    this.marshalPeelQ = [];
    this.marshalPeelI = 0;
    this.marshalSiegeSpawned = false;
    this.aiT = 0;
    this.genMap();
    this.spawnScenario();
    this.recountPop();
    this.updateFog();
    this.revealOpeningVision(MAP * 0.5, MAP * 0.52);
    this.refreshVis();
  }

  private refreshVis(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive) continue;
      if (e.team === 0) {
        e.vis = true;
        continue;
      }
      const idx = tileAt(e.x, e.z);
      e.vis = this.visible[0][idx] === 1 && !(e.kind === Kind.Shade && e.stealth > 0.55);
    }
  }

  spawn(kind: Kind, civ: Civ, team: number, x: number, z: number): Ent | null {
    const id = this.free.pop();
    if (id === undefined) return null;
    const e = this.ents[id];
    const st = STATS[kind];
    e.alive = true;
    e.kind = kind;
    e.civ = civ;
    e.team = team;
    e.x = e.px = x;
    e.z = e.pz = z;
    e.vx = e.vz = 0;
    e.hp = st.hp;
    e.maxHp = st.hp;
    e.order = Ord.Idle;
    e.tx = x;
    e.tz = z;
    e.tid = -1;
    e.cargo = 0;
    e.cooldown = 0;
    e.anim = 0;
    e.facing = 1;
    e.stealth = kind === Kind.Shade ? 1 : 0;
    e.frenzy = 0;
    e.blinkCd = 0;
    e.buildKind = Kind.House;
    e.progress = 1;
    e.trainKind = Kind.Worker;
    e.trainT = 0;
    e.rallyX = x + (team === 0 ? 2.2 : -2.2);
    e.rallyZ = z;
    e.radius = st.radius;
    e.vis = true;
    e.path = null;
    e.pathI = 0;
    e.hitFlash = 0;
    e.combatT = 0;
    e.dissolveT = 0;
    e.corpseT = 0;
    if (kind === Kind.Hall) e.hp = st.hp;
    return e;
  }

  private markCombat(...ents: Ent[]): void {
    for (const e of ents) {
      if (e.alive && e.hp > 0) e.combatT = COMBAT_BAR_DUR;
    }
  }

  kill(e: Ent): void {
    if (!e.alive) return;
    if (isUnit(e.kind)) {
      e.hp = 0;
      e.dissolveT = DISSOLVE_DUR;
      e.corpseT = STAIN_DUR;
      e.vx = e.vz = 0;
      e.path = null;
      e.tid = -1;
      e.order = Ord.Idle;
      this.recountPop();
      return;
    }
    e.alive = false;
    e.order = Ord.Idle;
    this.free.push(e.id);
    this.recountPop();
    this.checkWinner();
  }

  private hasNexus(team: number): boolean {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== team || e.kind !== Kind.Hall) continue;
      if (e.hp > 0 && e.progress >= 1) return true;
    }
    return false;
  }

  checkWinner(): void {
    if (this.winner !== -1) return;
    const p0 = this.hasNexus(0);
    const p1 = this.hasNexus(1);
    if (!p0 && p1) this.winner = 1;
    else if (p0 && !p1) this.winner = 0;
  }

  /** Compact hex-ish slots around a move destination (AoE2-style formation spread). */
  private formationOffsets(n: number, spacing: number): { dx: number; dz: number }[] {
    if (n <= 1) return [{ dx: 0, dz: 0 }];
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const out: { dx: number; dz: number }[] = [];
    const rowH = spacing * 0.866;
    let k = 0;
    for (let r = 0; r < rows && k < n; r++) {
      const inRow = Math.min(cols, n - k);
      const rowW = (inRow - 1) * spacing;
      const stagger = r % 2 === 1 ? spacing * 0.5 : 0;
      for (let c = 0; c < inRow; c++) {
        out.push({
          dx: c * spacing - rowW * 0.5 + stagger,
          dz: r * rowH - (rows - 1) * rowH * 0.5,
        });
        k++;
      }
    }
    return out;
  }

  issue(ids: number[], ord: Ord, x: number, z: number, tid: number): void {
    this.flags.push({ x, z, t: 0.9 });
    const spread = ids.length > 1 && (ord === Ord.Move || ord === Ord.AttackMove);
    const unitIds: number[] = [];
    for (const id of ids) {
      const e = this.ents[id];
      if (!e.alive || e.team !== 0) continue;
      if (isBuilding(e.kind)) {
        e.rallyX = x;
        e.rallyZ = z;
        continue;
      }
      unitIds.push(id);
    }
    let offsets: { dx: number; dz: number }[] | null = null;
    if (spread && unitIds.length > 1) {
      let maxR = 0.32;
      for (const id of unitIds) {
        maxR = Math.max(maxR, STATS[this.ents[id].kind].radius);
      }
      const spacing = clamp(maxR * 2.6, 0.7, 1.1);
      offsets = this.formationOffsets(unitIds.length, spacing);
    }
    for (let i = 0; i < unitIds.length; i++) {
      const e = this.ents[unitIds[i]];
      const gx = offsets ? x + offsets[i].dx : x;
      const gz = offsets ? z + offsets[i].dz : z;
      e.order = ord;
      e.tx = gx;
      e.tz = gz;
      e.tid = tid;
      e.path = this.pathfind(e.x, e.z, gx, gz);
      e.pathI = 0;
      if (e.kind === Kind.Shade) e.stealth = 0;
    }
  }

  tryAgeUp(team: number): boolean {
    const eco = this.teams[team];
    if (eco.epoch !== 0 || eco.ageT > 0) return false;
    if (eco.ore < 400 || eco.energy < 80) return false;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== team || e.kind !== Kind.Hall) continue;
      if (e.trainT > 0) return false;
    }
    eco.ore -= 400;
    eco.energy -= 80;
    eco.ageT = 40;
    return true;
  }

  tryTrain(building: Ent, kind: Kind): boolean {
    if (!building.alive || !isBuilding(building.kind)) return false;
    if (building.trainT > 0) return false;
    const st = STATS[kind];
    const eco = this.teams[building.team];
    if (building.kind === Kind.Hall && eco.ageT > 0) return false;
    if (building.kind === Kind.Barracks && eco.epoch < minTrainEpoch(kind)) return false;
    if (eco.ore < st.ore || eco.gas < st.gas || eco.energy < st.energy) return false;
    if (eco.pop + st.pop > eco.cap) return false;
    eco.ore -= st.ore;
    eco.gas -= st.gas;
    eco.energy -= st.energy;
    building.trainKind = kind;
    building.trainT = st.train;
    return true;
  }

  tryPlace(team: number, kind: Kind, x: number, z: number, builderId: number): boolean {
    const st = STATS[kind];
    const eco = this.teams[team];
    if (eco.ore < st.ore || eco.gas < st.gas || eco.energy < st.energy) return false;
    if (!this.canPlace(x, z, st.radius)) return false;
    const b = this.ents[builderId];
    if (!b?.alive || b.kind !== Kind.Worker) return false;
    eco.ore -= st.ore;
    eco.gas -= st.gas;
    eco.energy -= st.energy;
    const built = this.spawn(kind, this.civ[team], team, x, z);
    if (!built) return false;
    built.progress = BUILD_HP_START;
    built.hp = Math.max(1, st.hp * BUILD_HP_START);
    b.order = Ord.Build;
    b.tid = built.id;
    b.tx = x;
    b.tz = z;
    b.path = this.pathfind(b.x, b.z, x, z);
    b.pathI = 0;
    return true;
  }

  canPlace(x: number, z: number, r: number): boolean {
    const x0 = clamp(Math.floor(x - r), 0, MAP - 1);
    const x1 = clamp(Math.floor(x + r), 0, MAP - 1);
    const z0 = clamp(Math.floor(z - r), 0, MAP - 1);
    const z1 = clamp(Math.floor(z + r), 0, MAP - 1);
    for (let zz = z0; zz <= z1; zz++) {
      for (let xx = x0; xx <= x1; xx++) {
        if (this.block[xx + zz * MAP]) return false;
      }
    }
    this.hash.query(x, z, r + 1.2, this.q);
    for (const id of this.q) {
      const o = this.ents[id];
      if (!o.alive || !isBuilding(o.kind)) continue;
      if (dist2(x, z, o.x, o.z) < (r + o.radius) * (r + o.radius) * 0.85) return false;
    }
    return true;
  }

  step(): void {
    this.tick++;
    this.hash.clear();
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.hp <= 0) continue;
      e.px = e.x;
      e.pz = e.z;
      this.hash.insert(i, e.x, e.z);
    }
    this.thinkUnits();
    this.thinkBuildings();
    this.stepAge();
    this.stepCorpses();
    this.moveSeparate();
    this.stepBolts();
    this.stepSparks();
    this.updateFog();
    this.stepFlags();
    this.stepEnemyMarshal();
    this.stepMarshalPeel();
    this.stepAi();
    if ((this.tick & 7) === 0) this.recountPop();
    this.checkWinner();
  }

  private genMap(): void {
    const rng = mulberry32(this.seed);
    this.tiles.fill(Tile.Void);
    this.block.fill(0);
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const n = hash2(x, z, this.seed);
        const n2 = hash2(x + 40, z + 11, this.seed ^ 9);
        let t = Tile.Void;
        if (n > 0.46) t = Tile.Dust;
        if (n2 > 0.84) {
          t = Tile.Rock;
          this.block[x + z * MAP] = 1;
        }
        this.tiles[x + z * MAP] = t;
      }
    }
    const blobs = 18;
    for (let i = 0; i < blobs; i++) {
      const cx = 6 + (rng() * (MAP - 12)) | 0;
      const cz = 6 + (rng() * (MAP - 12)) | 0;
      const rad = 1.6 + rng() * 2.4;
      for (let z = -4; z <= 4; z++) {
        for (let x = -4; x <= 4; x++) {
          if (x * x + z * z > rad * rad) continue;
          const xx = cx + x;
          const zz = cz + z;
          if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) continue;
          this.tiles[xx + zz * MAP] = Tile.Rock;
          this.block[xx + zz * MAP] = 1;
        }
      }
    }
    this.stampPatch(Tile.Ore, 9, rng);
    this.stampPatch(Tile.Gas, 6, rng);
    this.stampPatch(Tile.Solar, 5, rng);
    this.stampOpeningGround();
    this.clearBase(10, 10);
    this.clearBase(MAP - 11, MAP - 11);
  }

  /** Dust pad + interior rocks + gem nodes + props under the opening camera frustum. */
  private stampOpeningGround(): void {
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    const icx = cx | 0;
    const icz = cz | 0;
    for (let z = -10; z <= 9; z++) {
      for (let x = -14; x <= 13; x++) {
        const xx = icx + x;
        const zz = icz + z;
        if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) continue;
        this.tiles[xx + zz * MAP] = Tile.Dust;
        this.block[xx + zz * MAP] = 0;
      }
    }
    const inFireLane = (zz: number): boolean => Math.abs(zz - icz) < 3.6;
    const onZFlank = (xx: number, zz: number): boolean =>
      Math.abs(xx - icx) <= 1.6 && Math.abs(zz - icz) >= 5.0 && Math.abs(zz - icz) <= 6.8;
    const stampCampPad = (hx: number, hz: number): void => {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = hx + dx;
          const zz = hz + dz;
          if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) continue;
          this.tiles[xx + zz * MAP] = Tile.Dust;
          this.block[xx + zz * MAP] = 0;
        }
      }
    };
    const placeRock = (xx: number, zz: number): void => {
      if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) return;
      if (inFireLane(zz) || !onZFlank(xx, zz)) return;
      this.tiles[xx + zz * MAP] = Tile.Rock;
      this.block[xx + zz * MAP] = 1;
    };
    const rockOffsets: [number, number][] = [
      [-1, -5],
      [0, -5],
      [1, -5],
      [-1, 6],
      [0, 6],
      [1, 6],
    ];
    for (const [dx, dz] of rockOffsets) placeRock(icx + dx, icz + dz);
    stampCampPad(icx, icz - 6);
    stampCampPad(icx, icz + 6);
    // Gems — ore among Helion workers, gas at +Z camp, solar east of north camp.
    this.placeOpeningNodeAt(Tile.Ore, cx - 0.25, cz - 5.35);
    this.placeOpeningNodeAt(Tile.Gas, cx + 1.1, cz + 5.35);
    this.placeOpeningNodeAt(Tile.Solar, cx + 1.1, cz - 5.35);
    // Contested mid ore + duel-lane boulders on the clash X (gap midpoint).
    this.placeOpeningNodeAt(Tile.Ore, cx, cz);
    this.placePropAt(Tile.PropWreck, cx, cz - 2.85);
    this.placePropAt(Tile.PropWreck, cx, cz + 2.85);
    const rockBillboards: [number, number][] = [
      [icx - 1, icz - 5],
      [icx, icz - 5],
      [icx + 1, icz - 5],
      [icx - 1, icz + 6],
      [icx, icz + 6],
      [icx + 1, icz + 6],
    ];
    for (const [px, pz] of rockBillboards) {
      if (inFireLane(pz)) continue;
      this.placeProp(Tile.PropWreck, px, pz);
    }
  }

  /** One ground tile + gem entity at exact world coords. */
  private placeOpeningNodeAt(kind: Tile, x: number, z: number): void {
    const cx = x | 0;
    const cz = z | 0;
    if (cx < 1 || cz < 1 || cx >= MAP - 1 || cz >= MAP - 1) return;
    this.tiles[cx + cz * MAP] = kind;
    this.block[cx + cz * MAP] = 0;
    const node = this.spawn(Kind.Resource, 'vespari', 3, x, z);
    if (node) {
      node.cargoType = kind;
      node.hp = kind === Tile.Ore ? 280 : kind === Tile.Gas ? 200 : 160;
      node.maxHp = node.hp;
      node.radius = 0.55;
    }
  }

  /** Decorative prop billboard — not gatherable. */
  private placeProp(kind: Tile, cx: number, cz: number): void {
    if (cx < 1 || cz < 1 || cx >= MAP - 1 || cz >= MAP - 1) return;
    const prop = this.spawn(Kind.Resource, 'vespari', 3, cx + 0.5, cz + 0.5);
    if (prop) {
      prop.cargoType = kind;
      prop.hp = 9999;
      prop.maxHp = 9999;
      prop.radius = 0.45;
    }
  }

  /** Prop billboard at exact world coords (duel-lane boulders). */
  private placePropAt(kind: Tile, x: number, z: number): void {
    if (x < 1 || z < 1 || x >= MAP - 1 || z >= MAP - 1) return;
    const prop = this.spawn(Kind.Resource, 'vespari', 3, x, z);
    if (prop) {
      prop.cargoType = kind;
      prop.hp = 9999;
      prop.maxHp = 9999;
      prop.radius = 0.45;
    }
  }

  private placePatch(kind: Tile, cx: number, cz: number, r: number): void {
    const r2 = r * r;
    for (let z = -3; z <= 3; z++) {
      for (let x = -3; x <= 3; x++) {
        if (x * x + z * z > r2) continue;
        const xx = cx + x;
        const zz = cz + z;
        if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) continue;
        this.tiles[xx + zz * MAP] = kind;
        this.block[xx + zz * MAP] = 0;
      }
    }
    const node = this.spawn(Kind.Resource, 'vespari', 3, cx + 0.5, cz + 0.5);
    if (node) {
      node.cargoType = kind;
      node.hp = kind === Tile.Ore ? 280 : kind === Tile.Gas ? 200 : 160;
      node.maxHp = node.hp;
    }
  }

  private openingClashEnt(e: Ent): boolean {
    if (!e.alive || e.team > 1) return false;
    if (e.kind !== Kind.Fighter && e.kind !== Kind.Ravager && e.kind !== Kind.Prism) return false;
    const dx = e.x - MAP * 0.5;
    const dz = e.z - MAP * 0.52;
    return dx * dx + dz * dz < 110;
  }

  private openingFlankCampEnt(e: Ent): boolean {
    if (!e.alive) return false;
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    const mdx = e.x - cx;
    const mdz = e.z - cz;
    if (Math.abs(mdx) > 1.2) return false;
    const adz = Math.abs(mdz);
    if (adz < 5.0 || adz > 6.8) return false;
    if (e.kind === Kind.House || e.kind === Kind.Worker) return true;
    if (e.kind !== Kind.Resource) return false;
    return e.cargoType !== Tile.PropWreck && e.cargoType !== Tile.PropVent;
  }

  private openingMidGemWorkerEnt(e: Ent): boolean {
    if (!e.alive || e.kind !== Kind.Worker) return false;
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    return Math.abs(e.tx - cx) < 0.15 && Math.abs(e.tz - cz) < 0.15;
  }

  private openingTableauWorker(e: Ent): boolean {
    return this.openingFlankCampEnt(e) || this.openingMidGemWorkerEnt(e);
  }

  private strikeRange(e: Ent, st: (typeof STATS)[number], t: Ent): number {
    let r = st.range + t.radius;
    if (this.tick < 240 && this.openingClashEnt(e) && !st.melee) r += 0.95;
    return r;
  }

  private openingDmgMul(attacker: Ent, target: Ent): number {
    if (this.tick >= 240 || !this.openingClashEnt(attacker)) return 1;
    if (target.team === 1) {
      if (this.tick < 50) return 1.15;
      return 0.15;
    }
    if (target.team === 0) return 0.35;
    return 1;
  }

  private revealOpeningVision(cx: number, cz: number): void {
    const icx = cx | 0;
    const icz = cz | 0;
    for (let z = icz - 10; z <= icz + 10; z++) {
      if (z < 0 || z >= MAP) continue;
      for (let x = icx - 14; x <= icx + 14; x++) {
        if (x < 0 || x >= MAP) continue;
        const idx = x + z * MAP;
        this.visible[0][idx] = 1;
        this.explored[0][idx] = 1;
      }
    }
  }

  private stampPatch(kind: Tile, count: number, rng: () => number): void {
    for (let i = 0; i < count; i++) {
      const cx = 8 + (rng() * (MAP - 16)) | 0;
      const cz = 8 + (rng() * (MAP - 16)) | 0;
      if ((cx < 18 && cz < 18) || (cx > MAP - 18 && cz > MAP - 18)) continue;
      const mdx = cx + 0.5 - MAP * 0.5;
      const mdz = cz + 0.5 - MAP * 0.52;
      if (mdx * mdx + mdz * mdz < 16 * 16) continue;
      const r = kind === Tile.Ore ? 2 : 1.6;
      this.placePatch(kind, cx, cz, r);
    }
  }

  private clearBase(cx: number, cz: number): void {
    for (let z = -6; z <= 6; z++) {
      for (let x = -6; x <= 6; x++) {
        const xx = cx + x;
        const zz = cz + z;
        if (xx < 0 || zz < 0 || xx >= MAP || zz >= MAP) continue;
        this.tiles[xx + zz * MAP] = Tile.Dust;
        this.block[xx + zz * MAP] = 0;
      }
    }
  }

  private spawnScenario(): void {
    const a = this.civ[0];
    const b = this.civ[1];
    this.spawn(Kind.Hall, a, 0, 10.5, 10.5);
    this.spawn(Kind.House, a, 0, 13.5, 8.5);
    this.spawn(Kind.House, a, 0, 12.0, 12.0);
    this.spawn(Kind.House, a, 0, 8.8, 9.0);
    this.spawn(Kind.Barracks, a, 0, 8.2, 13.6);
    this.spawn(Kind.Hall, b, 1, MAP - 10.5, MAP - 10.5);
    this.spawn(Kind.House, b, 1, MAP - 13.2, MAP - 8.4);
    this.spawn(Kind.House, b, 1, MAP - 12.0, MAP - 12.0);
    this.spawn(Kind.House, b, 1, MAP - 8.8, MAP - 9.0);
    this.spawn(Kind.Barracks, b, 1, MAP - 8.1, MAP - 13.5);

    for (let i = 0; i < 5; i++) {
      const w0 = this.spawn(Kind.Worker, a, 0, 12.2 + i * 0.55, 12.4);
      if (w0) {
        w0.order = Ord.Gather;
        w0.tx = 18;
        w0.tz = 16;
      }
      const w1 = this.spawn(Kind.Worker, b, 1, MAP - 12.2 - i * 0.55, MAP - 12.4);
      if (w1) {
        w1.order = Ord.Gather;
        w1.tx = MAP - 18;
        w1.tz = MAP - 16;
      }
    }
    this.spawn(Kind.Scout, a, 0, 16, 14);
    this.spawn(Kind.Scout, b, 1, MAP - 16, MAP - 14);

    // Opening clash — two 2×4 ranks on the same depth (X), split on Z; hold Attack in place.
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    const colPitch = 1.12;
    const rowPitch = 1.4;
    const gap = 3.6;
    const zHelion = cz - gap / 2;
    const zKryos = cz + gap / 2;
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = (i / 4) | 0;
      const x = cx + (row - 0.5) * rowPitch;
      const zOff = (col - 1.5) * colPitch;
      const f0 = this.spawn(Kind.Fighter, a, 0, x, zHelion + zOff);
      if (f0) {
        f0.order = Ord.Attack;
        f0.tx = x;
        f0.tz = zKryos + zOff;
        f0.cooldown = -0.08 * (i % 5);
      }
      const kryosLiving = (row === 0 && col >= 1 && col <= 2) || (row === 1 && col <= 2);
      const f1 = this.spawn(Kind.Fighter, b, 1, x, zKryos + zOff);
      if (f1) {
        if (kryosLiving) {
          f1.order = Ord.Attack;
          f1.tx = x;
          f1.tz = zHelion + zOff;
          f1.cooldown = -0.08 * ((i + 2) % 5);
        } else {
          f1.hp = 0;
          f1.corpseT = 4;
          f1.vx = f1.vz = 0;
          f1.path = null;
          f1.tid = -1;
          f1.order = Ord.Idle;
        }
      }
    }
    const rv = this.spawn(uniqueUnit(a), a, 0, cx - 1.35, zHelion);
    if (rv) {
      rv.order = Ord.Attack;
      rv.tx = cx - 1.35;
      rv.tz = zKryos;
      rv.cooldown = -0.15;
    }

    // Forward camps — workers + gem parked beyond Helion wing with visible Z gap.
    const oreX = cx - 0.25;
    const oreZ = cz - 5.35;
    const gasX = cx + 1.1;
    const gasZ = cz + 5.35;
    this.spawn(Kind.House, a, 0, cx, cz - 6.45);
    this.spawn(Kind.House, b, 1, cx, cz + 6.45);
    for (let i = 0; i < 3; i++) {
      const w = this.spawn(Kind.Worker, a, 0, cx - 1.0 + i * 0.75, cz - 5.35);
      if (w) {
        w.order = Ord.Gather;
        w.tx = oreX;
        w.tz = oreZ;
      }
    }
    for (let i = 0; i < 3; i++) {
      const wk = this.spawn(Kind.Worker, b, 1, cx - 1.0 + i * 0.75, cz + 5.35);
      if (wk) {
        wk.order = Ord.Gather;
        wk.tx = gasX;
        wk.tz = gasZ;
      }
    }

    // Contested mid gem — Helion workers gather between the firing wings.
    const midSpawns: [number, number][] = [
      [cx - 0.85, cz - 0.7],
      [cx + 0.85, cz - 0.7],
      [cx, cz + 0.85],
    ];
    for (const [wx, wz] of midSpawns) {
      const w = this.spawn(Kind.Worker, a, 0, wx, wz);
      if (w) {
        w.order = Ord.Gather;
        w.tx = cx;
        w.tz = cz;
      }
    }
  }

  private thinkUnits(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.hp <= 0 || isBuilding(e.kind) || e.kind === Kind.Resource) continue;
      const st = STATS[e.kind];
      e.cooldown = Math.max(0, e.cooldown - DT);
      e.blinkCd = Math.max(0, e.blinkCd - DT);
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - DT * 2.25);
      if (e.combatT > 0) e.combatT = Math.max(0, e.combatT - DT);
      e.anim += DT;
      if (e.frenzy > 0) e.frenzy = Math.max(0, e.frenzy - DT * 0.15);

      if (e.kind === Kind.Shade && e.order === Ord.Idle) e.stealth = Math.min(1, e.stealth + DT * 0.6);
      if (e.order === Ord.Attack || e.order === Ord.AttackMove) e.stealth = 0;

      let target: Ent | null = e.tid >= 0 ? this.ents[e.tid] : null;
      if (target && (!target.alive || target.hp <= 0)) {
        target = null;
        e.tid = -1;
      }

      const holdFire =
        this.tick < 240 && this.openingClashEnt(e) && e.order === Ord.Attack;

      if (e.order === Ord.Attack || e.order === Ord.AttackMove || e.order === Ord.Idle) {
        if (!target) target = this.acquire(e, st.los + 1.5);
        if (target) {
          e.tid = target.id;
          const d = Math.sqrt(dist2(e.x, e.z, target.x, target.z));
          const clashZ = MAP * 0.52;
          const crossedCenter = e.team === 0 ? e.z >= clashZ : e.z <= clashZ;
          const marchThrough =
            this.tick < 90 &&
            e.order === Ord.AttackMove &&
            this.openingClashEnt(e) &&
            !st.melee &&
            !crossedCenter;
          if (d <= this.strikeRange(e, st, target)) {
            this.tryStrike(e, target, st);
            if (holdFire || !marchThrough) {
              e.vx = e.vz = 0;
              e.path = null;
              if (holdFire) e.facing = target.x >= e.x ? 1 : -1;
              continue;
            }
          }
          if (e.order === Ord.Idle && d < st.los) {
            e.order = Ord.Attack;
            e.tx = target.x;
            e.tz = target.z;
          }
        }
      }

      if (holdFire) {
        e.vx = e.vz = 0;
        e.path = null;
        continue;
      }

      if (e.order === Ord.Gather || e.order === Ord.Return) this.thinkGather(e);
      else if (e.order === Ord.Build) this.thinkBuild(e);
      else if (e.order === Ord.Move || e.order === Ord.Attack || e.order === Ord.AttackMove) {
        const clashZ = MAP * 0.52;
        const crossedCenter = e.team === 0 ? e.z >= clashZ : e.z <= clashZ;
        const openingMarch =
          this.tick < 90 &&
          e.order === Ord.AttackMove &&
          this.openingClashEnt(e) &&
          !crossedCenter;
        const gx = target && e.order !== Ord.Move && !openingMarch ? target.x : e.tx;
        const gz = target && e.order !== Ord.Move && !openingMarch ? target.z : e.tz;
        this.steer(e, gx, gz, st.spd * (1 + e.frenzy * 0.08));
        if (e.order === Ord.Move && dist2(e.x, e.z, e.tx, e.tz) < 0.16) {
          e.order = Ord.Idle;
          e.vx = e.vz = 0;
          e.path = null;
        }
      } else {
        e.vx *= 0.7;
        e.vz *= 0.7;
      }

      if (e.kind === Kind.Shade && e.hp < e.maxHp * 0.35 && e.blinkCd <= 0 && target) {
        const ang = Math.atan2(e.z - target.z, e.x - target.x);
        e.x += Math.cos(ang) * 3.2;
        e.z += Math.sin(ang) * 3.2;
        e.x = clamp(e.x, 1, MAP - 1);
        e.z = clamp(e.z, 1, MAP - 1);
        e.blinkCd = 8;
        e.stealth = 1;
      }
    }
  }

  private thinkGather(e: Ent): void {
    const st = STATS[e.kind];
    const openingCampWorker =
      this.tick < 240 && e.kind === Kind.Worker && this.openingTableauWorker(e);
    if (!openingCampWorker && (e.cargo >= GATHER_MAX || e.order === Ord.Return)) {
      const hall = this.nearestHall(e.team, e.x, e.z);
      if (!hall) {
        e.order = Ord.Idle;
        return;
      }
      e.order = Ord.Return;
      if (dist2(e.x, e.z, hall.x, hall.z) < (hall.radius + 0.55) ** 2) {
        const eco = this.teams[e.team];
        if (e.cargoType === Tile.Ore) eco.ore += e.cargo;
        else if (e.cargoType === Tile.Gas) eco.gas += e.cargo;
        else eco.energy += e.cargo;
        e.cargo = 0;
        e.order = Ord.Gather;
      } else this.steer(e, hall.x, hall.z, st.spd);
      return;
    }
    let node = e.tid >= 0 ? this.ents[e.tid] : null;
    if (!node?.alive || node.kind !== Kind.Resource) node = this.nearestResource(e.x, e.z);
    if (!node) {
      e.order = Ord.Idle;
      return;
    }
    e.tid = node.id;
    const gatherR = openingCampWorker ? 2.05 : node.radius + 0.45;
    if (dist2(e.x, e.z, node.x, node.z) < gatherR * gatherR) {
      e.vx = e.vz = 0;
      e.path = null;
      if (e.cooldown <= 0) {
        e.cargo += 1;
        e.cargoType = node.cargoType;
        node.hp -= 1;
        e.cooldown = 0.55;
        if (node.hp <= 0) this.kill(node);
      }
    } else if (!openingCampWorker) this.steer(e, node.x, node.z, st.spd);
    else {
      e.vx = e.vz = 0;
      e.path = null;
    }
  }

  private thinkBuild(e: Ent): void {
    const st = STATS[e.kind];
    const b = e.tid >= 0 ? this.ents[e.tid] : null;
    if (!b?.alive) {
      e.order = Ord.Idle;
      return;
    }
    if (dist2(e.x, e.z, b.x, b.z) < (b.radius + 0.5) ** 2) {
      e.vx = e.vz = 0;
      b.progress = Math.min(1, b.progress + DT * 0.12);
      b.hp = Math.min(b.maxHp, b.maxHp * b.progress);
      if (b.progress >= 1) e.order = Ord.Idle;
    } else this.steer(e, b.x, b.z, st.spd);
  }

  private stepAge(): void {
    for (let t = 0; t < 2; t++) {
      const eco = this.teams[t];
      if (eco.ageT <= 0) continue;
      eco.ageT -= DT;
      if (eco.ageT <= 0) {
        eco.ageT = 0;
        if (eco.epoch === 0) eco.epoch = 1;
      }
    }
  }

  private thinkBuildings(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || !isBuilding(e.kind)) continue;
      if (e.progress < 1) continue;
      if (e.kind === Kind.Hall && e.civ === 'vespari') {
        // Slow self-repair.
        e.hp = Math.min(e.maxHp, e.hp + DT * 2);
      }
      if (e.kind === Kind.UniqueB && e.civ === 'vespari') {
        this.sporeT[e.team] += DT;
        if (this.sporeT[e.team] > 28) {
          this.sporeT[e.team] = 0;
          const eco = this.teams[e.team];
          if (eco.pop < eco.cap) {
            const w = this.spawn(Kind.Worker, e.civ, e.team, e.rallyX, e.rallyZ);
            if (w) {
              w.order = Ord.Gather;
            }
          }
        }
      }
      if (e.kind === Kind.UniqueB && e.civ === 'aurion' && e.cooldown <= 0) {
        const t = this.acquireTurret(e, STATS[Kind.UniqueB].range);
        if (t) {
          this.spawnBolt(e, t, STATS[Kind.UniqueB].atk, 9);
          e.cooldown = 1.1;
        }
      } else e.cooldown = Math.max(0, e.cooldown - DT);

      if (e.trainT > 0) {
        const spd = e.civ === 'vespari' ? 1.2 : 1;
        e.trainT -= DT * spd;
        if (e.trainT <= 0) {
          e.trainT = 0;
          const u = this.spawn(e.trainKind, e.civ, e.team, e.rallyX, e.rallyZ);
          if (u) {
            if (e.team === 1 && this.tick >= 240 && isUnit(u.kind) && u.kind !== Kind.Worker) {
              u.order = Ord.Idle;
              this.queueMarshalPeel(u);
            } else {
              u.order = Ord.AttackMove;
              u.tx = e.rallyX + (e.team === 0 ? 1 : -1);
              u.tz = e.rallyZ;
            }
          }
          this.recountPop();
        }
      }
    }
  }

  private tryStrike(e: Ent, t: Ent, st: typeof STATS[number]): void {
    if (e.cooldown > 0) return;
    if (this.tick < 240 && t.kind === Kind.Worker) return;
    const dmg = st.atk * (1 + e.frenzy * 0.12) * (e.civ === 'aurion' && isBuilding(e.kind) === false ? 1 : 1);
    const bonus = t.civ === 'aurion' ? 0.85 : 1; // compact armor
    const applied =
      dmg *
      (isBuilding(t.kind) && e.kind === Kind.Siege ? 1.8 : 1) *
      (e.civ === 'aurion' ? 0.92 : 1) *
      this.openingDmgMul(e, t);
    if (st.melee) {
      t.hp -= applied * bonus;
      if (t.team === 1 && this.tick < 240) t.hitFlash = 0.45;
      this.spawnSpark(t.x, t.z, 1, e.civ);
      this.markCombat(e, t);
      e.cooldown = e.kind === Kind.Ravager ? 0.72 : 0.85;
      if (e.kind === Kind.Ravager && t.hp <= 0) e.frenzy = Math.min(6, e.frenzy + 1);
    } else {
      const opening = this.tick < 240 && this.openingClashEnt(e);
      const spd = opening ? 6.0 : e.kind === Kind.Prism ? 11 : e.kind === Kind.Siege ? 6.5 : 8.5;
      const life = opening ? 1.4 : 1.1;
      this.spawnBolt(e, t, applied * bonus, spd, life);
      this.markCombat(e, t);
      e.cooldown = opening ? 0.32 : e.kind === Kind.Prism ? 1.15 : 0.95;
    }
    if (t.hp <= 0) this.kill(t);
  }

  private spawnBolt(e: Ent, t: Ent, dmg: number, spd: number, life = 1.1): void {
    const dx = t.x - e.x;
    const dz = t.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    this.bolts.push({
      x: e.x,
      z: e.z,
      vx: (dx / d) * spd,
      vz: (dz / d) * spd,
      team: e.team,
      civ: e.civ,
      dmg,
      life,
      kind: e.kind,
    });
    this.spawnSpark(e.x, e.z, 0, e.civ);
  }

  private spawnSpark(x: number, z: number, kind: number, civ: Civ): void {
    const s = this.sparks[this.sparkHead];
    this.sparkHead = (this.sparkHead + 1) % MAX_SPARKS;
    s.x = x;
    s.z = z;
    s.kind = kind;
    s.civ = civ;
    s.maxLife = kind === 0 ? 0.1 : 0.12;
    s.life = s.maxLife;
    s.active = true;
  }

  private stepSparks(): void {
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.sparks[i];
      if (!s.active) continue;
      s.life -= DT;
      if (s.life <= 0) s.active = false;
    }
  }

  private stepCorpses(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive) continue;
      if (e.dissolveT > 0) {
        e.dissolveT -= DT;
        if (e.dissolveT < 0) e.dissolveT = 0;
        continue;
      }
      if (e.corpseT <= 0) continue;
      e.corpseT -= DT;
      if (e.corpseT <= 0) {
        e.alive = false;
        e.dissolveT = 0;
        this.free.push(e.id);
      }
    }
  }

  private stepBolts(): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.x += b.vx * DT;
      b.z += b.vz * DT;
      b.life -= DT;
      let hit = false;
      this.hash.query(b.x, b.z, 0.7, this.q);
      for (const id of this.q) {
        const e = this.ents[id];
        if (!e.alive || e.hp <= 0 || e.team === b.team) continue;
        if (e.kind === Kind.Resource) continue;
        if (e.kind === Kind.Worker) continue;
        if (e.kind === Kind.Shade && e.stealth > 0.6) continue;
        if (dist2(b.x, b.z, e.x, e.z) < (e.radius + 0.25) ** 2) {
          e.hp -= b.dmg;
          if (e.team === 1 && this.tick < 240) e.hitFlash = 0.45;
          this.markCombat(e);
          this.spawnSpark(b.x, b.z, 1, b.civ);
          hit = true;
          if (e.hp <= 0) this.kill(e);
          break;
        }
      }
      if (hit || b.life <= 0 || b.x < 0 || b.z < 0 || b.x > MAP || b.z > MAP) {
        this.bolts.splice(i, 1);
      }
    }
  }

  private steer(e: Ent, gx: number, gz: number, spd: number): void {
    if (!e.path || e.pathI >= (e.path.length >> 1)) {
      e.path = this.pathfind(e.x, e.z, gx, gz);
      e.pathI = 0;
    }
    let tx = gx;
    let tz = gz;
    if (e.path && e.pathI < e.path.length >> 1) {
      tx = e.path[e.pathI * 2] + 0.5;
      tz = e.path[e.pathI * 2 + 1] + 0.5;
      if (dist2(e.x, e.z, tx, tz) < 0.35) e.pathI++;
    }
    const dx = tx - e.x;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.vx = (dx / d) * spd;
    e.vz = (dz / d) * spd;
    const nx = e.x + e.vx * DT;
    const nz = e.z + e.vz * DT;
    if (!this.blockedWorld(nx, nz)) {
      e.x = nx;
      e.z = nz;
    } else if (!this.blockedWorld(nx, e.z)) e.x = nx;
    else if (!this.blockedWorld(e.x, nz)) e.z = nz;
    else {
      e.path = this.pathfind(e.x, e.z, gx, gz);
      e.pathI = 0;
    }
    e.x = clamp(e.x, 0.6, MAP - 0.6);
    e.z = clamp(e.z, 0.6, MAP - 0.6);
    if (Math.abs(e.vx) > 0.05) e.facing = e.vx >= 0 ? 1 : -1;
  }

  private moveSeparate(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || !isUnit(e.kind)) continue;
      if (this.tick < 240 && this.openingClashEnt(e) && e.order === Ord.Attack) continue;
      if (this.tick < 240 && e.kind === Kind.Worker && this.openingTableauWorker(e)) continue;
      this.hash.query(e.x, e.z, 1.1, this.q);
      let sx = 0;
      let sz = 0;
      for (const id of this.q) {
        if (id === i) continue;
        const o = this.ents[id];
        if (!o.alive || !isUnit(o.kind)) continue;
        const d2 = dist2(e.x, e.z, o.x, o.z);
        const min = e.radius + o.radius;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const p = (min - d) / d;
          sx += (e.x - o.x) * p;
          sz += (e.z - o.z) * p;
        }
      }
      e.x += sx * 0.28;
      e.z += sz * 0.28;
    }
  }

  private acquire(e: Ent, los: number): Ent | null {
    let best: Ent | null = null;
    let bestD = los * los;
    this.hash.query(e.x, e.z, los, this.q);
    for (const id of this.q) {
      const o = this.ents[id];
      if (!o.alive || o.hp <= 0 || o.team === e.team) continue;
      if (o.kind === Kind.Resource) continue;
      if (o.kind === Kind.Shade && o.stealth > 0.55) continue;
      const d = dist2(e.x, e.z, o.x, o.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private acquireTurret(e: Ent, los: number): Ent | null {
    return this.acquire(e, los);
  }

  private nearestHall(team: number, x: number, z: number): Ent | null {
    let best: Ent | null = null;
    let bestD = 1e9;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== team || e.kind !== Kind.Hall || e.progress < 1) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private nearestResource(x: number, z: number): Ent | null {
    let best: Ent | null = null;
    let bestD = 1e9;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.kind !== Kind.Resource) continue;
      if (e.cargoType !== Tile.Ore && e.cargoType !== Tile.Gas && e.cargoType !== Tile.Solar) continue;
      const d = dist2(x, z, e.x, e.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  pathfind(sx: number, sz: number, gx: number, gz: number): number[] | null {
    const s = tileAt(sx, sz);
    const g = tileAt(gx, gz);
    if (s === g) return [g % MAP, (g / MAP) | 0];
    const stamp = this.stamp++;
    if (stamp > 65000) {
      this.closed.fill(0);
      this.stamp = 1;
    }
    const heap = this.heap;
    heap.clear();
    this.gScore[s] = 0;
    this.came[s] = -1;
    this.closed[s] = stamp;
    heap.push(0, s);
    let found = -1;
    let n = 0;
    while (heap.size && n++ < 1800) {
      const cur = heap.pop();
      if (cur === g) {
        found = cur;
        break;
      }
      const cx = cur % MAP;
      const cz = (cur / MAP) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k];
        const nz = cz + DZ[k];
        if (nx < 0 || nz < 0 || nx >= MAP || nz >= MAP) continue;
        const ni = nx + nz * MAP;
        if (this.block[ni] && ni !== g) continue;
        const ng = this.gScore[cur] + DC[k];
        if (this.closed[ni] === stamp && ng >= this.gScore[ni]) continue;
        this.closed[ni] = stamp;
        this.gScore[ni] = ng;
        this.came[ni] = cur;
        const h = Math.abs(nx - (g % MAP)) + Math.abs(nz - ((g / MAP) | 0));
        heap.push(ng + h, ni);
      }
    }
    if (found < 0) return null;
    const path: number[] = [];
    let c = found;
    while (c >= 0 && path.length < 160) {
      path.push(c % MAP, (c / MAP) | 0);
      c = this.came[c];
    }
    const out: number[] = [];
    for (let i = path.length - 2; i >= 0; i -= 2) {
      out.push(path[i], path[i + 1]);
    }
    return out.length ? out : null;
  }

  private blockedWorld(x: number, z: number): boolean {
    return !!this.block[tileAt(x, z)];
  }

  private updateFog(): void {
    this.visible[0].fill(0);
    this.visible[1].fill(0);
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team > 1) continue;
      const los = STATS[e.kind].los + (e.civ === 'voidmarked' ? 1 : 0);
      const r = Math.ceil(los);
      const vis = this.visible[e.team];
      const exp = this.explored[e.team];
      const cx = e.x | 0;
      const cz = e.z | 0;
      const los2 = los * los;
      for (let z = cz - r; z <= cz + r; z++) {
        if (z < 0 || z >= MAP) continue;
        for (let x = cx - r; x <= cx + r; x++) {
          if (x < 0 || x >= MAP) continue;
          const dx = x + 0.5 - e.x;
          const dz = z + 0.5 - e.z;
          if (dx * dx + dz * dz <= los2) {
            const idx = x + z * MAP;
            vis[idx] = 1;
            exp[idx] = 1;
          }
        }
      }
    }
    if (this.tick < 200) {
      const ocx = (MAP * 0.5) | 0;
      const ocz = (MAP * 0.52) | 0;
      for (let z = ocz - 10; z <= ocz + 10; z++) {
        if (z < 0 || z >= MAP) continue;
        for (let x = ocx - 14; x <= ocx + 14; x++) {
          if (x < 0 || x >= MAP) continue;
          const idx = x + z * MAP;
          this.visible[0][idx] = 1;
          this.explored[0][idx] = 1;
        }
      }
    }
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive) continue;
      if (e.team === 0) {
        e.vis = true;
        continue;
      }
      const idx = tileAt(e.x, e.z);
      e.vis = this.visible[0][idx] === 1 && !(e.kind === Kind.Shade && e.stealth > 0.55);
    }
    if (this.tick < 240) {
      for (let i = 0; i < MAX_ENTS; i++) {
        const e = this.ents[i];
        if (!e.alive) continue;
        if (this.openingClashEnt(e)) e.vis = true;
        if (this.openingFlankCampEnt(e) || this.openingMidGemWorkerEnt(e)) e.vis = true;
      }
    }
  }

  private stepFlags(): void {
    for (let i = this.flags.length - 1; i >= 0; i--) {
      this.flags[i].t -= DT;
      if (this.flags[i].t <= 0) this.flags.splice(i, 1);
    }
  }

  private orderAttackMoveHall(e: Ent, hall: Ent): void {
    e.order = Ord.AttackMove;
    e.tx = hall.x;
    e.tz = hall.z;
    e.tid = hall.id;
    e.path = null;
    e.pathI = 0;
  }

  private isRaidingPlayerHall(e: Ent): boolean {
    if (e.tid < 0) return false;
    const t = this.ents[e.tid];
    return !!t?.alive && t.team === 0 && t.kind === Kind.Hall && t.hp > 0;
  }

  private shouldMarshalPeel(e: Ent): boolean {
    if (!e.alive || e.team !== 1 || !isUnit(e.kind) || e.kind === Kind.Worker) return false;
    if (this.isRaidingPlayerHall(e)) return false;
    if (this.openingClashEnt(e)) return true;
    if (e.order === Ord.Idle) return true;
    if (e.order === Ord.AttackMove) return true;
    if (e.order === Ord.Attack) {
      const t = e.tid >= 0 ? this.ents[e.tid] : null;
      return !t || !t.alive || t.hp <= 0;
    }
    return false;
  }

  private buildMarshalPeelQueue(): void {
    const q: number[] = [];
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!this.shouldMarshalPeel(e)) continue;
      q.push(e.id);
    }
    q.sort((a, b) => a - b);
    this.marshalPeelQ = q;
    this.marshalPeelI = 0;
    this.marshalPeelBuilt = true;
  }

  private queueMarshalPeel(e: Ent): void {
    if (!this.shouldMarshalPeel(e)) return;
    if (!this.marshalPeelQ.includes(e.id)) this.marshalPeelQ.push(e.id);
  }

  /** Tick 240: off-screen Dominion for the enemy marshal; ore/gas/charge for mixed-arms Yard queue. */
  private stepEnemyMarshal(): void {
    if (this.tick < 240) return;
    const eco = this.teams[1];
    eco.ore = Math.max(eco.ore, 120);
    eco.gas = Math.max(eco.gas, 40);
    eco.energy = Math.max(eco.energy, 40);
    if (this.tick === 240) {
      eco.epoch = 2;
      eco.ageT = 0;
      eco.ore = Math.max(eco.ore, 500);
      eco.gas = Math.max(eco.gas, 120);
      eco.energy = Math.max(eco.energy, 160);
      for (let i = 0; i < MAX_ENTS; i++) {
        const e = this.ents[i];
        if (!e.alive || e.team !== 1) continue;
        if (e.kind === Kind.Barracks) {
          e.rallyX = MARSHAL_FORWARD_X;
          e.rallyZ = MARSHAL_FORWARD_Z;
          if (e.trainKind === Kind.Scout) {
            e.trainT = 0;
            e.trainKind = Kind.Worker;
          }
        }
        if (e.kind === Kind.Hall && e.trainKind === Kind.Scout) {
          e.trainT = 0;
          e.trainKind = Kind.Worker;
        }
      }
    }
    if (this.tick === 250 && !this.marshalSiegeSpawned) {
      this.marshalSiegeSpawned = true;
      const s = this.spawn(Kind.Siege, this.civ[1], 1, MARSHAL_FORWARD_X, MARSHAL_FORWARD_Z);
      if (s) {
        s.order = Ord.Idle;
        this.queueMarshalPeel(s);
      }
    }
    this.pumpMarshalTraining();
  }

  private pumpMarshalTraining(): void {
    const eco = this.teams[1];
    if (eco.epoch < minTrainEpoch(Kind.Fighter)) return;
    let hall: Ent | null = null;
    let barracks: Ent | null = null;
    let workers = 0;
    let fighters = 0;
    let sieges = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== 1) continue;
      if (e.kind === Kind.Hall) hall = e;
      if (e.kind === Kind.Barracks) barracks = e;
      if (e.kind === Kind.Worker) workers++;
      if (e.kind === Kind.Fighter && e.hp > 0) fighters++;
      if (e.kind === Kind.Siege && e.hp > 0) sieges++;
    }
    if (!barracks) return;
    const stS = STATS[Kind.Siege];
    if (
      barracks.trainT <= 0 &&
      eco.epoch >= minTrainEpoch(Kind.Siege) &&
      sieges < 1 &&
      eco.pop + stS.pop <= eco.cap &&
      eco.ore >= stS.ore &&
      eco.gas >= stS.gas &&
      eco.energy >= stS.energy
    ) {
      this.tryMarshalTrain(barracks, Kind.Siege);
      return;
    }
    const stF = STATS[Kind.Fighter];
    const room = eco.pop + stF.pop <= eco.cap;
    const pay = eco.ore >= stF.ore && eco.energy >= stF.energy;
    if (fighters >= 8 || !room || !pay) return;
    if (barracks.trainT <= 0) this.tryMarshalTrain(barracks, Kind.Fighter);
    if (hall && hall.trainT <= 0 && workers >= 8 && eco.ageT <= 0) {
      this.tryMarshalTrain(hall, Kind.Fighter);
    }
  }

  private tryMarshalTrain(building: Ent, kind: Kind): boolean {
    if (!this.tryTrain(building, kind)) return false;
    if (building.team === 1 && this.tick >= 240) {
      if (kind === Kind.Fighter) {
        building.trainT = Math.min(building.trainT, MARSHAL_FIGHTER_TRAIN);
      } else if (kind === Kind.Siege) {
        building.trainT = Math.min(building.trainT, MARSHAL_SIEGE_TRAIN);
      }
    }
    return true;
  }

  /** After opening clash, stagger enemy military toward the player Nexus. */
  private stepMarshalPeel(): void {
    if (this.tick < 240) return;
    const playerHall = this.nearestHall(0, 10.5, 10.5);
    if (!playerHall) return;
    if (!this.marshalPeelBuilt) this.buildMarshalPeelQueue();
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== 1 || !isUnit(e.kind) || e.kind === Kind.Worker) continue;
      this.queueMarshalPeel(e);
    }
    while (this.marshalPeelI < this.marshalPeelQ.length) {
      const peelAt = 240 + this.marshalPeelI * MARSHAL_PEEL_STAGGER_TICKS;
      if (this.tick < peelAt) break;
      const id = this.marshalPeelQ[this.marshalPeelI++];
      const e = this.ents[id];
      if (e.alive && this.shouldMarshalPeel(e)) this.orderAttackMoveHall(e, playerHall);
    }
  }

  private stepAi(): void {
    this.aiT += DT;
    if (this.aiT < 1.4) return;
    this.aiT = 0;
    const eco = this.teams[1];
    let hall: Ent | null = null;
    let barracks: Ent | null = null;
    let fighters = 0;
    let workers = 0;
    let military = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team !== 1) continue;
      if (e.kind === Kind.Hall) hall = e;
      if (e.kind === Kind.Barracks) barracks = e;
      if (e.kind === Kind.Fighter || e.kind === Kind.Ravager || e.kind === Kind.Prism) fighters++;
      if (isUnit(e.kind) && e.kind !== Kind.Worker) military++;
      if (e.kind === Kind.Worker) {
        workers++;
        if (e.order === Ord.Idle) {
          e.order = Ord.Gather;
        }
      }
    }
    if (hall && hall.trainT <= 0 && workers < 8 && eco.ore >= 50 && eco.pop < eco.cap) {
      this.tryTrain(hall, Kind.Worker);
    }
    if (barracks && barracks.trainT <= 0 && eco.pop < eco.cap) {
      const k = fighters > 6 && eco.gas >= 45 ? uniqueUnit(this.civ[1]) : Kind.Fighter;
      if (
        this.tick < 240 &&
        eco.epoch >= minTrainEpoch(k) &&
        eco.ore >= STATS[k].ore &&
        eco.gas >= STATS[k].gas &&
        eco.energy >= STATS[k].energy
      ) {
        this.tryTrain(barracks, k);
      } else if (
        this.tick < 240 &&
        this.tick >= 28 &&
        military < 5 &&
        eco.ore >= STATS[Kind.Scout].ore &&
        eco.energy >= STATS[Kind.Scout].energy
      ) {
        this.tryTrain(barracks, Kind.Scout);
      }
    }
    if (
      hall &&
      hall.trainT <= 0 &&
      workers >= 8 &&
      this.tick < 240 &&
      this.tick >= 28 &&
      military < 5 &&
      eco.pop + STATS[Kind.Scout].pop <= eco.cap &&
      eco.ore >= STATS[Kind.Scout].ore &&
      eco.energy >= STATS[Kind.Scout].energy
    ) {
      this.tryTrain(hall, Kind.Scout);
    }
  }

  recountPop(): void {
    for (const t of this.teams) {
      t.pop = 0;
      t.cap = 0;
    }
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i];
      if (!e.alive || e.team > 1) continue;
      if (e.hp <= 0 || e.corpseT > 0 || e.dissolveT > 0) continue;
      const st = STATS[e.kind];
      this.teams[e.team].pop += st.pop;
      if (e.kind === Kind.Hall && e.progress >= 1) this.teams[e.team].cap += POP_HALL;
      if (e.kind === Kind.House && e.progress >= 1) this.teams[e.team].cap += POP_HOUSE;
    }
  }
}
