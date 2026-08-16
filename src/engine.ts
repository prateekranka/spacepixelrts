/** P10 — deterministic tick, types, spatial hash. */

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
export const MAP = 72;
export const MAX_ENTS = 384;
export const CELL = 1;

export type Civ = 'vespari' | 'aurion' | 'voidmarked';

export const enum Tile {
  Void = 0,
  Dust = 1,
  Rock = 2,
  Ore = 3,
  Gas = 4,
  Solar = 5,
  PropWreck = 6,
  PropVent = 7,
}

export const enum Kind {
  Worker = 0,
  Scout = 1,
  Fighter = 2,
  Siege = 3,
  Ravager = 4,
  Prism = 5,
  Shade = 6,
  Hall = 10,
  House = 11,
  Barracks = 12,
  UniqueB = 13,
  Resource = 20,
}

export const enum Ord {
  Idle = 0,
  Move = 1,
  Attack = 2,
  Gather = 3,
  Return = 4,
  Build = 5,
  AttackMove = 6,
}

export interface Ent {
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
  cargo: number;
  cargoType: Tile;
  cooldown: number;
  anim: number;
  facing: number;
  stealth: number;
  frenzy: number;
  blinkCd: number;
  buildKind: Kind;
  progress: number;
  trainKind: Kind;
  trainT: number;
  rallyX: number;
  rallyZ: number;
  radius: number;
  vis: boolean;
  path: number[] | null;
  pathI: number;
  hitFlash: number;
  corpseT: number;
}

export interface TeamEco {
  ore: number;
  gas: number;
  energy: number;
  pop: number;
  cap: number;
  /** 0 Spark · 1 Orbit · 2 Dominion · 3 Apex */
  epoch: number;
  /** seconds remaining on current age-up research */
  ageT: number;
}

export interface Bolt {
  x: number;
  z: number;
  vx: number;
  vz: number;
  team: number;
  civ: Civ;
  dmg: number;
  life: number;
  kind: Kind;
}

export const MAX_SPARKS = 96;

/** Short-lived muzzle / impact burst (pooled, no per-tick alloc). */
export interface Spark {
  active: boolean;
  x: number;
  z: number;
  life: number;
  maxLife: number;
  /** 0 muzzle · 1 impact */
  kind: number;
  civ: Civ;
}

export function makeEnt(): Ent {
  return {
    id: 0,
    alive: false,
    kind: Kind.Worker,
    civ: 'vespari',
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
    cargo: 0,
    cargoType: Tile.Ore,
    cooldown: 0,
    anim: 0,
    facing: 1,
    stealth: 0,
    frenzy: 0,
    blinkCd: 0,
    buildKind: Kind.House,
    progress: 1,
    trainKind: Kind.Worker,
    trainT: 0,
    rallyX: 0,
    rallyZ: 0,
    radius: 0.3,
    vis: true,
    path: null,
    pathI: 0,
    hitFlash: 0,
    corpseT: 0,
  };
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, z: number, s: number): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n >>> 0) / 4294967296;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function tileAt(x: number, z: number): number {
  return clamp(Math.floor(x), 0, MAP - 1) + clamp(Math.floor(z), 0, MAP - 1) * MAP;
}

export class Spatial {
  readonly inv: number;
  readonly buckets: number[][];
  readonly w: number;
  constructor(map = MAP, cell = 2) {
    this.inv = 1 / cell;
    this.w = Math.ceil(map / cell);
    this.buckets = Array.from({ length: this.w * this.w }, () => []);
  }
  clear(): void {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
  }
  insert(id: number, x: number, z: number): void {
    const cx = clamp((x * this.inv) | 0, 0, this.w - 1);
    const cz = clamp((z * this.inv) | 0, 0, this.w - 1);
    this.buckets[cx + cz * this.w].push(id);
  }
  query(x: number, z: number, r: number, out: number[]): void {
    out.length = 0;
    const x0 = clamp(((x - r) * this.inv) | 0, 0, this.w - 1);
    const x1 = clamp(((x + r) * this.inv) | 0, 0, this.w - 1);
    const z0 = clamp(((z - r) * this.inv) | 0, 0, this.w - 1);
    const z1 = clamp(((z + r) * this.inv) | 0, 0, this.w - 1);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[cx + cz * this.w];
        for (let i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
  }
}

export class Heap {
  readonly d: number[] = [];
  get size(): number {
    return this.d.length >> 1;
  }
  push(pri: number, val: number): void {
    this.d.push(pri, val);
    this.up(this.size - 1);
  }
  pop(): number {
    const v = this.d[1];
    const last = this.d.length - 2;
    if (last > 0) {
      this.d[0] = this.d[last];
      this.d[1] = this.d[last + 1];
    }
    this.d.length = last;
    if (this.size > 0) this.down(0);
    return v;
  }
  clear(): void {
    this.d.length = 0;
  }
  private up(i: number): void {
    const { d } = this;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p * 2] <= d[i * 2]) break;
      this.swap(p, i);
      i = p;
    }
  }
  private down(i: number): void {
    const { d } = this;
    const n = this.size;
    for (;;) {
      let m = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && d[l * 2] < d[m * 2]) m = l;
      if (r < n && d[r * 2] < d[m * 2]) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
  }
  private swap(i: number, j: number): void {
    const { d } = this;
    const a = d[i * 2];
    const b = d[i * 2 + 1];
    d[i * 2] = d[j * 2];
    d[i * 2 + 1] = d[j * 2 + 1];
    d[j * 2] = a;
    d[j * 2 + 1] = b;
  }
}
