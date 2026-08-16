/** Shared sim constants and enums. P10 owns behavior; these IDs are locked. */

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;
export const MAP = 64;
export const MAX_ENTS = 2048;
export const TILE_W = 64;
export const TILE_H = 32;
export const VERSION = '0.1.0-p01';

export type Civ = 'helion' | 'kryos' | 'nihiline';

export enum Kind {
  Worker = 0,
  Scout,
  Fighter,
  Siege,
  SolarLance,
  GlacierTitan,
  SporeRider,
  Nexus,
  Habitat,
  Yard,
  Foundry,
  Outpost,
  Sunwell,
  CryoBastion,
  BloomNest,
  Resource,
}

export enum Ord {
  Idle = 0,
  Move,
  Attack,
  AttackMove,
  Gather,
  Return,
  Build,
  Train,
  AgeUp,
}

export enum Tile {
  Void = 0,
  Dust,
  Rock,
  Ore,
  Gas,
  Solar,
}

export const TEAM_TINT = [
  [1, 0.82, 0.35],
  [1, 0.28, 0.28],
  [0.55, 0.75, 1],
  [0.85, 0.85, 0.9],
] as const;

export function isBuilding(k: Kind): boolean {
  return k >= Kind.Nexus && k <= Kind.BloomNest;
}

export function isUnit(k: Kind): boolean {
  return k <= Kind.SporeRider;
}

export function tileAt(x: number, z: number): number {
  const tx = x | 0;
  const tz = z | 0;
  if (tx < 0 || tz < 0 || tx >= MAP || tz >= MAP) return 0;
  return tx + tz * MAP;
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
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

export function hash2(x: number, z: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function iso(x: number, z: number): { sx: number; sy: number } {
  return { sx: (x - z) * (TILE_W / 2), sy: (x + z) * (TILE_H / 2) };
}

export function uniso(sx: number, sy: number): { x: number; z: number } {
  const x = sx / TILE_W + sy / TILE_H;
  const z = sy / TILE_H - sx / TILE_W;
  return { x, z };
}
