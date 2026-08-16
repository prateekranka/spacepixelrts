/** P20–P23 — civilizations, stats, costs. */

import { Kind, type Civ } from './engine';

export const CIV_NAME: Record<Civ, string> = {
  vespari: 'Vespari Hive',
  aurion: 'Aurion Compact',
  voidmarked: 'Voidmarked',
};

export const TEAM_RGB: [number, number, number][] = [
  [0.24, 0.78, 0.42],
  [0.92, 0.32, 0.28],
  [0.28, 0.58, 1.0],
  [0.95, 0.78, 0.22],
];

export interface Stats {
  hp: number;
  spd: number;
  atk: number;
  range: number;
  los: number;
  radius: number;
  ore: number;
  gas: number;
  energy: number;
  train: number;
  pop: number;
  melee: boolean;
  building: boolean;
}

export const STATS: Record<number, Stats> = {
  [Kind.Worker]: {
    hp: 45, spd: 1.85, atk: 5, range: 0.85, los: 4.5, radius: 0.28,
    ore: 50, gas: 0, energy: 0, train: 7, pop: 1, melee: true, building: false,
  },
  [Kind.Scout]: {
    hp: 32, spd: 3.15, atk: 3, range: 0.8, los: 9.5, radius: 0.26,
    ore: 40, gas: 0, energy: 10, train: 6, pop: 1, melee: true, building: false,
  },
  [Kind.Fighter]: {
    hp: 78, spd: 2.05, atk: 10, range: 3.1, los: 6, radius: 0.32,
    ore: 60, gas: 0, energy: 20, train: 9, pop: 1, melee: false, building: false,
  },
  [Kind.Siege]: {
    hp: 55, spd: 1.15, atk: 30, range: 6.2, los: 5, radius: 0.42,
    ore: 90, gas: 40, energy: 20, train: 16, pop: 2, melee: false, building: false,
  },
  [Kind.Ravager]: {
    hp: 96, spd: 2.35, atk: 13, range: 0.95, los: 5.5, radius: 0.36,
    ore: 75, gas: 30, energy: 10, train: 12, pop: 2, melee: true, building: false,
  },
  [Kind.Prism]: {
    hp: 150, spd: 1.15, atk: 20, range: 5.6, los: 6.5, radius: 0.4,
    ore: 110, gas: 45, energy: 30, train: 18, pop: 2, melee: false, building: false,
  },
  [Kind.Shade]: {
    hp: 48, spd: 2.75, atk: 8, range: 3.4, los: 10.5, radius: 0.28,
    ore: 65, gas: 40, energy: 15, train: 11, pop: 1, melee: false, building: false,
  },
  [Kind.Hall]: {
    hp: 1400, spd: 0, atk: 0, range: 0, los: 8, radius: 1.35,
    ore: 350, gas: 0, energy: 0, train: 0, pop: 0, melee: true, building: true,
  },
  [Kind.House]: {
    hp: 420, spd: 0, atk: 0, range: 0, los: 4, radius: 0.85,
    ore: 60, gas: 0, energy: 0, train: 0, pop: 0, melee: true, building: true,
  },
  [Kind.Barracks]: {
    hp: 780, spd: 0, atk: 0, range: 0, los: 5, radius: 1.05,
    ore: 150, gas: 0, energy: 20, train: 0, pop: 0, melee: true, building: true,
  },
  [Kind.UniqueB]: {
    hp: 560, spd: 0, atk: 12, range: 6.5, los: 7, radius: 0.95,
    ore: 120, gas: 50, energy: 20, train: 0, pop: 0, melee: false, building: true,
  },
  [Kind.Resource]: {
    hp: 220, spd: 0, atk: 0, range: 0, los: 0, radius: 0.7,
    ore: 0, gas: 0, energy: 0, train: 0, pop: 0, melee: true, building: true,
  },
};

export function hallName(civ: Civ): string {
  if (civ === 'vespari') return 'Chitin Nexus';
  if (civ === 'aurion') return 'Prism Keep';
  return 'Umbra Sanctum';
}

export function houseName(civ: Civ): string {
  if (civ === 'vespari') return 'Brood Pod';
  if (civ === 'aurion') return 'Facet Lodge';
  return 'Veil Crypt';
}

export function barracksName(civ: Civ): string {
  if (civ === 'vespari') return 'Mandible Spire';
  if (civ === 'aurion') return 'Lattice Yard';
  return 'Rift Dock';
}

export function uniqueName(civ: Civ): string {
  if (civ === 'vespari') return 'Spore Nursery';
  if (civ === 'aurion') return 'Refraction Spire';
  return 'Umbra Relay';
}

export function uniqueUnit(civ: Civ): Kind {
  if (civ === 'vespari') return Kind.Ravager;
  if (civ === 'aurion') return Kind.Prism;
  return Kind.Shade;
}

export function workerName(civ: Civ): string {
  if (civ === 'vespari') return 'Larva Drone';
  if (civ === 'aurion') return 'Shard Wright';
  return 'Wake Binder';
}

export function fighterName(civ: Civ): string {
  if (civ === 'vespari') return 'Stinger';
  if (civ === 'aurion') return 'Facet Lance';
  return 'Rift Blade';
}

export function labelOf(kind: Kind, civ: Civ): string {
  if (kind === Kind.Hall) return hallName(civ);
  if (kind === Kind.House) return houseName(civ);
  if (kind === Kind.Barracks) return barracksName(civ);
  if (kind === Kind.UniqueB) return uniqueName(civ);
  if (kind === Kind.Worker) return workerName(civ);
  if (kind === Kind.Fighter) return fighterName(civ);
  if (kind === Kind.Ravager) return 'Ravager';
  if (kind === Kind.Prism) return 'Prism Guard';
  if (kind === Kind.Shade) return 'Phase Shade';
  if (kind === Kind.Scout) return 'Scout';
  if (kind === Kind.Siege) return 'Breaker';
  return 'Unknown';
}

export function isBuilding(k: Kind): boolean {
  return k >= Kind.Hall && k < Kind.Resource;
}

export function isUnit(k: Kind): boolean {
  return k < Kind.Hall;
}

export const POP_HOUSE = 5;
export const POP_HALL = 5;
export const GATHER_MAX = 8;
export const BUILD_HP_START = 0.08;
