/** P20–P23 — civilizations, stats, costs. */

import { Kind, type Civ } from './engine';
import { STARHOLD_PALETTE as P } from './palette';

export const CIV_NAME: Record<Civ, string> = {
  vespari: 'Sunweaver',
  aurion: 'Gravemark',
  voidmarked: 'Nihiline',
};

export const ALL_CIVS: Civ[] = ['vespari', 'aurion', 'voidmarked'];

export interface CivProfile {
  subtitle: string;
  doctrine: string;
  edge: string;
  plan: string;
  startOre: number;
  startGas: number;
  startEnergy: number;
}

/** Opening identities are intentionally different before technology paths diverge. */
export const CIV_PROFILE: Record<Civ, CivProfile> = {
  vespari: {
    subtitle: 'Sunward network',
    doctrine: 'Solar geometry',
    edge: 'Flexible forward control',
    plan: 'Scout wide, then compress the frontier with energy and speed.',
    startOre: 220,
    startGas: 40,
    startEnergy: 110,
  },
  aurion: {
    subtitle: 'Ice cathedral',
    doctrine: 'Cold precision',
    edge: 'Durable positions',
    plan: 'Freeze the approach, hold long sight lines, and punish overreach.',
    startOre: 250,
    startGas: 45,
    startEnergy: 70,
  },
  voidmarked: {
    subtitle: 'Void mycelium',
    doctrine: 'Spore pressure',
    edge: 'Stealth and disruption',
    plan: 'Make unsafe ground, strike from concealment, and break the rhythm.',
    startOre: 200,
    startGas: 70,
    startEnergy: 90,
  },
};

/** Opponent for skirmish — always a different people. */
export function enemyCiv(player: Civ): Civ {
  if (player === 'vespari') return 'aurion';
  if (player === 'aurion') return 'vespari';
  return 'aurion';
}

export function parseBootCiv(search: string): Civ | null {
  const q = new URLSearchParams(search);
  const raw = q.get('civ') ?? q.get('p');
  if (!raw) return null;
  return ALL_CIVS.includes(raw as Civ) ? (raw as Civ) : null;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** Team accents are fixed to the Starhold tokens, not ad-hoc neon colors. */
export const TEAM_RGB: [number, number, number][] = [
  rgb(P.leaf),
  rgb(P.red),
  rgb(P.sky),
  rgb(P.amber),
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

export function hallName(_civ: Civ): string {
  return 'Nexus';
}

export function houseName(_civ: Civ): string {
  return 'Habitat';
}

export function barracksName(_civ: Civ): string {
  return 'Yard';
}

export function uniqueName(civ: Civ): string {
  if (civ === 'vespari') return 'Sunwell';
  if (civ === 'aurion') return 'Cryo Bastion';
  return 'Bloom Nest';
}

export function uniqueUnit(civ: Civ): Kind {
  if (civ === 'vespari') return Kind.Ravager;
  if (civ === 'aurion') return Kind.Prism;
  return Kind.Shade;
}

export function workerName(_civ: Civ): string {
  return 'Worker';
}

export function fighterName(_civ: Civ): string {
  return 'Fighter';
}

export function labelOf(kind: Kind, civ: Civ): string {
  if (kind === Kind.Hall) return hallName(civ);
  if (kind === Kind.House) return houseName(civ);
  if (kind === Kind.Barracks) return barracksName(civ);
  if (kind === Kind.UniqueB) return uniqueName(civ);
  if (kind === Kind.Worker) return workerName(civ);
  if (kind === Kind.Fighter) return fighterName(civ);
  if (kind === Kind.Ravager) return 'Solar Lance';
  if (kind === Kind.Prism) return 'Glacier Titan';
  if (kind === Kind.Shade) return 'Spore Rider';
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
export const POP_HALL = 10;
export const GATHER_MAX = 8;
export const BUILD_HP_START = 0.08;

export const EPOCH_NAME = ['Spark', 'Orbit', 'Dominion', 'Apex'] as const;

/** Minimum epoch to train a unit from the Yard (DESIGN §4). */
export function minTrainEpoch(kind: Kind): number {
  if (kind === Kind.Fighter || kind === Kind.Shade) return 1;
  if (kind === Kind.Siege || kind === Kind.Ravager || kind === Kind.Prism) return 2;
  return 0;
}
