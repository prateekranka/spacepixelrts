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
export const OVERLAY_EXPECTED_COLORS: Record<ForgeOverlayId, string> = {
  paths: '#00FF88',
  'hit-regions': '#FF3355',
  'line-of-sight': '#66CCFF',
  orders: '#FFCC00',
  facing: '#FF00FF',
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

const PERSPECTIVE_CHIP_LABELS: Record<'player' | 'rival' | 'omniscient', string> = {
  player: 'PLAYER KNOWLEDGE',
  rival: 'RIVAL KNOWLEDGE',
  omniscient: 'OMNISCIENT',
};

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
const PATH_LINE_WIDTH = 4;
const PATH_WAYPOINT_RADIUS = 5;
const FACING_SHAFT_WORLD = 1.45;
const FACING_LINE_WIDTH = 3.5;
const FACING_ARROW_LEN = 11;
const FACING_ARROW_HALF = 6;

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

/** Draw a filled waypoint marker at a projected screen point. */
export function drawPathWaypointMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius = PATH_WAYPOINT_RADIUS,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Screen-space facing shaft + arrowhead from foot to tip. */
export function drawFacingArrow(
  ctx: CanvasRenderingContext2D,
  footX: number,
  footY: number,
  tipX: number,
  tipY: number,
  color: string,
): void {
  const dx = tipX - footX;
  const dy = tipY - footY;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const backX = tipX - ux * FACING_ARROW_LEN;
  const backY = tipY - uy * FACING_ARROW_LEN;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = FACING_LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(footX, footY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(backX + px * FACING_ARROW_HALF, backY + py * FACING_ARROW_HALF);
  ctx.lineTo(backX - px * FACING_ARROW_HALF, backY - py * FACING_ARROW_HALF);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Development-only in-frame perspective label for review captures. */
export function drawPerspectiveChip(
  ctx: CanvasRenderingContext2D,
  perspective: 'player' | 'rival' | 'omniscient',
  canvasWidth: number,
): void {
  const label = PERSPECTIVE_CHIP_LABELS[perspective];
  ctx.save();
  ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const padX = 12;
  const padY = 8;
  const textW = ctx.measureText(label).width;
  const boxW = textW + padX * 2;
  const boxH = 28;
  const x = Math.max(14, (canvasWidth - boxW) / 2);
  const y = 52;
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle =
    perspective === 'omniscient' ? '#FFCC00' : perspective === 'rival' ? '#66CCFF' : '#00FF88';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = '#F0E7D2';
  ctx.fillText(label, x + padX, y + padY);
  ctx.restore();
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
      ctx.strokeStyle = OVERLAY_EXPECTED_COLORS['hit-regions'];
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
        const los = st?.los ?? 6;
        ctx.strokeStyle = OVERLAY_EXPECTED_COLORS['line-of-sight'];
        ctx.lineWidth = 1.25;
        projectedRing(ctx, view, e.x, e.z, los);
      }
    }

    if (e.kind === Kind.Resource) continue;

    if (overlays.paths && e.path && e.path.length >= 4) {
      const pathColor = OVERLAY_EXPECTED_COLORS.paths;
      const waypointCount = e.path.length >> 1;
      const startWaypoint = Math.max(0, Math.min(e.pathI, waypointCount - 1));
      const projectedWaypoints: { x: number; y: number }[] = [];
      ctx.strokeStyle = pathColor;
      ctx.lineWidth = PATH_LINE_WIDTH;
      ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      for (let wi = startWaypoint; wi < waypointCount; wi++) {
        const wx = e.path[wi * 2] + 0.5;
        const wz = e.path[wi * 2 + 1] + 0.5;
        const point = view.project(wx, 0.05, wz);
        ctx.lineTo(point.x, point.y);
        projectedWaypoints.push(point);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of projectedWaypoints) {
        drawPathWaypointMarker(ctx, point.x, point.y, pathColor);
      }
    }

    if (overlays.facing) {
      const angle = ((e.facing & 7) * Math.PI) / 4;
      const dx = Math.cos(angle) * FACING_SHAFT_WORLD;
      const dz = -Math.sin(angle) * FACING_SHAFT_WORLD;
      const tip = view.project(e.x + dx, 0.05, e.z + dz);
      drawFacingArrow(ctx, foot.x, foot.y, tip.x, tip.y, OVERLAY_EXPECTED_COLORS.facing);
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
      ctx.fillStyle = OVERLAY_EXPECTED_COLORS.orders;
      ctx.fillText(orderLabel, head.x, y);
    }

    if (overlays['entity-ids']) {
      const text = orderLabel !== null ? `${e.id}:${orderLabel}` : String(e.id);
      const head = view.project(e.x, 1.65, e.z);
      const y = head.y - (orderLabel !== null ? 32 : 18);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText(text, head.x, y);
      ctx.fillStyle = OVERLAY_EXPECTED_COLORS['entity-ids'];
      ctx.fillText(text, head.x, y);
    }
  }

  ctx.restore();
}
