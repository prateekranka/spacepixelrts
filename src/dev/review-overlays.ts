/**
 * FRD-2a — forge review overlays (docs/FORGE_REVIEW_DECK.md).
 *
 * Pure drawing module: renders review overlays onto the renderer's existing
 * 2D overlay canvas via a post-draw hook. READ-ONLY over sim state — never
 * mutates World knowledge/discovery/orders/resources. The `world` argument is
 * typed as a structural minimal interface (engine Ent fields read directly),
 * so this module stays decoupled from sim internals.
 */

import { Kind } from '../engine';
import { STATS, isBuilding } from '../content';

export type ForgeOverlayId =
  | 'paths'
  | 'hit-regions'
  | 'line-of-sight'
  | 'orders'
  | 'facing'
  | 'entity-ids';

export const FORGE_OVERLAY_IDS: readonly ForgeOverlayId[] = [
  'paths',
  'hit-regions',
  'line-of-sight',
  'orders',
  'facing',
  'entity-ids',
];

/** High-contrast dev colors — deliberately not the shipped palette tokens. */
const OVERLAY_COLORS: Record<ForgeOverlayId, string> = {
  paths: '#00FF88',
  'hit-regions': '#FF3355',
  'line-of-sight': '#66CCFF',
  orders: '#FFCC00',
  facing: '#FFFFFF',
  'entity-ids': '#FF7700',
};

const ORDER_LABELS: readonly string[] = [
  'idle',
  'move',
  'attack',
  'gather',
  'return',
  'build',
  'attack-move',
]; // Indexed by engine Ord (Idle=0..AttackMove=6).

/** Structural mirror of the engine Ent fields overlays read (engine.ts TYPES ONLY). */
interface ForgeReviewEnt {
  readonly id: number;
  readonly alive: boolean;
  readonly kind: number;
  readonly team: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly x: number;
  readonly z: number;
  readonly px: number;
  readonly pz: number;
  readonly facing: number;
  readonly order: number;
  readonly radius: number;
  readonly vis: boolean;
  readonly path: number[] | null;
  readonly pathI: number;
  readonly tx: number;
  readonly tz: number;
  readonly tid: number;
}

interface ForgeReviewWorld {
  readonly ents: readonly ForgeReviewEnt[];
  readonly tick: number;
}

export interface ForgeOverlayProjector {
  project(x: number, y: number, z: number, out?: { x: number; y: number }): { x: number; y: number };
}

const LOS_SEGMENTS = 24;

/** World-space circle sampled in segments, projected to overlay space. */
function projectedRing(
  ctx: CanvasRenderingContext2D,
  view: ForgeOverlayProjector,
  x: number,
  z: number,
  radius: number,
): void {
  ctx.beginPath();
  for (let index = 0; index <= LOS_SEGMENTS; index++) {
    const angle = (index / LOS_SEGMENTS) * Math.PI * 2;
    const point = view.project(x + Math.cos(angle) * radius, 0.05, z + Math.sin(angle) * radius);
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

/**
 * Draw enabled forge review overlays. `perspective` gates line-of-sight rings
 * by team (player/rival/omniscient); the remaining overlays are inspection
 * tools and ignore team. Cost is O(ents) with bounded projection work.
 */
export function drawOverlays(
  ctx: CanvasRenderingContext2D,
  world: unknown,
  view: ForgeOverlayProjector,
  overlays: Record<ForgeOverlayId, boolean>,
  perspective: 'player' | 'rival' | 'omniscient' = 'player',
): void {
  const w = world as ForgeReviewWorld | null | undefined;
  if (!w || typeof w !== 'object' || !Array.isArray(w.ents)) return;
  if (!FORGE_OVERLAY_IDS.some((id) => overlays[id] === true)) return;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;

  for (const e of w.ents) {
    if (!e || !e.alive || e.hp <= 0) continue;
    const foot = view.project(e.x, 0.05, e.z);

    if (overlays['hit-regions']) {
      const building = isBuilding(e.kind as Kind);
      const rx = building ? e.radius * 38 + 10 : e.radius * 44 + 12;
      const ry = building ? e.radius * 14 + 4 : e.radius * 16 + 5;
      ctx.strokeStyle = OVERLAY_COLORS['hit-regions'];
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(foot.x, foot.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (overlays['line-of-sight']) {
      const showTeam0 = perspective === 'player' || perspective === 'omniscient';
      const showTeam1 = perspective === 'rival' || perspective === 'omniscient';
      if ((e.team === 0 && showTeam0) || (e.team === 1 && showTeam1)) {
        const st = STATS[e.kind];
        // LOS matches the sim's per-kind sight stat (sim.updateFog). Boosts /
        // tech bonuses are not mirrored here; this is a review aid, not the sim.
        const los = st?.los ?? 6;
        ctx.strokeStyle = OVERLAY_COLORS['line-of-sight'];
        ctx.lineWidth = 1.25;
        projectedRing(ctx, view, e.x, e.z, los);
      }
    }

    if (e.kind === Kind.Resource) continue;

    if (overlays.paths && e.path && e.path.length >= 4) {
      ctx.strokeStyle = OVERLAY_COLORS.paths;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      const waypointCount = e.path.length >> 1;
      const startWaypoint = Math.max(0, Math.min(e.pathI, waypointCount - 1));
      for (let wi = startWaypoint; wi < waypointCount; wi++) {
        const wx = e.path[wi * 2] + 0.5;
        const wz = e.path[wi * 2 + 1] + 0.5;
        const point = view.project(wx, 0.05, wz);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (overlays.facing) {
      // dir8 semantics (engine): 0=E 1=NE 2=N 3=NW 4=W 5=SW 6=S 7=SE, i.e. the
      // world offset for index d is (cos(d*PI/4), -sin(d*PI/4)).
      const angle = ((e.facing & 7) * Math.PI) / 4;
      const dx = Math.cos(angle) * 0.9;
      const dz = -Math.sin(angle) * 0.9;
      const tip = view.project(e.x + dx, 0.05, e.z + dz);
      ctx.strokeStyle = OVERLAY_COLORS.facing;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }

    const orderLabel =
      overlays.orders && e.order >= 0 && e.order < ORDER_LABELS.length
        ? ORDER_LABELS[e.order]
        : null;
    if (orderLabel !== null) {
      const head = view.project(e.x, 1.65, e.z);
      const y = head.y - 18;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(orderLabel, head.x, y);
      ctx.fillStyle = OVERLAY_COLORS.orders;
      ctx.fillText(orderLabel, head.x, y);
    }

    if (overlays['entity-ids']) {
      const text = orderLabel !== null ? `${e.id}:${orderLabel}` : String(e.id);
      const head = view.project(e.x, 1.65, e.z);
      const y = head.y - (orderLabel !== null ? 32 : 18);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, head.x, y);
      ctx.fillStyle = OVERLAY_COLORS['entity-ids'];
      ctx.fillText(text, head.x, y);
    }
  }

  ctx.restore();
}
