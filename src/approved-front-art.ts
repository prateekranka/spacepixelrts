type ApprovedArtMode = 'menu' | 'loading';

type ApprovedAssets = Readonly<{
  menu: string;
  loading: string;
}>;

interface PixelPoint {
  readonly x: number;
  readonly y: number;
  readonly phase: number;
  readonly size: number;
}

const CHUNK_ROOT = '/front-end-art';
const APPROVED_WIDTH = 960;
const APPROVED_HEIGHT = 540;
const effectStops = new WeakMap<HTMLCanvasElement, () => void>();
let approvedAssets: ApprovedAssets | null = null;

document.documentElement.dataset.approvedFrontArtReady = 'false';

function frontTheme(): string {
  return document.documentElement.dataset.frontTheme ?? 'violet-orbit';
}

function accentForTheme(): string {
  switch (frontTheme()) {
    case 'solar-foundry': return '#ffc45d';
    case 'cyan-rift': return '#57efff';
    case 'crimson-citadel': return '#ff6c62';
    default: return '#a77aff';
  }
}

async function decodeChunkedWebp(name: ApprovedArtMode): Promise<string> {
  const chunks = await Promise.all([0, 1, 2].map(async (part) => {
    const response = await fetch(`${CHUNK_ROOT}/${name}-${part}.b64`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Approved ${name} art chunk ${part} returned ${response.status}`);
    return (await response.text()).trim();
  }));
  const binary = atob(chunks.join(''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  const probe = new Image();
  probe.src = url;
  await probe.decode();
  if (probe.naturalWidth !== APPROVED_WIDTH || probe.naturalHeight !== APPROVED_HEIGHT) {
    URL.revokeObjectURL(url);
    throw new Error(
      `Approved ${name} art is ${probe.naturalWidth}×${probe.naturalHeight}; expected ${APPROVED_WIDTH}×${APPROVED_HEIGHT}`,
    );
  }
  return url;
}

const approvedAssetsPromise: Promise<ApprovedAssets> = Promise.all([
  decodeChunkedWebp('menu'),
  decodeChunkedWebp('loading'),
]).then(([menu, loading]) => {
  approvedAssets = { menu, loading };
  document.documentElement.dataset.approvedFrontArtReady = 'true';
  return approvedAssets;
}).catch((error: unknown) => {
  document.documentElement.dataset.approvedFrontArtReady = 'failed';
  console.warn('Starhaven approved front art unavailable; retaining procedural fallback.', error);
  throw error;
});

function makePixelPoints(mode: ApprovedArtMode): readonly PixelPoint[] {
  let state = mode === 'menu' ? 0x61f2a53d : 0x2cb48d91;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  const count = mode === 'menu' ? 54 : 62;
  return Array.from({ length: count }, () => ({
    x: Math.floor(next() * APPROVED_WIDTH),
    y: Math.floor(next() * (mode === 'menu' ? 360 : 330)),
    phase: next() * Math.PI * 2,
    size: next() > 0.86 ? 3 : next() > 0.6 ? 2 : 1,
  }));
}

function drawPixelGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  colour: string,
  strength: number,
): void {
  context.globalAlpha = strength * 0.22;
  context.fillStyle = colour;
  context.fillRect(x - 6, y - 1, 13, 3);
  context.fillRect(x - 1, y - 6, 3, 13);
  context.globalAlpha = strength;
  context.fillRect(x - 2, y - 2, 5, 5);
  context.globalAlpha = 1;
}

function drawMenuEffects(
  context: CanvasRenderingContext2D,
  tick: number,
  accent: string,
): void {
  const shipPulse = 0.58 + 0.42 * Math.sin(tick * 0.55);
  context.globalAlpha = shipPulse;
  context.fillStyle = '#62d9ff';
  context.fillRect(661, 151, 15, 2);
  context.fillRect(654, 152, 8, 1);
  context.globalAlpha = 0.22 * shipPulse;
  context.fillRect(640, 151, 22, 4);
  context.globalAlpha = 1;

  drawPixelGlow(context, 481, 27, '#e9f5ff', 0.72 + 0.28 * Math.sin(tick * 0.38));
  drawPixelGlow(context, 473, 331, accent, 0.46 + 0.3 * Math.sin(tick * 0.21));

  for (let index = 0; index < 34; index++) {
    const x = 210 + ((index * 47) % 490);
    const y = 405 + ((index * 17) % 112);
    const on = (index * 5 + tick) % 13 > 5;
    if (!on) continue;
    context.globalAlpha = 0.13 + ((index + tick) % 5) * 0.06;
    context.fillStyle = index % 8 === 0 ? '#ffb066' : '#79dfff';
    context.fillRect(x, y, 2 + (index % 4) * 2, 1);
  }
  context.globalAlpha = 1;
}

function drawLoadingEffects(
  context: CanvasRenderingContext2D,
  tick: number,
  accent: string,
): void {
  const beamPulse = 0.64 + 0.36 * Math.sin(tick * 0.46);
  context.fillStyle = '#5bcaff';
  context.globalAlpha = beamPulse * 0.7;
  for (const [x, y, width, height] of [
    [119, 236, 6, 42], [159, 238, 5, 39], [326, 202, 3, 31], [381, 211, 3, 35], [525, 217, 3, 31],
  ] as const) {
    context.fillRect(x, y, width, height + Math.floor(5 * Math.sin(tick * 0.36 + x)));
    context.globalAlpha = beamPulse * 0.16;
    context.fillRect(x - 3, y, width + 6, height + 12);
    context.globalAlpha = beamPulse * 0.7;
  }
  context.globalAlpha = 1;
  drawPixelGlow(context, 480, 25, '#eff8ff', 0.72 + 0.28 * Math.sin(tick * 0.41));
  drawPixelGlow(context, 488, 303, accent, 0.5 + 0.34 * Math.sin(tick * 0.24));

  for (let index = 0; index < 28; index++) {
    const x = 235 + ((index * 59) % 510);
    const y = 347 + ((index * 19) % 80);
    if ((index + tick) % 7 < 3) continue;
    context.globalAlpha = 0.12 + ((index * 3 + tick) % 4) * 0.07;
    context.fillStyle = index % 7 === 0 ? '#ffc277' : '#70ddff';
    context.fillRect(x, y, 2 + (index % 3) * 2, 1);
  }
  context.globalAlpha = 1;
}

function stopEffects(canvas: HTMLCanvasElement): void {
  effectStops.get(canvas)?.();
  effectStops.delete(canvas);
}

function startEffects(canvas: HTMLCanvasElement, mode: ApprovedArtMode): void {
  stopEffects(canvas);
  canvas.width = APPROVED_WIDTH;
  canvas.height = APPROVED_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;
  const points = makePixelPoints(mode);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stopped = false;
  let frame = 0;
  let animationFrame = 0;
  let previousStep = -1;

  const paint = (time: number): void => {
    if (stopped) return;
    const step = reducedMotion ? 0 : Math.floor(time / 83);
    if (step !== previousStep) {
      previousStep = step;
      frame = step;
      context.clearRect(0, 0, APPROVED_WIDTH, APPROVED_HEIGHT);
      context.globalCompositeOperation = 'screen';
      const accent = accentForTheme();
      for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(frame * 0.22 + point.phase));
        if (pulse < 0.52) continue;
        context.globalAlpha = pulse * 0.8;
        context.fillStyle = index % 5 === 0 ? accent : '#d8ebff';
        context.fillRect(point.x, point.y, point.size, point.size);
        if (point.size === 3 && pulse > 0.8) {
          context.fillRect(point.x - 4, point.y + 1, 11, 1);
          context.fillRect(point.x + 1, point.y - 4, 1, 11);
        }
      }
      context.globalAlpha = 1;
      if (mode === 'menu') drawMenuEffects(context, frame, accent);
      else drawLoadingEffects(context, frame, accent);
      context.globalCompositeOperation = 'source-over';
    }
    if (!reducedMotion) animationFrame = requestAnimationFrame(paint);
  };
  paint(performance.now());
  effectStops.set(canvas, () => {
    stopped = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
}

function approvedImage(url: string, mode: ApprovedArtMode): HTMLImageElement {
  const image = new Image();
  image.className = `front-approved-art front-approved-${mode}-art`;
  image.alt = '';
  image.decoding = 'sync';
  image.draggable = false;
  image.src = url;
  image.dataset.approvedMode = mode;
  return image;
}

function mountApprovedArt(root: HTMLElement, mode: ApprovedArtMode, url: string): void {
  if (root.querySelector(`.front-approved-${mode}-art`)) return;
  for (const fallback of root.querySelectorAll<HTMLCanvasElement>('.front-scene-canvas')) fallback.remove();

  const image = approvedImage(url, mode);
  const tint = document.createElement('div');
  tint.className = 'front-approved-tint';
  tint.setAttribute('aria-hidden', 'true');
  const effects = document.createElement('canvas');
  effects.className = 'front-approved-effects';
  effects.setAttribute('aria-hidden', 'true');
  effects.dataset.approvedMode = mode;
  root.prepend(image, tint, effects);
  root.classList.add('front-approved-art-ready');
  root.dataset.approvedAsset = mode;
  startEffects(effects, mode);
}

function scanForScreens(): void {
  if (!approvedAssets) return;
  const menu = document.getElementById('start-screen');
  if (menu instanceof HTMLElement) mountApprovedArt(menu, 'menu', approvedAssets.menu);
  const loading = document.getElementById('front-loading-screen');
  if (loading instanceof HTMLElement) mountApprovedArt(loading, 'loading', approvedAssets.loading);
}

function stopRemovedEffects(node: Node): void {
  if (!(node instanceof Element)) return;
  if (node instanceof HTMLCanvasElement && node.classList.contains('front-approved-effects')) stopEffects(node);
  for (const canvas of node.querySelectorAll<HTMLCanvasElement>('.front-approved-effects')) stopEffects(canvas);
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const removed of record.removedNodes) stopRemovedEffects(removed);
  }
  scanForScreens();
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['id', 'class', 'data-front-loading'],
});

void approvedAssetsPromise.then(scanForScreens).catch(() => {});
scanForScreens();
