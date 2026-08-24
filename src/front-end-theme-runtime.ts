export type FrontEndThemeId =
  | 'violet-orbit'
  | 'solar-foundry'
  | 'cyan-rift'
  | 'crimson-citadel';

type FrontEndSceneMode = 'menu' | 'loading';

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
    panel: '#090820',
    skyTop: '#020319',
    skyBottom: '#160b39',
    terrain: ['#11102c', '#09091b', '#03040d'],
    loadingVerb: 'Deploying to Helios Rift',
    loadingDetail: 'Beacon network calibrating',
    tip: 'Scout early and secure the Central Lumen Field before committing your army.',
    progress: 78,
  },
  {
    id: 'solar-foundry',
    label: 'Solar Foundry',
    accent: '#f4b642',
    accentRgb: '244,182,66',
    accentBright: '#ffe4a6',
    panel: '#170f05',
    skyTop: '#080504',
    skyBottom: '#351505',
    terrain: ['#251409', '#130c08', '#050507'],
    loadingVerb: 'Charging the solar foundry',
    loadingDetail: 'Ascendancy relays online',
    tip: 'Keep two Workers on Ore until your permanent technology path is funded.',
    progress: 74,
  },
  {
    id: 'cyan-rift',
    label: 'Cyan Rift',
    accent: '#4be1e8',
    accentRgb: '75,225,232',
    accentBright: '#c9fbff',
    panel: '#031419',
    skyTop: '#010912',
    skyBottom: '#06313a',
    terrain: ['#09272e', '#05181e', '#02080d'],
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
    accentBright: '#ffc3b4',
    panel: '#180606',
    skyTop: '#0d0204',
    skyBottom: '#43090b',
    terrain: ['#2a0a0c', '#160507', '#060205'],
    loadingVerb: 'Fortifying the citadel',
    loadingDetail: 'Threat grid synchronized',
    tip: 'Train one Fighter and your faction-unique unit before pushing beyond the Lumen lane.',
    progress: 69,
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

function fillPolygon(ctx: CanvasRenderingContext2D, points: readonly number[], fill: string): void {
  if (points.length < 6) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.closePath();
  ctx.fill();
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  tick: number,
): void {
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(0.58, theme.skyBottom);
  sky.addColorStop(1, '#02040a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 42; index++) {
    const t = index / 41;
    const x = 495 + t * 500 + rng.range(-72, 72);
    const y = 42 + t * 245 + Math.sin(t * 7.2) * 56 + rng.range(-22, 22);
    const radius = rng.range(26, 88);
    const nebula = ctx.createRadialGradient(x, y, 0, x, y, radius);
    nebula.addColorStop(0, rgba(theme.accent, rng.range(0.07, 0.17)));
    nebula.addColorStop(0.5, rgba(theme.accentBright, rng.range(0.02, 0.055)));
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  const colours = ['#ffffff', '#b8c8ff', theme.accentBright, theme.accent];
  for (let index = 0; index < 300; index++) {
    const x = rng.int(5, 955);
    const y = rng.int(4, 388);
    const large = index % 37 === 0;
    const base = large ? 3 : rng.pick([1, 1, 1, 1, 2]);
    const pulse = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(tick * 0.13 + index * 1.71));
    ctx.globalAlpha = large ? pulse : rng.range(0.28, 0.88);
    ctx.fillStyle = rng.pick(colours);
    ctx.fillRect(x, y, base, base);
    if (large && pulse > 0.68) {
      ctx.fillRect(x - 5, y + 1, 13, 1);
      ctx.fillRect(x + 1, y - 5, 1, 13);
    }
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  mode: FrontEndSceneMode,
): void {
  const solar = theme.id === 'solar-foundry';
  const x = mode === 'menu' ? 260 : -18;
  const y = mode === 'menu' ? 248 : 184;
  const radius = mode === 'menu' ? 195 : 220;

  const halo = ctx.createRadialGradient(x, y, radius * 0.64, x, y, radius * 1.25);
  halo.addColorStop(0, rgba(theme.accentBright, solar ? 0.56 : 0.24));
  halo.addColorStop(0.54, rgba(theme.accent, solar ? 0.24 : 0.13));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - radius * 1.35, y - radius * 1.35, radius * 2.7, radius * 2.7);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  const body = ctx.createRadialGradient(
    x - radius * 0.36,
    y - radius * 0.45,
    8,
    x,
    y,
    radius * 1.14,
  );
  body.addColorStop(0, solar ? '#fff1a2' : theme.accentBright);
  body.addColorStop(0.2, solar ? '#ffb52f' : rgba(theme.accent, 0.86));
  body.addColorStop(0.58, solar ? '#a94709' : '#182050');
  body.addColorStop(1, '#02040b');
  ctx.fillStyle = body;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  for (let band = 0; band < 34; band++) {
    const bandY = y - radius + rng.range(0, radius * 2);
    const bandH = rng.pick([1, 1, 2, 3, 5]);
    ctx.globalAlpha = rng.range(0.035, 0.17);
    ctx.fillStyle = rng.next() > 0.48 ? theme.accentBright : '#02040d';
    ctx.fillRect(x - radius, bandY, radius * 2, bandH);
  }
  for (let patch = 0; patch < 48; patch++) {
    ctx.globalAlpha = rng.range(0.04, 0.16);
    ctx.fillStyle = rng.next() > 0.45 ? theme.accent : '#030615';
    ctx.fillRect(
      x - radius + rng.range(0, radius * 1.9),
      y - radius + rng.range(0, radius * 1.9),
      rng.int(8, 38),
      rng.int(2, 8),
    );
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(theme.accentBright, 0.82);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();
}

function terrainLine(rng: Rng, horizon: number, amplitude: number): readonly number[] {
  const points: number[] = [0, horizon + rng.range(-amplitude, amplitude)];
  for (let x = 0; x <= 960; x += rng.int(28, 62)) {
    points.push(x, horizon + rng.range(-amplitude, amplitude));
  }
  points.push(960, 540, 0, 540);
  return points;
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  tick: number,
): void {
  fillPolygon(ctx, terrainLine(rng, 342, 40), theme.terrain[0]);
  fillPolygon(ctx, terrainLine(rng, 396, 28), theme.terrain[1]);
  fillPolygon(ctx, terrainLine(rng, 464, 17), theme.terrain[2]);

  ctx.strokeStyle = rgba(theme.accent, 0.18);
  ctx.lineWidth = 1;
  for (let row = 0; row < 8; row++) {
    const y = 432 + row * 13;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 960; x += 20) {
      ctx.lineTo(x, y + Math.sin((x + tick * 3 + row * 19) * 0.028) * 3);
    }
    ctx.stroke();
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
  tick: number,
  index: number,
): void {
  const top = ground - height;
  ctx.fillStyle = rng.pick(['#050b16', '#07101e', '#0a1422', '#0d1726']);
  ctx.fillRect(x, top, width, height);
  ctx.strokeStyle = rgba(theme.accentBright, 0.2);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, top + 0.5, width - 1, height - 1);

  const inset = rng.int(3, 6);
  let lightIndex = 0;
  for (let windowY = top + 7; windowY < ground - 4; windowY += rng.int(7, 10)) {
    for (let windowX = x + inset; windowX < x + width - inset; windowX += rng.int(7, 11)) {
      const on = ((index * 13 + lightIndex * 7 + Math.floor(tick / 5)) % 11) > 3;
      if (on && rng.next() > 0.28) {
        ctx.globalAlpha = 0.45 + ((lightIndex + index) % 4) * 0.14;
        ctx.fillStyle = (lightIndex + index) % 5 === 0 ? '#ffb35a' : theme.accentBright;
        ctx.fillRect(windowX, windowY, rng.pick([1, 1, 2]), rng.pick([1, 2, 3]));
      }
      lightIndex += 1;
    }
  }
  ctx.globalAlpha = 1;

  if (index % 3 === 0) {
    const antennaHeight = 10 + (index % 5) * 3;
    ctx.fillStyle = '#132039';
    ctx.fillRect(x + Math.floor(width * 0.47), top - antennaHeight, 2, antennaHeight);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x + Math.floor(width * 0.47), top - antennaHeight - 2, 2, 2);
  }
}

function drawDome(
  ctx: CanvasRenderingContext2D,
  theme: FrontEndTheme,
  x: number,
  ground: number,
  radius: number,
  tick: number,
): void {
  ctx.fillStyle = '#07101d';
  ctx.beginPath();
  ctx.arc(x, ground, radius, Math.PI, 0);
  ctx.lineTo(x + radius, ground + 13);
  ctx.lineTo(x - radius, ground + 13);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(theme.accentBright, 0.48);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, ground, radius, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = rgba(theme.accent, 0.22 + 0.12 * Math.sin(tick * 0.11));
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, ground - radius);
  ctx.lineTo(x, ground + 12);
  ctx.moveTo(x - radius * 0.7, ground - radius * 0.7);
  ctx.lineTo(x + radius * 0.7, ground - radius * 0.7);
  ctx.stroke();
}

function drawDish(
  ctx: CanvasRenderingContext2D,
  theme: FrontEndTheme,
  x: number,
  ground: number,
  tick: number,
): void {
  ctx.save();
  ctx.translate(x, ground - 50);
  ctx.rotate(-0.5 + Math.sin(tick * 0.018) * 0.035);
  ctx.strokeStyle = theme.accentBright;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 31, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = rgba(theme.accent, 0.64);
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#172741';
  ctx.fillRect(x - 2, ground - 50, 4, 50);
  ctx.fillStyle = theme.accentBright;
  ctx.fillRect(x - 1, ground - 54, 2, 2);
}

function drawWaterReflections(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  tick: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 92; index++) {
    const x = rng.int(75, 900);
    const y = rng.int(432, 530);
    const width = rng.int(2, 24);
    const phase = (index * 7 + Math.floor(tick / 2)) % 18;
    ctx.globalAlpha = 0.06 + (phase / 18) * 0.25;
    ctx.fillStyle = index % 9 === 0 ? '#ffb35a' : theme.accentBright;
    ctx.fillRect(x, y, width, rng.pick([1, 1, 2]));
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMenuColony(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  tick: number,
): void {
  const ground = 424;
  ctx.fillStyle = '#02060f';
  ctx.fillRect(170, ground, 620, 116);

  let x = 185;
  let buildingIndex = 0;
  while (x < 785) {
    const width = rng.int(17, 40);
    const centerBias = 1 - Math.min(1, Math.abs(x - 520) / 360);
    const height = rng.int(24, 61) + centerBias * rng.int(10, 76);
    drawBuilding(ctx, rng, theme, x, ground + rng.int(-2, 4), width, height, tick, buildingIndex);
    buildingIndex += 1;
    x += width + rng.int(3, 9);
  }

  drawDome(ctx, theme, 398, ground - 3, 30, tick);
  drawDome(ctx, theme, 659, ground - 1, 27, tick + 9);
  drawDish(ctx, theme, 257, ground, tick);

  ctx.fillStyle = '#071120';
  ctx.fillRect(516, 286, 38, 139);
  ctx.strokeStyle = rgba(theme.accentBright, 0.48);
  ctx.strokeRect(516.5, 286.5, 37, 138);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(533, 263, 3, 23);
  ctx.fillRect(534, 251, 1, 13);
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tick * 0.13);
  ctx.fillStyle = theme.accentBright;
  ctx.fillRect(533, 248, 3, 3);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#071120';
  ctx.fillRect(605, 315, 24, 109);
  ctx.strokeStyle = rgba(theme.accentBright, 0.35);
  ctx.strokeRect(605.5, 315.5, 23, 108);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(616, 294, 2, 21);

  drawWaterReflections(ctx, rng, theme, tick);
}

function drawLoadingColony(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  theme: FrontEndTheme,
  tick: number,
): void {
  const ground = 430;
  ctx.fillStyle = '#02060f';
  ctx.fillRect(175, ground, 690, 110);

  let x = 185;
  let buildingIndex = 0;
  while (x < 855) {
    const width = rng.int(15, 38);
    const centerBias = 1 - Math.min(1, Math.abs(x - 530) / 360);
    const height = rng.int(24, 58) + centerBias * rng.int(12, 64);
    drawBuilding(ctx, rng, theme, x, ground + rng.int(-2, 4), width, height, tick, buildingIndex);
    buildingIndex += 1;
    x += width + rng.int(4, 9);
  }

  drawDome(ctx, theme, 520, ground - 13, 74, tick);
  ctx.fillStyle = '#091528';
  ctx.fillRect(448, ground - 15, 144, 28);
  ctx.strokeStyle = rgba(theme.accentBright, 0.38);
  ctx.strokeRect(448.5, ground - 14.5, 143, 27);
  drawDish(ctx, theme, 335, ground, tick + 7);
  drawDome(ctx, theme, 728, ground - 2, 32, tick + 11);

  ctx.fillStyle = '#071120';
  ctx.fillRect(790, 306, 29, 125);
  ctx.strokeStyle = rgba(theme.accentBright, 0.38);
  ctx.strokeRect(790.5, 306.5, 28, 124);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(803, 282, 2, 24);
  ctx.globalAlpha = 0.68 + 0.32 * Math.sin(tick * 0.12);
  ctx.fillStyle = theme.accentBright;
  ctx.fillRect(802, 278, 4, 4);
  ctx.globalAlpha = 1;

  drawWaterReflections(ctx, rng, theme, tick);
}

function drawCrystal(
  ctx: CanvasRenderingContext2D,
  theme: FrontEndTheme,
  x: number,
  y: number,
  scale: number,
  tick: number,
): void {
  const pulse = 0.72 + 0.28 * Math.sin(tick * 0.09 + x * 0.01);
  const crystal = (dx: number, height: number, width: number, alpha: number): void => {
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = theme.accent;
    ctx.strokeStyle = theme.accentBright;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + dx, y - height);
    ctx.lineTo(x + dx + width * 0.5, y - height * 0.63);
    ctx.lineTo(x + dx + width * 0.5, y);
    ctx.lineTo(x + dx - width * 0.5, y);
    ctx.lineTo(x + dx - width * 0.5, y - height * 0.63);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  crystal(0, 68 * scale, 22 * scale, 0.92);
  crystal(-21 * scale, 43 * scale, 14 * scale, 0.72);
  crystal(20 * scale, 36 * scale, 12 * scale, 0.64);
  ctx.globalAlpha = 1;
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  theme: FrontEndTheme,
  x: number,
  y: number,
  scale: number,
  tick: number,
  descending = false,
): void {
  const driftX = Math.sin(tick * 0.026 + x * 0.01) * 4;
  const driftY = Math.cos(tick * 0.021 + y * 0.015) * 2;
  ctx.save();
  ctx.translate(x + driftX, y + driftY);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#101c31';
  ctx.strokeStyle = '#91a6cc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-54, 0);
  ctx.lineTo(-22, -15);
  ctx.lineTo(40, -9);
  ctx.lineTo(63, 0);
  ctx.lineTo(40, 9);
  ctx.lineTo(-22, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#20365b';
  ctx.fillRect(-8, -6, 43, 12);
  ctx.fillStyle = theme.accentBright;
  if (descending) {
    const beam = 34 + 12 * (0.5 + 0.5 * Math.sin(tick * 0.16 + x));
    ctx.fillRect(-28, 15, 5, beam);
    ctx.fillRect(17, 15, 5, beam);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-31, 16, 11, beam + 10);
    ctx.fillRect(14, 16, 11, beam + 10);
  } else {
    ctx.fillRect(-75, -8, 22, 5);
    ctx.fillRect(-75, 3, 22, 5);
    ctx.globalAlpha = 0.28;
    ctx.fillRect(-105, -7, 32, 3);
    ctx.fillRect(-105, 4, 32, 3);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMenuShips(ctx: CanvasRenderingContext2D, theme: FrontEndTheme, tick: number): void {
  drawShip(ctx, theme, 726, 154, 0.5, tick);
  drawShip(ctx, theme, 398, 249, 0.24, tick + 13);
  drawShip(ctx, theme, 165, 284, 0.22, tick + 31);
}

function drawLoadingShips(ctx: CanvasRenderingContext2D, theme: FrontEndTheme, tick: number): void {
  drawShip(ctx, theme, 245, 225, 0.72, tick, true);
  drawShip(ctx, theme, 704, 170, 0.42, tick + 17, false);
  drawShip(ctx, theme, 500, 224, 0.28, tick + 29, true);
  drawShip(ctx, theme, 630, 246, 0.23, tick + 41, true);
  drawShip(ctx, theme, 375, 188, 0.2, tick + 53, true);
}

function drawVignette(ctx: CanvasRenderingContext2D, mode: FrontEndSceneMode): void {
  const x = mode === 'menu' ? 470 : 500;
  const gradient = ctx.createRadialGradient(x, 242, 90, 480, 270, 650);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.7, 'rgba(0,0,0,.08)');
  gradient.addColorStop(1, 'rgba(0,0,0,.7)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 540);
}

function drawScene(
  canvas: HTMLCanvasElement,
  theme: FrontEndTheme,
  mode: FrontEndSceneMode,
  tick: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rng = makeRng(hashText(`${theme.id}:${mode}`));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky(ctx, rng, theme, tick);
  drawPlanet(ctx, rng, theme, mode);
  drawTerrain(ctx, rng, theme, tick);
  if (mode === 'menu') {
    drawMenuColony(ctx, rng, theme, tick);
    drawMenuShips(ctx, theme, tick);
  } else {
    drawLoadingColony(ctx, rng, theme, tick);
    drawLoadingShips(ctx, theme, tick);
  }
  drawCrystal(ctx, theme, 64, 536, mode === 'menu' ? 1.2 : 0.85, tick);
  drawCrystal(ctx, theme, 902, 534, mode === 'menu' ? 0.9 : 1.05, tick + 11);
  drawVignette(ctx, mode);
}

export function renderFrontEndThemeArt(
  theme: FrontEndTheme,
  mode: FrontEndSceneMode = 'menu',
): string {
  if (typeof document === 'undefined') return '';
  const low = document.createElement('canvas');
  low.width = 960;
  low.height = 540;
  drawScene(low, theme, mode, 0);
  const full = document.createElement('canvas');
  full.width = 1920;
  full.height = 1080;
  const fullContext = full.getContext('2d');
  if (!fullContext) return '';
  fullContext.imageSmoothingEnabled = false;
  fullContext.drawImage(low, 0, 0, 1920, 1080);
  try {
    return full.toDataURL('image/webp', 0.9);
  } catch {
    return full.toDataURL('image/png');
  }
}

const sceneStops = new WeakMap<HTMLCanvasElement, () => void>();
const loadingTimers = new WeakMap<HTMLElement, number>();

function stopScene(canvas: HTMLCanvasElement): void {
  sceneStops.get(canvas)?.();
  sceneStops.delete(canvas);
}

function startScene(canvas: HTMLCanvasElement, mode: FrontEndSceneMode): void {
  stopScene(canvas);
  canvas.width = 960;
  canvas.height = 540;
  canvas.dataset.frontScene = mode;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let animationFrame = 0;
  let stopped = false;
  let lastPaint = -Infinity;
  let tick = 0;
  const paint = (time: number): void => {
    if (stopped) return;
    if (time - lastPaint >= 78 || lastPaint < 0) {
      drawScene(canvas, activeTheme, mode, tick);
      lastPaint = time;
      tick += 1;
    }
    if (!reduced) animationFrame = requestAnimationFrame(paint);
  };
  paint(performance.now());
  sceneStops.set(canvas, () => {
    stopped = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
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
  const art = renderFrontEndThemeArt(theme, 'menu');
  if (art) root.style.setProperty('--front-art', `url("${art}")`);
  root.dataset.frontArtReady = art ? 'true' : 'fallback';
}

function createMenuButton(label: string, action: string, className = ''): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `front-pixel-button ${className}`.trim();
  button.dataset.startAction = action;
  button.innerHTML = `<span aria-hidden="true"></span><strong>${label}</strong>`;
  return button;
}

function installMenuChrome(screen: HTMLElement): void {
  const menuView = screen.querySelector<HTMLElement>('.menu-view');
  if (!menuView || menuView.querySelector('.front-pixel-menu')) return;

  const menu = document.createElement('nav');
  menu.className = 'front-pixel-menu';
  menu.setAttribute('aria-label', 'Main menu');
  menu.append(
    createMenuButton('New Skirmish', 'new-skirmish', 'is-primary'),
    createMenuButton('Tutorial', 'tutorial'),
    createMenuButton('Factions', 'factions'),
    createMenuButton('Settings', 'settings'),
  );

  const start = createMenuButton('Start', 'new-skirmish', 'front-start-button is-primary');
  start.setAttribute('aria-label', 'Start new skirmish');

  const utility = document.createElement('div');
  utility.className = 'front-pixel-utility';
  utility.setAttribute('aria-hidden', 'true');
  utility.innerHTML = '<span>♜</span><span>▥</span><span>⚒</span><span>✉<b>1</b></span>';

  const build = document.createElement('div');
  build.className = 'front-pixel-build';
  build.textContent = 'STARHAVEN // BUILD 0.12';

  menuView.prepend(menu);
  menuView.append(start, utility, build);
  menuView.querySelector<HTMLElement>('.menu-list')?.setAttribute('aria-hidden', 'true');
}

function decorateStartScreen(node: Element): void {
  const screen = node.matches('#start-screen') ? node : node.querySelector('#start-screen');
  if (!(screen instanceof HTMLElement)) return;
  screen.classList.add('front-themed');
  screen.dataset.frontTheme = activeTheme.id;
  if (!screen.querySelector('.front-scene-canvas')) {
    const canvas = document.createElement('canvas');
    canvas.className = 'front-scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    screen.prepend(canvas);
    startScene(canvas, 'menu');
  }
  installMenuChrome(screen);
}

let activeLoading: HTMLElement | null = null;
let activeLoadingToken = 0;
let allowLoadingRemoval = false;
let minimumVisibleUntil = 0;

function loadingMetaFrom(root: HTMLElement): string {
  const lines = Array.from(root.children).map((child) => child.textContent?.trim() ?? '').filter(Boolean);
  return lines.find((line) => line.includes(' · ')) ?? activeTheme.loadingDetail;
}

function animateLoadingProgress(root: HTMLElement, target: number): void {
  const value = root.querySelector<HTMLElement>('.front-loading-progress b');
  const track = root.querySelector<HTMLElement>('.front-loading-track');
  if (!value || !track) return;
  const previous = loadingTimers.get(root);
  if (previous !== undefined) clearInterval(previous);
  let current = 12;
  const paint = (): void => {
    track.style.setProperty('--front-progress', `${current}%`);
    value.textContent = `${current}%`;
  };
  paint();
  const timer = window.setInterval(() => {
    const remaining = target - current;
    if (remaining <= 0) {
      clearInterval(timer);
      loadingTimers.delete(root);
      return;
    }
    current += Math.max(1, Math.ceil(remaining / 7));
    if (current > target) current = target;
    paint();
  }, 92);
  loadingTimers.set(root, timer);
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
    <canvas class="front-scene-canvas" aria-hidden="true"></canvas>
    <div class="front-loading-brand"><span aria-hidden="true">✦</span><h1>STARHAVEN</h1></div>
    <div class="front-loading-status">${activeTheme.loadingVerb}…</div>
    <div class="front-loading-progress">
      <span class="front-loading-track" aria-hidden="true"><i></i></span>
      <b>12%</b>
    </div>
    <div class="front-loading-detail">${activeTheme.loadingDetail}…</div>
    <div class="front-loading-tip"><strong>TIP:</strong><span>${activeTheme.tip}</span><i aria-hidden="true">✦</i></div>
    <div class="front-loading-meta">HELIOS RIFT<br>${meta}</div>`;
  const canvas = root.querySelector<HTMLCanvasElement>('.front-scene-canvas');
  if (canvas) startScene(canvas, 'loading');
  animateLoadingProgress(root, activeTheme.progress);
  activeLoading = root;
  activeLoadingToken += 1;
  minimumVisibleUntil = performance.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 720 : 1650);
}

function maybeDecorateLoading(node: Element): void {
  const candidates: HTMLElement[] = [];
  if (node instanceof HTMLElement && node.getAttribute('role') === 'status') candidates.push(node);
  for (const status of node.querySelectorAll<HTMLElement>('[role="status"]')) candidates.push(status);
  for (const candidate of candidates) {
    if (candidate.textContent?.includes('Preparing skirmish')) decorateLoadingScreen(candidate);
  }
}

function stopDecorationsWithin(node: Node): void {
  if (!(node instanceof Element)) return;
  if (node instanceof HTMLCanvasElement && node.classList.contains('front-scene-canvas')) stopScene(node);
  for (const canvas of node.querySelectorAll<HTMLCanvasElement>('.front-scene-canvas')) stopScene(canvas);
  if (node instanceof HTMLElement) {
    const timer = loadingTimers.get(node);
    if (timer !== undefined) {
      clearInterval(timer);
      loadingTimers.delete(node);
    }
  }
}

function preserveMinimumLoadingTime(removed: Node): void {
  if (!(removed instanceof HTMLElement) || removed !== activeLoading || allowLoadingRemoval) {
    stopDecorationsWithin(removed);
    return;
  }
  const remaining = minimumVisibleUntil - performance.now();
  if (remaining <= 0) {
    activeLoading = null;
    stopDecorationsWithin(removed);
    return;
  }
  const token = activeLoadingToken;
  const host = document.getElementById('app');
  if (!host) return;
  host.append(removed);
  window.setTimeout(() => {
    if (token !== activeLoadingToken || activeLoading !== removed) return;
    allowLoadingRemoval = true;
    stopDecorationsWithin(removed);
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
