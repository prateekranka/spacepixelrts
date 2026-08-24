import type { FactionId } from './match-config';

/** Logical scene dimensions. CSS scales this buffer with object-fit: cover. */
export const SCENE_WIDTH = 960;
export const SCENE_HEIGHT = 540;
export const SCENE_FPS = 12;
export const SCENE_STEP_MS = 1000 / SCENE_FPS;

export type SceneId = 'sunweaver-capital' | 'gravemark-quarry';
export type SceneMode = 'menu' | 'loading';
export type FrontEndSceneMode = SceneMode;

export interface FrontEndSceneOptions {
  readonly faction?: FactionId;
  readonly mode?: SceneMode;
  readonly reducedMotion?: boolean;
}

export interface FrontEndSceneRenderer {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly sceneId: SceneId;
  setFaction(faction: FactionId): void;
  setMode(mode: SceneMode): void;
  setReducedMotion(reduced: boolean): void;
  destroy(): void;
}

/** Controller name used by the menu and loading containers. */
export interface FrontEndSceneController extends FrontEndSceneRenderer {}

/** Map the two canonical factions to their distinct procedural scene packs. */
export function sceneForFaction(faction: FactionId): SceneId {
  return faction === 'sunweaver' ? 'sunweaver-capital' : 'gravemark-quarry';
}

/** Return the discrete scene frame for a browser clock value. */
export function quantizeSceneTime(timeMs: number, fps = SCENE_FPS): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0 || !Number.isFinite(fps) || fps <= 0) return 0;
  return Math.floor(timeMs / (1000 / fps));
}

/** Non-essential motion is removed in Reduced Motion mode. */
export function sceneMotionFrame(frame: number, reducedMotion: boolean): number {
  if (reducedMotion || !Number.isFinite(frame)) return 0;
  return Math.max(0, Math.floor(frame));
}

/** A deterministic movement helper used by the renderer and pure tests. */
export function sceneMotionOffset(
  frame: number,
  amplitude: number,
  phase = 0,
  reducedMotion = false,
): number {
  if (reducedMotion || !Number.isFinite(amplitude) || amplitude === 0) return 0;
  const safeFrame = sceneMotionFrame(frame, false);
  return Math.round(Math.sin(safeFrame * 0.17 + phase) * amplitude);
}

interface ScenePalette {
  readonly skyTop: string;
  readonly skyHorizon: string;
  readonly skyGlow: string;
  readonly star: string;
  readonly body: string;
  readonly bodyBright: string;
  readonly far: string;
  readonly mid: string;
  readonly ground: string;
  readonly foreground: string;
  readonly accent: string;
  readonly accentSoft: string;
  readonly light: string;
}

const SUNWEAVER: ScenePalette = {
  skyTop: '#26151e',
  skyHorizon: '#e1834e',
  skyGlow: '#ffd49b',
  star: '#fff4d4',
  body: '#db632c',
  bodyBright: '#fff1ad',
  far: '#7d3f39',
  mid: '#4b2a32',
  ground: '#261922',
  foreground: '#120f17',
  accent: '#f6c95f',
  accentSoft: '#d9f1dc',
  light: '#fff9d5',
};

const GRAVEMARK: ScenePalette = {
  skyTop: '#0a111b',
  skyHorizon: '#203548',
  skyGlow: '#91c9dc',
  star: '#d2e6ee',
  body: '#526578',
  bodyBright: '#d0edf4',
  far: '#263844',
  mid: '#17252f',
  ground: '#101921',
  foreground: '#080e14',
  accent: '#81c8bb',
  accentSoft: '#9ecfe7',
  light: '#c8f1e7',
};

interface DrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: ScenePalette;
  readonly frame: number;
  readonly mode: SceneMode;
  readonly reducedMotion: boolean;
}

function hash(index: number, salt: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 17, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 13;
  return (value >>> 0) / 0x100000000;
}

function rgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly number[], fill: string): void {
  if (points.length < 6) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.closePath();
  ctx.fill();
}

function line(ctx: CanvasRenderingContext2D, points: readonly number[], stroke: string, width = 1): void {
  if (points.length < 4) return;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.stroke();
}

function drawSkyAndStars({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.58, palette.skyHorizon);
  gradient.addColorStop(1, palette.skyGlow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  // Stars stay in the upper field so the menu's right-side copy remains readable.
  for (let index = 0; index < 92; index += 1) {
    const x = Math.floor(hash(index, 11) * 660 + 16);
    const y = Math.floor(hash(index, 23) * 205 + 14);
    const size = hash(index, 31) > 0.88 ? 2 : 1;
    const twinkle = reducedMotion ? 0.72 : 0.46 + (Math.sin(frame * 0.19 + index * 1.7) + 1) * 0.18;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = palette.star;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawSunweaverBody({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  const x = 171;
  const y = 204;
  const radius = 122;
  const halo = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 1.42);
  halo.addColorStop(0, rgba(palette.bodyBright, 0.72));
  halo.addColorStop(0.52, rgba(palette.body, 0.3));
  halo.addColorStop(1, rgba(palette.body, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - 185, y - 185, 370, 370);
  ctx.fillStyle = palette.bodyBright;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  for (let band = 0; band < 19; band += 1) {
    const bandY = y - radius + Math.floor(hash(band, 41) * radius * 2);
    const bandHeight = 2 + Math.floor(hash(band, 43) * 8);
    ctx.globalAlpha = 0.1 + hash(band, 47) * 0.17;
    ctx.fillStyle = band % 2 === 0 ? palette.body : '#fff8c7';
    ctx.fillRect(x - radius, bandY, radius * 2, bandHeight);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  const pulse = reducedMotion ? 0 : sceneMotionOffset(frame, 2, 1.2) ;
  ctx.strokeStyle = rgba(palette.light, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + 3 + pulse, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
}

function drawGravemarkBody({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  const x = 170;
  const y = 142;
  const radius = 103;
  const halo = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.55);
  halo.addColorStop(0, rgba(palette.bodyBright, 0.24));
  halo.addColorStop(1, rgba(palette.body, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - 165, y - 165, 330, 330);
  ctx.fillStyle = palette.body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
  ctx.clip();
  for (let shard = 0; shard < 22; shard += 1) {
    const sx = x - radius + Math.floor(hash(shard, 59) * radius * 1.8);
    const sy = y - radius + Math.floor(hash(shard, 61) * radius * 1.7);
    const width = 8 + Math.floor(hash(shard, 67) * 35);
    line(ctx, [sx, sy, sx + width, sy + 2 + Math.floor(hash(shard, 71) * 9)], rgba(palette.bodyBright, 0.16), 2);
  }
  ctx.restore();
  ctx.strokeStyle = rgba(palette.bodyBright, 0.6);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, Math.PI * 0.17, Math.PI * 1.34);
  ctx.stroke();
  const drift = reducedMotion ? 0 : sceneMotionOffset(frame, 5, 0.6);
  for (let asteroid = 0; asteroid < 7; asteroid += 1) {
    const ax = Math.round(315 + asteroid * 47 + drift * (asteroid % 2 === 0 ? 1 : -1));
    const ay = Math.round(71 + (asteroid % 3) * 42 + hash(asteroid, 79) * 24);
    polygon(ctx, [ax, ay, ax + 7, ay - 4, ax + 14, ay + 2, ax + 8, ay + 10, ax - 2, ay + 7], palette.bodyBright);
  }
}

function drawSunweaverFarTerrain({ ctx, palette }: DrawContext): void {
  polygon(ctx, [0, 332, 88, 305, 156, 319, 224, 290, 302, 320, 380, 287, 452, 317, 522, 300, 602, 326, 700, 290, 780, 316, 860, 298, 960, 322, 960, 540, 0, 540], palette.far);
  polygon(ctx, [0, 364, 96, 342, 191, 349, 260, 331, 347, 354, 428, 323, 522, 352, 622, 333, 708, 356, 803, 326, 960, 350, 960, 540, 0, 540], palette.mid);
  for (let index = 0; index < 12; index += 1) {
    const x = 34 + index * 71;
    const y = 331 + Math.floor(hash(index, 91) * 32);
    line(ctx, [x, y, x + 26, y - 14, x + 47, y], rgba(palette.skyGlow, 0.18), 1);
  }
}

function drawGravemarkFarTerrain({ ctx, palette }: DrawContext): void {
  polygon(ctx, [0, 310, 80, 274, 162, 302, 246, 251, 324, 306, 405, 265, 496, 309, 588, 273, 670, 301, 764, 256, 860, 306, 960, 280, 960, 540, 0, 540], palette.far);
  polygon(ctx, [0, 355, 94, 324, 180, 342, 263, 300, 349, 345, 430, 311, 531, 347, 631, 316, 746, 350, 837, 310, 960, 341, 960, 540, 0, 540], palette.mid);
  for (let index = 0; index < 9; index += 1) {
    const x = 50 + index * 99;
    line(ctx, [x, 330, x + 25, 300 - Math.floor(hash(index, 101) * 25), x + 53, 331], rgba(palette.accentSoft, 0.16), 2);
  }
}

function drawSolarLattice(ctx: CanvasRenderingContext2D, palette: ScenePalette): void {
  ctx.save();
  ctx.translate(470, 392);
  ctx.strokeStyle = rgba(palette.accent, 0.74);
  ctx.lineWidth = 2;
  for (let row = 0; row < 5; row += 1) {
    const y = -206 + row * 37;
    ctx.beginPath();
    ctx.moveTo(-64 + row * 7, y);
    ctx.lineTo(66 - row * 7, y);
    ctx.stroke();
  }
  for (let column = -3; column <= 3; column += 1) {
    ctx.beginPath();
    ctx.moveTo(column * 19, -220);
    ctx.lineTo(column * 13, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSunweaverSettlement({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  const base = 401;
  // Tall tapered capital. The right side stops before the protected UI zone.
  polygon(ctx, [408, base, 428, 184, 454, 118, 486, 103, 514, 118, 540, 184, 561, base], palette.foreground);
  line(ctx, [454, 118, 486, 103, 514, 118], rgba(palette.light, 0.72), 2);
  line(ctx, [428, 184, 540, 184], rgba(palette.accentSoft, 0.55), 1);
  line(ctx, [408, base, 561, base], rgba(palette.light, 0.63), 2);
  drawSolarLattice(ctx, palette);
  for (let row = 0; row < 7; row += 1) {
    const y = 213 + row * 23;
    const width = 58 - row * 5;
    for (let column = -2; column <= 2; column += 1) {
      const x = Math.round(484 + column * 14 + (row % 2) * 4);
      ctx.globalAlpha = ((row * 5 + column * 3 + Math.floor(frame / 3)) % 7) > 1 || reducedMotion ? 0.9 : 0.25;
      ctx.fillStyle = column === 0 ? palette.light : palette.accent;
      ctx.fillRect(x, y, Math.max(2, Math.floor(width / 14)), 5);
    }
  }
  ctx.globalAlpha = 1;
  for (let wing = 0; wing < 3; wing += 1) {
    const x = 336 + wing * 112;
    const height = 44 + wing * 13;
    polygon(ctx, [x, base, x + 14, base - height, x + 43, base - height + 12, x + 54, base], palette.foreground);
    line(ctx, [x + 14, base - height, x + 43, base - height + 12], rgba(palette.accentSoft, 0.42), 1);
  }
}

function drawGravemarkSettlement({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  const base = 411;
  // Low, wide fortress with three readable quarry tiers.
  polygon(ctx, [208, base, 214, 367, 263, 350, 302, 323, 351, 342, 403, 305, 467, 333, 528, 313, 596, 346, 646, 335, 682, 370, 694, base], palette.foreground);
  polygon(ctx, [245, 369, 311, 337, 382, 354, 432, 321, 497, 347, 556, 326, 624, 361, 614, base, 242, base], palette.ground);
  line(ctx, [214, 367, 263, 350, 302, 323, 351, 342, 403, 305, 467, 333, 528, 313, 596, 346, 646, 335, 682, 370], rgba(palette.accentSoft, 0.58), 2);
  for (let shaft = 0; shaft < 4; shaft += 1) {
    const x = 282 + shaft * 92;
    ctx.fillStyle = palette.mid;
    ctx.fillRect(x, 366 - (shaft % 2) * 7, 26, 45);
    ctx.strokeStyle = rgba(palette.accent, 0.5);
    ctx.strokeRect(x + 0.5, 366.5 - (shaft % 2) * 7, 25, 44);
    line(ctx, [x + 4, 369 - (shaft % 2) * 7, x + 21, 404], rgba(palette.accentSoft, 0.32), 1);
  }
  // Crane arms and conveyors create an industrial silhouette.
  for (let crane = 0; crane < 3; crane += 1) {
    const x = 326 + crane * 119;
    const lift = reducedMotion ? 0 : sceneMotionOffset(frame, 3, crane * 0.8);
    line(ctx, [x, 355, x, 269, x + 58, 269], rgba(palette.accentSoft, 0.67), 3);
    line(ctx, [x + 51, 269, x + 51, 308 + lift], rgba(palette.accent, 0.55), 1);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + 46, Math.round(305 + lift), 11, 8);
  }
  line(ctx, [251, 393, 651, 393], rgba(palette.accent, 0.66), 4);
  for (let roller = 0; roller < 14; roller += 1) {
    const x = 258 + roller * 29;
    ctx.fillStyle = palette.accentSoft;
    ctx.fillRect(x, 390, 11, 3);
  }
}

function drawSunweaverGround({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 402, SCENE_WIDTH, 138);
  for (let row = 0; row < 9; row += 1) {
    const y = 419 + row * 13;
    line(ctx, [0, y, 705, y + (reducedMotion ? 0 : sceneMotionOffset(frame, 1, row))], rgba(palette.accentSoft, 0.12), 1);
  }
  // Quiet landing strip keeps the lower-center loading status readable.
  ctx.fillStyle = rgba(palette.foreground, 0.68);
  ctx.fillRect(257, 465, 432, 75);
}

function drawGravemarkGround({ ctx, palette }: DrawContext): void {
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 407, SCENE_WIDTH, 133);
  for (let row = 0; row < 7; row += 1) {
    const y = 421 + row * 15;
    line(ctx, [0, y, 226, y - 4, 252, y, 688, y, 712, y - 4, 960, y], rgba(palette.accentSoft, 0.13), 1);
  }
  ctx.fillStyle = rgba(palette.foreground, 0.82);
  ctx.fillRect(255, 466, 450, 74);
}

function drawForeground({ ctx, palette }: DrawContext): void {
  polygon(ctx, [0, 468, 132, 447, 222, 470, 266, 540, 0, 540], palette.foreground);
  polygon(ctx, [960, 447, 846, 462, 741, 446, 700, 540, 960, 540], palette.foreground);
  line(ctx, [0, 468, 132, 447, 222, 470], rgba(palette.accent, 0.36), 2);
  line(ctx, [960, 447, 846, 462, 741, 446], rgba(palette.accent, 0.36), 2);
}

function drawLightsAndEffects({ ctx, palette, frame, reducedMotion }: DrawContext): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 14; index += 1) {
    const x = 278 + index * 27;
    const baseY = 423 + (index % 3) * 5;
    const glow = reducedMotion ? 0.22 : 0.14 + (Math.sin(frame * 0.21 + index) + 1) * 0.09;
    ctx.globalAlpha = glow;
    ctx.fillStyle = index % 4 === 0 ? palette.accentSoft : palette.accent;
    ctx.fillRect(x, baseY, 3, 2);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawWindStrider(ctx: CanvasRenderingContext2D, x: number, y: number, palette: ScenePalette): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  polygon(ctx, [0, 0, 18, -4, 29, 0, 18, 4], palette.light);
  line(ctx, [7, 0, 12, -14, 17, 0], palette.accentSoft, 1);
  line(ctx, [12, -7, 23, -13], palette.accent, 1);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(5, -1, 4, 2);
  ctx.restore();
}

function drawGravSkimmer(ctx: CanvasRenderingContext2D, x: number, y: number, palette: ScenePalette): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  polygon(ctx, [0, 4, 11, -4, 34, -4, 45, 4, 31, 9, 11, 9], palette.foreground);
  line(ctx, [6, 5, 39, 5], palette.accentSoft, 2);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(15, 8, 5, 2);
  ctx.fillRect(30, 8, 5, 2);
  ctx.restore();
}

function drawBurdenWalker(ctx: CanvasRenderingContext2D, x: number, y: number, palette: ScenePalette): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  polygon(ctx, [0, -17, 25, -22, 44, -13, 40, 3, 11, 4], palette.foreground);
  line(ctx, [8, 3, 4, 17, 12, 17, 17, 4, 31, 4, 35, 17, 43, 17, 37, 1], palette.accentSoft, 3);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(17, -14, 9, 4);
  ctx.restore();
}

function drawMovingUnits({ ctx, palette, frame, mode, reducedMotion }: DrawContext, scene: SceneId): void {
  const motionFrame = sceneMotionFrame(frame, reducedMotion);
  if (scene === 'sunweaver-capital') {
    const offset = (motionFrame * 4) % 410;
    drawWindStrider(ctx, 250 + offset, 356, palette);
    drawWindStrider(ctx, 470 + ((offset + 180) % 410), 369, palette);
    if (mode === 'loading') drawWindStrider(ctx, 350 + ((offset + 90) % 280), 332, palette);
  } else {
    const offset = (motionFrame * 3) % 340;
    drawGravSkimmer(ctx, 260 + offset, 354, palette);
    drawGravSkimmer(ctx, 430 + ((offset + 160) % 340), 378, palette);
    drawBurdenWalker(ctx, 548 + sceneMotionOffset(motionFrame, 8, 1.1, reducedMotion), 389, palette);
  }
}

function drawScene(canvas: HTMLCanvasElement, scene: SceneId, mode: SceneMode, frame: number, reducedMotion: boolean): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  const palette = scene === 'sunweaver-capital' ? SUNWEAVER : GRAVEMARK;
  const draw: DrawContext = { ctx, palette, frame, mode, reducedMotion };
  drawSkyAndStars(draw);
  if (scene === 'sunweaver-capital') {
    drawSunweaverBody(draw);
    drawSunweaverFarTerrain(draw);
    drawSunweaverSettlement(draw);
    drawSunweaverGround(draw);
  } else {
    drawGravemarkBody(draw);
    drawGravemarkFarTerrain(draw);
    drawGravemarkSettlement(draw);
    drawGravemarkGround(draw);
  }
  drawForeground(draw);
  drawLightsAndEffects(draw);
  drawMovingUnits(draw, scene);
  ctx.restore();
}

function requestFrame(callback: FrameRequestCallback): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => callback(globalThis.performance?.now?.() ?? Date.now()), 1000 / 60) as unknown as number;
}

function cancelFrame(id: number): void {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id);
  } else {
    globalThis.clearTimeout(id);
  }
}

class SceneRenderer implements FrontEndSceneRenderer {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private faction: FactionId;
  private mode: SceneMode;
  private reducedMotion: boolean;
  private frame = 0;
  private paintedFrame = -1;
  private rafId: number | null = null;
  private destroyed = false;

  constructor(container: HTMLElement, options: FrontEndSceneOptions) {
    this.container = container;
    this.faction = options.faction ?? 'sunweaver';
    this.mode = options.mode ?? 'menu';
    this.reducedMotion = options.reducedMotion ?? false;
    this.root = document.createElement('div');
    this.root.className = 'front-end-scene';
    this.root.dataset.scene = sceneForFaction(this.faction);
    this.root.dataset.faction = this.faction;
    this.root.dataset.mode = this.mode;
    this.root.dataset.reducedMotion = String(this.reducedMotion);
    this.syncContainerDataset();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'front-end-scene__canvas';
    this.canvas.width = SCENE_WIDTH;
    this.canvas.height = SCENE_HEIGHT;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.root.append(this.canvas);
    container.append(this.root);
    this.paint(0);
    this.schedule();
  }

  get sceneId(): SceneId {
    return sceneForFaction(this.faction);
  }

  setFaction(faction: FactionId): void {
    if (this.destroyed || faction === this.faction) return;
    this.faction = faction;
    this.root.dataset.scene = sceneForFaction(faction);
    this.root.dataset.faction = faction;
    this.syncContainerDataset();
    this.paint(this.reducedMotion ? 0 : this.frame);
  }

  setMode(mode: SceneMode): void {
    if (this.destroyed || mode === this.mode) return;
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.paint(this.reducedMotion ? 0 : this.frame);
  }

  setReducedMotion(reduced: boolean): void {
    if (this.destroyed || reduced === this.reducedMotion) return;
    this.reducedMotion = reduced;
    this.root.dataset.reducedMotion = String(reduced);
    this.syncContainerDataset();
    this.paint(reduced ? 0 : this.frame);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.rafId !== null) cancelFrame(this.rafId);
    this.rafId = null;
    this.root.remove();
  }

  private paint(frame: number): void {
    const visualFrame = sceneMotionFrame(frame, this.reducedMotion);
    this.frame = Math.max(0, Math.floor(frame));
    this.paintedFrame = visualFrame;
    drawScene(this.canvas, this.sceneId, this.mode, visualFrame, this.reducedMotion);
  }

  private syncContainerDataset(): void {
    this.container.dataset.sceneId = sceneForFaction(this.faction);
    this.container.dataset.reducedMotion = String(this.reducedMotion);
  }

  private schedule(): void {
    this.rafId = requestFrame((timestamp) => {
      if (this.destroyed) return;
      const nextFrame = quantizeSceneTime(timestamp);
      const visualFrame = sceneMotionFrame(nextFrame, this.reducedMotion);
      if (visualFrame !== this.paintedFrame) this.paint(nextFrame);
      this.schedule();
    });
  }
}

/** Mount a procedural civilization scene into a menu or loading container. */
export function mountFrontEndScene(
  container: HTMLElement,
  options: FrontEndSceneOptions = {},
): FrontEndSceneController {
  return new SceneRenderer(container, options);
}

/** Alias for callers that prefer a factory name. */
export const createFrontEndScene = mountFrontEndScene;
export const createFrontEndSceneRenderer = mountFrontEndScene;
