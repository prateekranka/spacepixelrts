export type FrontEndThemeId =
  | 'violet-orbit'
  | 'solar-foundry'
  | 'cyan-rift'
  | 'crimson-citadel';

export interface FrontEndTheme {
  readonly id: FrontEndThemeId;
  readonly label: string;
  readonly accent: string;
  readonly accentRgb: string;
  readonly accentBright: string;
  readonly panel: string;
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly terrain: readonly [string, string, string];
  readonly loadingVerb: string;
  readonly loadingDetail: string;
  readonly tip: string;
  readonly progress: number;
}

export const FRONT_END_THEMES: readonly FrontEndTheme[] = [
  {
    id: 'violet-orbit',
    label: 'Violet Orbit',
    accent: '#9f72ff',
    accentRgb: '159,114,255',
    accentBright: '#d9c9ff',
    panel: '#0b0920',
    skyTop: '#030318',
    skyBottom: '#1c0b3b',
    terrain: ['#11102b', '#09091c', '#04050f'],
    loadingVerb: 'Synchronizing star map',
    loadingDetail: 'Helios beacon acquired',
    tip: 'Scout early and secure the Central Lumen Field before committing your army.',
    progress: 72,
  },
  {
    id: 'solar-foundry',
    label: 'Solar Foundry',
    accent: '#f4b642',
    accentRgb: '244,182,66',
    accentBright: '#ffe2a3',
    panel: '#171006',
    skyTop: '#090604',
    skyBottom: '#3a1705',
    terrain: ['#251409', '#130c08', '#060608'],
    loadingVerb: 'Calibrating strategic matrix',
    loadingDetail: 'Solar foundry uplink stable',
    tip: 'Keep two Workers on Ore until your permanent technology path is funded.',
    progress: 68,
  },
  {
    id: 'cyan-rift',
    label: 'Cyan Rift',
    accent: '#4be1e8',
    accentRgb: '75,225,232',
    accentBright: '#c8fbff',
    panel: '#03161b',
    skyTop: '#010a12',
    skyBottom: '#07313a',
    terrain: ['#09262d', '#06171e', '#02080e'],
    loadingVerb: 'Mapping the rift network',
    loadingDetail: 'Lumen route triangulated',
    tip: 'Owning the Lumen Field grants Charge and periodic global vision pulses.',
    progress: 81,
  },
  {
    id: 'crimson-citadel',
    label: 'Crimson Citadel',
    accent: '#ff5e57',
    accentRgb: '255,94,87',
    accentBright: '#ffc4b5',
    panel: '#190707',
    skyTop: '#100204',
    skyBottom: '#4a090a',
    terrain: ['#2a0a0b', '#170507', '#070305'],
    loadingVerb: 'Preparing the battlefield',
    loadingDetail: 'Citadel threat grid active',
    tip: 'Train one Fighter and your faction-unique unit before pushing beyond the Lumen lane.',
    progress: 64,
  },
] as const;

export function isFrontEndThemeId(value: string | null | undefined): value is FrontEndThemeId {
  return FRONT_END_THEMES.some((theme) => theme.id === value);
}

export function frontEndThemeById(id: FrontEndThemeId): FrontEndTheme {
  return FRONT_END_THEMES.find((theme) => theme.id === id) ?? FRONT_END_THEMES[0];
}

function randomThemeId(random: () => number): FrontEndThemeId {
  const raw = random();
  const bounded = Number.isFinite(raw) ? Math.max(0, Math.min(0.999999999, raw)) : 0;
  return FRONT_END_THEMES[Math.floor(bounded * FRONT_END_THEMES.length)].id;
}

export function resolveFrontEndThemeId(
  search: string,
  random: () => number = Math.random,
): FrontEndThemeId {
  const params = new URLSearchParams(search);
  const explicit = params.get('front-theme');
  if (isFrontEndThemeId(explicit)) return explicit;
  if (params.has('qa')) return 'violet-orbit';
  return randomThemeId(random);
}

interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seed: number): Rng {
  let state = seed || 0x9e3779b9;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: <T>(values: readonly T[]) => values[Math.min(values.length - 1, Math.floor(next() * values.length))],
  };
}

function rgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function drawStars(ctx: CanvasRenderingContext2D, rng: Rng, theme: FrontEndTheme): void {
  const colours = ['#ffffff', '#b9c7ff', theme.accentBright, theme.accent];
  for (let index = 0; index < 310; index++) {
    const x = rng.int(8, 952);
    const y = rng.int(6, 402);
    const size = rng.pick([1, 1, 1, 1, 2, 2, 3]);
    ctx.globalAlpha = rng.range(0.32, 0.94);
    ctx.fillStyle = rng.pick(colours);
    ctx.fillRect(x, y, size, size);
    if (size === 3 && rng.next() > 0.55) {
      ctx.fillRect(x - 5, y + 1, 13, 1);
      ctx.fillRect(x + 1, y - 5, 1, 13);
    }
  }
  ctx.globalAlpha = 1;
}

function drawNebula(ctx: CanvasRenderingContext2D, rng: Rng, theme: FrontEndTheme): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 46; index++) {
    const t = index / 45;
    const x = 470 + t * 520 + rng.range(-80, 80);
    const y = 70 + t * 260 + Math.sin(t * Math.PI * 2.3) * 68 + rng.range(-38, 38);
    const radius = rng.range(34, 112);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(theme.accent, rng.range(0.08, 0.2)));
    gradient.addColorStop(0.55, rgba(theme.accentBright, rng.range(0.025, 0.075)));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}

function drawPlanet(ctx: CanvasRenderingContext2D, rng: Rng, theme: FrontEndTheme): void {
  const solar = theme.id === 'solar-foundry';
  const rift = theme.id === 'cyan-rift';
  const x = solar ? 160 : theme.id === 'violet-orbit' ? 735 : 770;
  const y = solar ? 145 : theme.id === 'crimson-citadel' ? 124 : 156;
  const radius = solar ? 132 : rift ? 86 : 110;

  ctx.save();
  const halo = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius * 1.75);
  halo.addColorStop(0, rgba(theme.accent, solar ? 0.7 : 0.22));
  halo.addColorStop(0.44, rgba(theme.accent, solar ? 0.28 : 0.1));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius * 2, y - radius * 2, radius * 4, radius * 4);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  const body = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.42, 8, x, y, radius * 1.16);
  body.addColorStop(0, solar ? '#fff2a5' : theme.accentBright);
  body.addColorStop(0.22, solar ? '#ffb932' : rgba(theme.accent, 0.78));
  body.addColorStop(0.7, solar ? '#c14c09' : '#11142b');
  body.addColorStop(1, '#02040b');
  ctx.fillStyle = body;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  for (let band = 0; band < 22; band++) {
    const bandY = y - radius + rng.range(0, radius * 2);
    const bandH = rng.pick([1, 2, 3, 5]);
    ctx.globalAlpha = rng.range(0.05, 0.21);
    ctx.fillStyle = rng.next() > 0.5 ? theme.accentBright : '#050712';
    ctx.fillRect(x - radius, bandY, radius * 2, bandH);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(theme.accentBright, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.stroke();
}

function terrainLine(rng: Rng, horizon: number, amplitude: number): readonly number[] {
  const points: number[] = [0, horizon + rng.range(-amplitude, amplitude)];
  for (let x = 0; x <= 960; x += rng.int(32, 72)) {
    points.push(x, horizon + rng.range(-amplitude, amplitude));
  }
  points.push(960, 540, 0, 540);
  return points;
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: readonly number[], fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx: CanvasRenderingContext2D, rng: Rng, theme: FrontEndTheme): void {
  fillPolygon(ctx, terrainLine(rng, 330, 42), theme.terrain[0]);
  fillPolygon(ctx, terrainLine(rng, 375, 28), theme.terrain[1]);
  fillPolygon(ctx, terrainLine(rng, 440, 18), theme.terrain[2]);

  ctx.strokeStyle = rgba(theme.accent, 0.32);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 432);
  for (let x = 0; x <= 960; x += 32) ctx.lineTo(x, 432 + Math.sin(x * 0.017) * 8 + rng.range(-3, 3));
  ctx.stroke();

  if (theme.id === 'crimson-citadel') {
    ctx.strokeStyle = rgba('#ff9b4a', 0.7);
    ctx.lineWidth = 4;
    for (const startX of [150, 340, 610, 820]) {
      ctx.beginPath();
      ctx.moveTo(startX, 420);
      ctx.lineTo(startX + rng.range(-45, 45), 540);
      ctx.stroke();
    }
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  x: number,
  ground: number,
  width: number,
  height: number,
): void {
  const top = ground - height;
  ctx.fillStyle = rng.pick(['#07101e', '#0a1422', '#0d1827', '#101b2b']);
  ctx.fillRect(x, top, width, height);
  ctx.strokeStyle = rgba(theme.accentBright, 0.28);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, top + 0.5, width - 1, height - 1);

  const inset = rng.int(3, 7);
  for (let windowY = top + 8; windowY < ground - 5; windowY += rng.int(7, 11)) {
    for (let windowX = x + inset; windowX < x + width - inset; windowX += rng.int(7, 12)) {
      if (rng.next() < 0.58) {
        ctx.globalAlpha = rng.range(0.36, 0.96);
        ctx.fillStyle = rng.next() > 0.2 ? theme.accent : theme.accentBright;
        ctx.fillRect(windowX, windowY, rng.pick([1, 2]), rng.pick([2, 3]));
      }
    }
  }
  ctx.globalAlpha = 1;

  if (rng.next() > 0.58) {
    ctx.fillStyle = '#111d30';
    ctx.fillRect(x + width * 0.42, top - rng.int(8, 22), Math.max(2, width * 0.15), rng.int(8, 22));
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + width * 0.47, top - rng.int(15, 30), 1, rng.int(6, 13));
  }
}

function drawCity(ctx: CanvasRenderingContext2D, rng: Rng, theme: FrontEndTheme): void {
  const ground = 448;
  ctx.fillStyle = '#030711';
  ctx.fillRect(438, ground, 522, 92);

  let x = 430;
  while (x < 950) {
    const width = rng.int(16, 46);
    const centerBias = 1 - Math.min(1, Math.abs(x - 720) / 300);
    const height = rng.int(30, 72) + centerBias * rng.int(20, 118);
    drawBuilding(ctx, rng, theme, x, ground + rng.int(-2, 5), width, height);
    x += width + rng.int(4, 12);
  }

  ctx.fillStyle = '#081323';
  ctx.fillRect(665, 315, 24, 134);
  ctx.strokeStyle = rgba(theme.accentBright, 0.56);
  ctx.strokeRect(665.5, 315.5, 23, 133);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(675, 291, 3, 24);
  ctx.fillRect(676, 282, 1, 10);

  ctx.strokeStyle = rgba(theme.accentBright, 0.58);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(522, 404, 36, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#091527';
  ctx.fillRect(486, 403, 72, 45);

  ctx.save();
  ctx.translate(466, 385);
  ctx.rotate(-0.45);
  ctx.strokeStyle = theme.accentBright;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#18263d';
  ctx.fillRect(463, 385, 4, 63);

  ctx.strokeStyle = rgba(theme.accent, 0.22);
  ctx.lineWidth = 1;
  for (let row = 0; row < 7; row++) {
    ctx.beginPath();
    ctx.moveTo(400 - row * 18, 462 + row * 10);
    ctx.lineTo(960, 462 + row * 10);
    ctx.stroke();
  }
}

function drawCrystal(ctx: CanvasRenderingContext2D, theme: FrontEndTheme, x: number, y: number, scale: number): void {
  const crystal = (dx: number, height: number, width: number, alpha: number): void => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.accent;
    ctx.strokeStyle = theme.accentBright;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + dx, y - height);
    ctx.lineTo(x + dx + width * 0.5, y - height * 0.64);
    ctx.lineTo(x + dx + width * 0.5, y);
    ctx.lineTo(x + dx - width * 0.5, y);
    ctx.lineTo(x + dx - width * 0.5, y - height * 0.64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  crystal(0, 66 * scale, 20 * scale, 0.9);
  crystal(-20 * scale, 42 * scale, 14 * scale, 0.72);
  crystal(19 * scale, 35 * scale, 12 * scale, 0.65);
  ctx.globalAlpha = 1;
}

function drawShip(ctx: CanvasRenderingContext2D, theme: FrontEndTheme, x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#111d31';
  ctx.strokeStyle = '#91a4c8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-54, 0);
  ctx.lineTo(-20, -15);
  ctx.lineTo(40, -9);
  ctx.lineTo(62, 0);
  ctx.lineTo(40, 9);
  ctx.lineTo(-20, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1e3152';
  ctx.fillRect(-9, -6, 42, 12);
  ctx.fillStyle = theme.accentBright;
  ctx.fillRect(-72, -8, 20, 5);
  ctx.fillRect(-72, 3, 20, 5);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(520, 230, 80, 480, 270, 620);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.68, 'rgba(0,0,0,.12)');
  gradient.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 540);
}

export function renderFrontEndThemeArt(theme: FrontEndTheme): string {
  const low = document.createElement('canvas');
  low.width = 960;
  low.height = 540;
  const ctx = low.getContext('2d');
  if (!ctx) return '';
  const rng = makeRng(hashText(theme.id));

  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.62, theme.skyBottom);
  sky.addColorStop(1, '#02040a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  drawStars(ctx, rng, theme);
  drawNebula(ctx, rng, theme);
  drawPlanet(ctx, rng, theme);
  drawTerrain(ctx, rng, theme);
  drawCity(ctx, rng, theme);
  drawCrystal(ctx, theme, 86, 534, 1.2);
  drawCrystal(ctx, theme, 906, 532, 0.86);
  drawShip(ctx, theme, 798, 230, 0.58);
  drawShip(ctx, theme, 610, 138, 0.34);
  drawVignette(ctx);

  const full = document.createElement('canvas');
  full.width = 1920;
  full.height = 1080;
  const fullContext = full.getContext('2d');
  if (!fullContext) return '';
  fullContext.imageSmoothingEnabled = false;
  fullContext.drawImage(low, 0, 0, 1920, 1080);
  try {
    return full.toDataURL('image/webp', 0.88);
  } catch {
    return full.toDataURL('image/png');
  }
}

function applyTheme(theme: FrontEndTheme): void {
  const root = document.documentElement;
  root.dataset.frontTheme = theme.id;
  root.dataset.frontArtReady = 'false';
  root.style.setProperty('--front-accent', theme.accent);
  root.style.setProperty('--front-accent-rgb', theme.accentRgb);
  root.style.setProperty('--front-accent-bright', theme.accentBright);
  root.style.setProperty('--front-panel', theme.panel);
  root.style.setProperty('--front-art', 'linear-gradient(135deg,#02040b,#10162a)');
  const art = renderFrontEndThemeArt(theme);
  if (art) root.style.setProperty('--front-art', `url("${art}")`);
  root.dataset.frontArtReady = art ? 'true' : 'fallback';
}

function decorateStartScreen(node: Element): void {
  const screen = node.matches('#start-screen') ? node : node.querySelector('#start-screen');
  if (!(screen instanceof HTMLElement)) return;
  screen.classList.add('front-themed');
  screen.dataset.frontTheme = activeTheme.id;
}

let activeLoading: HTMLElement | null = null;
let activeLoadingToken = 0;
let allowLoadingRemoval = false;
let minimumVisibleUntil = 0;

function loadingMetaFrom(root: HTMLElement): string {
  const lines = Array.from(root.children).map((child) => child.textContent?.trim() ?? '').filter(Boolean);
  return lines.find((line) => line.includes(' · ')) ?? activeTheme.loadingDetail;
}

function decorateLoadingScreen(root: HTMLElement): void {
  if (root.dataset.frontLoading === 'true') return;
  const meta = loadingMetaFrom(root);
  root.dataset.frontLoading = 'true';
  root.dataset.frontTheme = activeTheme.id;
  root.id = 'front-loading-screen';
  root.className = 'front-loading-screen';
  root.removeAttribute('style');
  root.setAttribute('aria-label', `Loading Helios Rift — ${activeTheme.label}`);
  root.innerHTML = `
    <div class="front-loading-brand">
      <span class="front-loading-sigil" aria-hidden="true"><span>✦</span></span>
      <h1>STARHAVEN</h1>
    </div>
    <div class="front-loading-status">${activeTheme.loadingVerb}…</div>
    <div class="front-loading-progress" style="--front-progress:${activeTheme.progress}%">
      <span class="front-loading-track" aria-hidden="true"><i></i></span>
      <b>${activeTheme.progress}%</b>
    </div>
    <div class="front-loading-tip"><strong>TIP:</strong> ${activeTheme.tip}</div>
    <div class="front-loading-meta">HELIOS RIFT<br>${meta}</div>`;
  activeLoading = root;
  activeLoadingToken += 1;
  minimumVisibleUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 520 : 1150);
}

function maybeDecorateLoading(node: Element): void {
  const candidates: HTMLElement[] = [];
  if (node instanceof HTMLElement && node.getAttribute('role') === 'status') candidates.push(node);
  for (const status of node.querySelectorAll<HTMLElement>('[role="status"]')) candidates.push(status);
  for (const candidate of candidates) {
    if (candidate.textContent?.includes('Preparing skirmish')) decorateLoadingScreen(candidate);
  }
}

function preserveMinimumLoadingTime(removed: Node): void {
  if (!(removed instanceof HTMLElement) || removed !== activeLoading || allowLoadingRemoval) return;
  const remaining = minimumVisibleUntil - performance.now();
  if (remaining <= 0) {
    activeLoading = null;
    return;
  }
  const token = activeLoadingToken;
  const host = document.getElementById('app');
  if (!host) return;
  host.append(removed);
  window.setTimeout(() => {
    if (token !== activeLoadingToken || activeLoading !== removed) return;
    allowLoadingRemoval = true;
    removed.remove();
    activeLoading = null;
    window.setTimeout(() => { allowLoadingRemoval = false; }, 0);
  }, remaining);
}

function installFrontEndRuntime(): void {
  applyTheme(activeTheme);
  const decorateExisting = (): void => {
    const start = document.getElementById('start-screen');
    if (start) decorateStartScreen(start);
    for (const status of document.querySelectorAll<HTMLElement>('[role="status"]')) {
      if (status.textContent?.includes('Preparing skirmish')) decorateLoadingScreen(status);
    }
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (!(added instanceof Element)) continue;
        decorateStartScreen(added);
        maybeDecorateLoading(added);
      }
      for (const removed of record.removedNodes) preserveMinimumLoadingTime(removed);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorateExisting();
}

const runtimeSearch = typeof window === 'undefined' ? '' : window.location.search;
export const activeFrontEndThemeId = resolveFrontEndThemeId(runtimeSearch);
export const activeTheme = frontEndThemeById(activeFrontEndThemeId);

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') installFrontEndRuntime();
