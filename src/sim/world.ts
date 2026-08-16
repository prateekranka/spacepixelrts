/** P01 stub world — living opening tableau. P10 replaces internals with SoA + command queue. */

import {
  DT,
  Kind,
  MAP,
  MAX_ENTS,
  Ord,
  Tile,
  clamp,
  dist2,
  hash2,
  mulberry32,
  tileAt,
  type Civ,
} from './engine';

export type Ent = {
  id: number;
  alive: boolean;
  kind: Kind;
  civ: Civ;
  team: number;
  x: number;
  z: number;
  px: number;
  pz: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  order: Ord;
  tx: number;
  tz: number;
  tid: number;
  anim: number;
  facing: number;
  radius: number;
  vis: boolean;
  cooldown: number;
};

export type Bolt = { x: number; z: number; vx: number; vz: number; team: number; dmg: number; life: number; kind: Kind };

function makeEnt(id: number): Ent {
  return {
    id,
    alive: false,
    kind: Kind.Worker,
    civ: 'helion',
    team: 0,
    x: 0,
    z: 0,
    px: 0,
    pz: 0,
    vx: 0,
    vz: 0,
    hp: 1,
    maxHp: 1,
    order: Ord.Idle,
    tx: 0,
    tz: 0,
    tid: -1,
    anim: 0,
    facing: 1,
    radius: 0.3,
    vis: true,
    cooldown: 0,
  };
}

const HP: Partial<Record<Kind, number>> = {
  [Kind.Worker]: 40,
  [Kind.Scout]: 45,
  [Kind.Fighter]: 80,
  [Kind.Siege]: 120,
  [Kind.SolarLance]: 70,
  [Kind.GlacierTitan]: 220,
  [Kind.SporeRider]: 50,
  [Kind.Nexus]: 2400,
  [Kind.Habitat]: 550,
  [Kind.Yard]: 1200,
};

const SPD: Partial<Record<Kind, number>> = {
  [Kind.Worker]: 1.15,
  [Kind.Scout]: 1.85,
  [Kind.Fighter]: 1.22,
  [Kind.Siege]: 0.52,
  [Kind.SolarLance]: 1.55,
  [Kind.GlacierTitan]: 0.42,
  [Kind.SporeRider]: 1.7,
};

const ATK: Partial<Record<Kind, number>> = {
  [Kind.Worker]: 5,
  [Kind.Scout]: 4,
  [Kind.Fighter]: 10,
  [Kind.Siege]: 42,
  [Kind.SolarLance]: 14,
  [Kind.GlacierTitan]: 55,
  [Kind.SporeRider]: 8,
};

export class World {
  readonly ents: Ent[] = Array.from({ length: MAX_ENTS }, (_, i) => makeEnt(i));
  readonly tiles = new Uint8Array(MAP * MAP);
  readonly block = new Uint8Array(MAP * MAP);
  readonly bolts: Bolt[] = [];
  tick = 0;
  seed = 0x5eed;
  ore = 220;
  vol = 40;
  chg = 90;
  pop = 0;
  cap = 15;
  private free: number[] = [];

  constructor() {
    for (let i = 0; i < MAX_ENTS; i++) this.free.push(i);
  }

  reset(seed = 0x5eed): void {
    this.seed = seed;
    this.tick = 0;
    this.bolts.length = 0;
    this.free.length = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      this.ents[i]!.alive = false;
      this.ents[i]!.id = i;
      this.free.push(i);
    }
    this.ore = 220;
    this.vol = 40;
    this.chg = 90;
    this.genMap();
    this.spawnScenario();
    this.recount();
  }

  spawn(kind: Kind, civ: Civ, team: number, x: number, z: number): Ent | null {
    const id = this.free.pop();
    if (id === undefined) return null;
    const e = this.ents[id]!;
    e.alive = true;
    e.kind = kind;
    e.civ = civ;
    e.team = team;
    e.x = e.px = x;
    e.z = e.pz = z;
    e.vx = e.vz = 0;
    e.hp = e.maxHp = HP[kind] ?? 40;
    e.order = Ord.Idle;
    e.tx = x;
    e.tz = z;
    e.tid = -1;
    e.anim = 0;
    e.facing = 1;
    e.radius = kind === Kind.Nexus ? 1.35 : kind === Kind.Habitat || kind === Kind.Yard ? 0.8 : 0.32;
    e.vis = true;
    e.cooldown = 0;
    return e;
  }

  issue(ids: number[], ord: Ord, x: number, z: number, tid: number): void {
    for (const id of ids) {
      const e = this.ents[id];
      if (!e?.alive || e.team !== 0) continue;
      if (e.kind >= Kind.Nexus) continue;
      e.order = ord;
      e.tx = x;
      e.tz = z;
      e.tid = tid;
    }
  }

  step(): void {
    this.tick++;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i]!;
      if (!e.alive) continue;
      e.px = e.x;
      e.pz = e.z;
      e.anim += DT;
      e.cooldown = Math.max(0, e.cooldown - DT);
      if (e.kind >= Kind.Nexus) continue;
      this.think(e);
    }
    this.separate();
    this.stepBolts();
  }

  private think(e: Ent): void {
    let target = e.tid >= 0 ? this.ents[e.tid] : null;
    if (target && !target.alive) {
      target = null;
      e.tid = -1;
    }
    if (e.order === Ord.Idle || e.order === Ord.AttackMove || e.order === Ord.Attack) {
      if (!target) target = this.acquire(e, 6);
      if (target) {
        e.tid = target.id;
        const d = Math.sqrt(dist2(e.x, e.z, target.x, target.z));
        const range = e.kind === Kind.SolarLance ? 4.2 : e.kind === Kind.Scout ? 2.6 : 0.75;
        if (d <= range + target.radius) {
          e.vx = e.vz = 0;
          this.strike(e, target);
          return;
        }
        if (e.order === Ord.Idle) e.order = Ord.Attack;
        this.steer(e, target.x, target.z);
        return;
      }
    }
    if (e.order === Ord.Move || e.order === Ord.AttackMove) {
      this.steer(e, e.tx, e.tz);
      if (dist2(e.x, e.z, e.tx, e.tz) < 0.16) {
        e.order = Ord.Idle;
        e.vx = e.vz = 0;
      }
      return;
    }
    e.vx *= 0.7;
    e.vz *= 0.7;
  }

  private strike(e: Ent, t: Ent): void {
    if (e.cooldown > 0) return;
    const dmg = ATK[e.kind] ?? 8;
    const ranged = e.kind === Kind.SolarLance || e.kind === Kind.Scout || e.kind === Kind.Siege || e.kind === Kind.GlacierTitan;
    if (ranged) {
      const dx = t.x - e.x;
      const dz = t.z - e.z;
      const d = Math.hypot(dx, dz) || 1;
      this.bolts.push({
        x: e.x,
        z: e.z,
        vx: (dx / d) * 9,
        vz: (dz / d) * 9,
        team: e.team,
        dmg,
        life: 0.9,
        kind: e.kind,
      });
      e.cooldown = 1.05;
    } else {
      t.hp -= dmg;
      e.cooldown = 0.85;
      if (t.hp <= 0) this.kill(t);
    }
  }

  private stepBolts(): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      b.x += b.vx * DT;
      b.z += b.vz * DT;
      b.life -= DT;
      let hit = false;
      for (let k = 0; k < MAX_ENTS; k++) {
        const e = this.ents[k]!;
        if (!e.alive || e.team === b.team || e.kind === Kind.Resource) continue;
        if (dist2(b.x, b.z, e.x, e.z) < (e.radius + 0.25) ** 2) {
          e.hp -= b.dmg;
          hit = true;
          if (e.hp <= 0) this.kill(e);
          break;
        }
      }
      if (hit || b.life <= 0) this.bolts.splice(i, 1);
    }
  }

  private steer(e: Ent, gx: number, gz: number): void {
    const spd = SPD[e.kind] ?? 1;
    const dx = gx - e.x;
    const dz = gz - e.z;
    const d = Math.hypot(dx, dz) || 1;
    e.vx = (dx / d) * spd;
    e.vz = (dz / d) * spd;
    const nx = e.x + e.vx * DT;
    const nz = e.z + e.vz * DT;
    if (!this.blocked(nx, nz)) {
      e.x = nx;
      e.z = nz;
    } else if (!this.blocked(nx, e.z)) e.x = nx;
    else if (!this.blocked(e.x, nz)) e.z = nz;
    e.x = clamp(e.x, 0.6, MAP - 0.6);
    e.z = clamp(e.z, 0.6, MAP - 0.6);
    if (Math.abs(e.vx) > 0.05) e.facing = e.vx >= 0 ? 1 : -1;
  }

  private separate(): void {
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i]!;
      if (!e.alive || e.kind >= Kind.Nexus) continue;
      let sx = 0;
      let sz = 0;
      for (let j = 0; j < MAX_ENTS; j++) {
        if (j === i) continue;
        const o = this.ents[j]!;
        if (!o.alive || o.kind >= Kind.Nexus) continue;
        const d2 = dist2(e.x, e.z, o.x, o.z);
        const min = e.radius + o.radius;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const p = (min - d) / d;
          sx += (e.x - o.x) * p;
          sz += (e.z - o.z) * p;
        }
      }
      e.x += sx * 0.22;
      e.z += sz * 0.22;
    }
  }

  private acquire(e: Ent, los: number): Ent | null {
    let best: Ent | null = null;
    let bestD = los * los;
    for (let i = 0; i < MAX_ENTS; i++) {
      const o = this.ents[i]!;
      if (!o.alive || o.team === e.team || o.kind === Kind.Resource) continue;
      const d = dist2(e.x, e.z, o.x, o.z);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private kill(e: Ent): void {
    if (!e.alive) return;
    e.alive = false;
    this.free.push(e.id);
    this.recount();
  }

  private blocked(x: number, z: number): boolean {
    return !!this.block[tileAt(x, z)];
  }

  private recount(): void {
    let pop = 0;
    let cap = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = this.ents[i]!;
      if (!e.alive || e.team !== 0) continue;
      if (e.kind < Kind.Nexus) pop++;
      if (e.kind === Kind.Nexus) cap += 10;
      if (e.kind === Kind.Habitat) cap += 5;
    }
    this.pop = pop;
    this.cap = cap;
  }

  private genMap(): void {
    this.tiles.fill(Tile.Void);
    this.block.fill(0);
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const n = hash2(x, z, this.seed);
        const n2 = hash2(x + 40, z + 11, this.seed ^ 9);
        let t = Tile.Void;
        if (n > 0.55) t = Tile.Dust;
        if (n2 > 0.86) {
          t = Tile.Rock;
          this.block[x + z * MAP] = 1;
        }
        this.tiles[x + z * MAP] = t;
      }
    }
    const rng = mulberry32(this.seed);
    for (let i = 0; i < 16; i++) {
      const cx = 6 + ((rng() * (MAP - 12)) | 0);
      const cz = 6 + ((rng() * (MAP - 12)) | 0);
      const rad = 1.4 + rng() * 2.2;
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
    this.stamp(Tile.Ore, 9, rng);
    this.stamp(Tile.Gas, 6, rng);
    this.stamp(Tile.Solar, 5, rng);
    this.clearBase(10, 10);
    this.clearBase(MAP - 11, MAP - 11);
  }

  private stamp(kind: Tile, count: number, rng: () => number): void {
    for (let i = 0; i < count; i++) {
      const cx = 8 + ((rng() * (MAP - 16)) | 0);
      const cz = 8 + ((rng() * (MAP - 16)) | 0);
      if ((cx < 18 && cz < 18) || (cx > MAP - 18 && cz > MAP - 18)) continue;
      const r = kind === Tile.Ore ? 2 : 1.6;
      for (let z = -3; z <= 3; z++) {
        for (let x = -3; x <= 3; x++) {
          if (x * x + z * z > r * r) continue;
          const xx = cx + x;
          const zz = cz + z;
          if (xx < 1 || zz < 1 || xx >= MAP - 1 || zz >= MAP - 1) continue;
          this.tiles[xx + zz * MAP] = kind;
          this.block[xx + zz * MAP] = 0;
        }
      }
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
    const a: Civ = 'helion';
    const b: Civ = 'nihiline';
    this.spawn(Kind.Nexus, a, 0, 10.5, 10.5);
    this.spawn(Kind.Habitat, a, 0, 13.5, 8.5);
    this.spawn(Kind.Yard, a, 0, 8.2, 13.6);
    this.spawn(Kind.Nexus, b, 1, MAP - 10.5, MAP - 10.5);
    this.spawn(Kind.Habitat, b, 1, MAP - 13.2, MAP - 8.4);
    this.spawn(Kind.Yard, b, 1, MAP - 8.1, MAP - 13.5);
    for (let i = 0; i < 5; i++) {
      const w0 = this.spawn(Kind.Worker, a, 0, 12.2 + i * 0.55, 12.4);
      if (w0) {
        w0.order = Ord.Move;
        w0.tx = 18;
        w0.tz = 16;
      }
      const w1 = this.spawn(Kind.Worker, b, 1, MAP - 12.2 - i * 0.55, MAP - 12.4);
      if (w1) {
        w1.order = Ord.Move;
        w1.tx = MAP - 18;
        w1.tz = MAP - 16;
      }
    }
    this.spawn(Kind.Scout, a, 0, 16, 14);
    this.spawn(Kind.Scout, b, 1, MAP - 16, MAP - 14);
    const mid = MAP * 0.5;
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = (i / 4) | 0;
      const f0 = this.spawn(Kind.Fighter, a, 0, mid - 6 + col * 0.9, mid - 3 + row * 0.85);
      const f1 = this.spawn(Kind.Fighter, b, 1, mid + 4 + col * 0.9, mid + 2 + row * 0.85);
      if (f0) {
        f0.order = Ord.AttackMove;
        f0.tx = mid + 5;
        f0.tz = mid + 4;
      }
      if (f1) {
        f1.order = Ord.AttackMove;
        f1.tx = mid - 5;
        f1.tz = mid - 3;
      }
    }
    const ln = this.spawn(Kind.SolarLance, a, 0, mid - 4.5, mid - 1.5);
    if (ln) {
      ln.order = Ord.AttackMove;
      ln.tx = mid + 4;
      ln.tz = mid + 3;
    }
    const sp = this.spawn(Kind.SporeRider, b, 1, mid + 6.5, mid + 3.2);
    if (sp) {
      sp.order = Ord.AttackMove;
      sp.tx = mid - 4;
      sp.tz = mid - 2;
    }
  }
}
