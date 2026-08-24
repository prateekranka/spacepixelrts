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

/** Map the two canonical factions to their distinct authored scene packs. */
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

/** Return a looping source frame for a sprite sheet or animation strip. */
export function sceneStripFrame(
  visualFrame: number,
  frameRate: number,
  framesCount: number,
  reducedMotion = false,
): number {
  if (reducedMotion || !Number.isFinite(visualFrame) || !Number.isFinite(frameRate)) return 0;
  if (!Number.isFinite(framesCount) || framesCount <= 0 || frameRate <= 0) return 0;
  const count = Math.floor(framesCount);
  if (count <= 0) return 0;
  const frame = Math.max(0, Math.floor(visualFrame));
  return Math.floor((frame * frameRate) / SCENE_FPS) % count;
}

type BlendMode = 'source-over' | 'screen';
type AssetKind = 'cover' | 'rect';
type SceneRect = readonly [number, number, number, number];

export interface SceneAssetManifest {
  readonly file: string;
  readonly kind: AssetKind;
  readonly blend: BlendMode;
  readonly rect?: SceneRect;
}

export interface SceneSpritePlaceManifest {
  readonly frame: number;
  readonly box: SceneRect;
  readonly anchor?: SceneRect;
}

export interface SceneSpriteManifest {
  readonly file: string;
  readonly frames: readonly SceneRect[];
  readonly frameRate: number;
  readonly blend: BlendMode;
  readonly drift?: {
    readonly amplitude: number;
    readonly phase: number;
  };
  readonly places: readonly SceneSpritePlaceManifest[];
}

export interface SceneTwinklesManifest {
  readonly mask: string;
  readonly fps: number;
}

export interface ScenePackManifest {
  readonly scene: SceneId;
  readonly mode: SceneMode;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
  };
  readonly assets: readonly SceneAssetManifest[];
  readonly sprites: readonly SceneSpriteManifest[];
  readonly twinkles?: SceneTwinklesManifest;
  readonly fallbackPalette?: readonly string[];
}

const VALID_BLEND_MODES: readonly BlendMode[] = ['source-over', 'screen'];
const VALID_ASSET_KINDS: readonly AssetKind[] = ['cover', 'rect'];
const PACK_ROOT = 'front-end/civilizations';

const DEFAULT_FALLBACK_PALETTES: Readonly<Record<FactionId, readonly string[]>> = {
  sunweaver: ['#26151e', '#e1834e', '#f6c95f', '#0d1424', '#120f17'],
  gravemark: ['#0a111b', '#203548', '#81c8bb', '#0c141c', '#080e14'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRect(value: unknown): value is SceneRect {
  return Array.isArray(value)
    && value.length === 4
    && value.every((part) => isFiniteNumber(part));
}

function rectWithin(value: SceneRect, width: number, height: number): boolean {
  const [x, y, rectWidth, rectHeight] = value;
  return rectWidth > 0
    && rectHeight > 0
    && x >= 0
    && y >= 0
    && x + rectWidth <= width
    && y + rectHeight <= height;
}

function isBlendMode(value: unknown): value is BlendMode {
  return VALID_BLEND_MODES.includes(value as BlendMode);
}

function isAssetKind(value: unknown): value is AssetKind {
  return VALID_ASSET_KINDS.includes(value as AssetKind);
}

function isRelativeAssetFile(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.split('/').includes('..');
}

function pushRectError(errors: string[], label: string, value: unknown, width: number, height: number): void {
  if (!isRect(value)) {
    errors.push(`${label} must be [x,y,w,h]`);
    return;
  }
  if (!rectWithin(value, width, height)) {
    errors.push(`${label} ${JSON.stringify(value)} is outside ${width}x${height}`);
  }
}

/**
 * Validate the declarative portion of one scene pack.
 *
 * File existence is intentionally checked by the node-only asset test because
 * the browser loader receives a URL, not a filesystem path. The returned list
 * keeps every problem so callers can report a complete pack failure at once.
 */
export function validatePack(manifest: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(manifest)) return ['manifest must be an object'];

  if (manifest.scene !== 'sunweaver-capital' && manifest.scene !== 'gravemark-quarry') {
    errors.push(`manifest scene ${JSON.stringify(manifest.scene)} is invalid`);
  }
  if (manifest.mode !== 'menu' && manifest.mode !== 'loading') {
    errors.push(`manifest mode ${JSON.stringify(manifest.mode)} is invalid`);
  }

  const canvas = manifest.canvas;
  const canvasWidth = isRecord(canvas) && isFiniteNumber(canvas.width) ? canvas.width : SCENE_WIDTH;
  const canvasHeight = isRecord(canvas) && isFiniteNumber(canvas.height) ? canvas.height : SCENE_HEIGHT;
  if (!isRecord(canvas) || canvas.width !== SCENE_WIDTH || canvas.height !== SCENE_HEIGHT) {
    errors.push(`manifest canvas must be ${SCENE_WIDTH}x${SCENE_HEIGHT}`);
  }

  const assets = manifest.assets;
  if (!Array.isArray(assets)) {
    errors.push('manifest assets must be an array');
  } else {
    assets.forEach((asset, index) => {
      const label = `asset[${index}]`;
      if (!isRecord(asset)) {
        errors.push(`${label} must be an object`);
        return;
      }
      if (!isRelativeAssetFile(asset.file)) errors.push(`${label}.file is invalid`);
      if (!isAssetKind(asset.kind)) errors.push(`${label}.kind must be cover or rect`);
      if (!isBlendMode(asset.blend)) errors.push(`${label}.blend must be source-over or screen`);
      if (typeof asset.file === 'string' && !asset.file.toLowerCase().endsWith('.webp')) {
        errors.push(`${label}.file ${asset.file} must be scenic .webp`);
      }
      if (asset.kind === 'rect') pushRectError(errors, `${label}.rect`, asset.rect, canvasWidth, canvasHeight);
    });
  }

  const sprites = manifest.sprites;
  if (!Array.isArray(sprites)) {
    errors.push('manifest sprites must be an array');
  } else {
    sprites.forEach((sprite, index) => {
      const label = `sprite[${index}]`;
      if (!isRecord(sprite)) {
        errors.push(`${label} must be an object`);
        return;
      }
      if (!isRelativeAssetFile(sprite.file)) errors.push(`${label}.file is invalid`);
      if (typeof sprite.file === 'string' && !sprite.file.toLowerCase().endsWith('.png')) {
        errors.push(`${label}.file ${sprite.file} must be a sprite .png`);
      }
      if (!isBlendMode(sprite.blend)) errors.push(`${label}.blend must be source-over or screen`);
      if (!isFiniteNumber(sprite.frameRate) || sprite.frameRate <= 0) {
        errors.push(`${label}.frameRate must be positive`);
      }

      const frames = sprite.frames;
      if (!Array.isArray(frames) || frames.length === 0) {
        errors.push(`${label}.frames must be non-empty`);
      } else {
        frames.forEach((frame, frameIndex) => {
          if (!isRect(frame) || frame[2] <= 0 || frame[3] <= 0) {
            errors.push(`${label}.frames[${frameIndex}] must be [x,y,w,h] with positive size`);
          }
        });
      }

      const places = sprite.places;
      if (!Array.isArray(places) || places.length === 0) {
        errors.push(`${label}.places must be non-empty`);
      } else {
        places.forEach((place, placeIndex) => {
          const placeLabel = `${label}.places[${placeIndex}]`;
          if (!isRecord(place)) {
            errors.push(`${placeLabel} must be an object`);
            return;
          }
          const framesCount = Array.isArray(frames) ? frames.length : 0;
          const placeFrame = place.frame;
          if (!Number.isInteger(placeFrame) || (placeFrame as number) < -1 || (placeFrame as number) >= framesCount) {
            errors.push(`${placeLabel}.frame must be -1 or a frame index`);
          }
          if (!isRect(place.box) || place.box[2] <= 0 || place.box[3] <= 0) {
            errors.push(`${placeLabel}.box must be [x,y,w,h] with positive size`);
          }
          if (place.anchor !== undefined && (!isRect(place.anchor) || place.anchor[2] <= 0 || place.anchor[3] <= 0)) {
            errors.push(`${placeLabel}.anchor must be [x,y,w,h] with positive size`);
          }
        });
      }

      if (sprite.drift !== undefined) {
        if (!isRecord(sprite.drift) || !isFiniteNumber(sprite.drift.amplitude) || !isFiniteNumber(sprite.drift.phase)) {
          errors.push(`${label}.drift must contain finite amplitude and phase`);
        }
      }
    });
  }

  if (manifest.twinkles !== undefined) {
    if (!isRecord(manifest.twinkles)) {
      errors.push('twinkles must be an object');
    } else {
      if (!isRelativeAssetFile(manifest.twinkles.mask) || !manifest.twinkles.mask.toLowerCase().endsWith('.png')) {
        errors.push(`twinkles.mask ${String(manifest.twinkles.mask)} must be a .png file`);
      }
      if (!isFiniteNumber(manifest.twinkles.fps) || manifest.twinkles.fps <= 0) {
        errors.push('twinkles.fps must be positive');
      }
    }
  }

  if (manifest.fallbackPalette !== undefined) {
    if (!Array.isArray(manifest.fallbackPalette) || manifest.fallbackPalette.length < 5) {
      errors.push('fallbackPalette must contain at least five colors');
    } else if (manifest.fallbackPalette.some((color) => typeof color !== 'string' || color.length === 0)) {
      errors.push('fallbackPalette colors must be non-empty strings');
    }
  }

  return errors;
}

type DecodedImage = ImageBitmap | HTMLImageElement;

interface LoadedScenePack {
  readonly manifest: ScenePackManifest;
  readonly images: ReadonlyMap<string, DecodedImage>;
}

class ScenePackLoadError extends Error {
  readonly manifest: ScenePackManifest | null;

  constructor(message: string, manifest: ScenePackManifest | null = null) {
    super(message);
    this.name = 'ScenePackLoadError';
    this.manifest = manifest;
  }
}

const packCache = new Map<string, Promise<LoadedScenePack>>();

function packKey(faction: FactionId, mode: SceneMode): string {
  return `${faction}/${mode}`;
}

function packAssetPath(faction: FactionId, mode: SceneMode, file: string): string {
  return `${PACK_ROOT}/${faction}/${mode}/${file}`;
}

function manifestPath(faction: FactionId, mode: SceneMode): string {
  return `${PACK_ROOT}/${faction}/${mode}/manifest.json`;
}

function rootManifestPath(faction: FactionId): string {
  return `${PACK_ROOT}/${faction}/manifest.json`;
}

function manifestForMode(value: unknown, mode: SceneMode): unknown {
  if (isRecord(value) && isRecord(value[mode])) return value[mode];
  return value;
}

async function fetchManifest(faction: FactionId, mode: SceneMode): Promise<ScenePackManifest> {
  const candidates = [manifestPath(faction, mode), rootManifestPath(faction)];
  let lastError: unknown = new Error('manifest request failed');
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) {
        lastError = new Error(`${candidate} returned HTTP ${response.status}`);
        continue;
      }
      const manifest = manifestForMode(await response.json(), mode);
      const errors = validatePack(manifest);
      if (errors.length > 0) throw new ScenePackLoadError(`Invalid ${faction}/${mode} pack: ${errors.join('; ')}`);
      return manifest as ScenePackManifest;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof ScenePackLoadError) throw lastError;
  throw new ScenePackLoadError(`Could not load ${faction}/${mode} manifest: ${String(lastError)}`);
}

async function decodeHtmlImage(url: string): Promise<HTMLImageElement> {
  if (typeof Image === 'undefined') throw new Error(`Image decoding is unavailable for ${url}`);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve(image);
    };
    image.onload = () => {
      if (typeof image.decode !== 'function') {
        finish();
        return;
      }
      void image.decode().then(finish, finish);
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`Could not decode image ${url}`));
    };
    image.decoding = 'async';
    image.src = url;
  });
}

async function decodeImage(url: string): Promise<DecodedImage> {
  if (typeof globalThis.createImageBitmap === 'function') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return globalThis.createImageBitmap(await response.blob());
  }
  return decodeHtmlImage(url);
}

async function loadScenePack(faction: FactionId, mode: SceneMode): Promise<LoadedScenePack> {
  let manifest: ScenePackManifest | null = null;
  try {
    manifest = await fetchManifest(faction, mode);
    const files = new Set<string>();
    for (const asset of manifest.assets) files.add(asset.file);
    for (const sprite of manifest.sprites) files.add(sprite.file);
    if (manifest.twinkles) files.add(manifest.twinkles.mask);
    const decoded = await Promise.all(
      [...files].map(async (file): Promise<readonly [string, DecodedImage]> => {
        const image = await decodeImage(packAssetPath(faction, mode, file));
        return [file, image];
      }),
    );
    return { manifest, images: new Map(decoded) };
  } catch (error) {
    if (error instanceof ScenePackLoadError) {
      if (error.manifest === null && manifest !== null) {
        throw new ScenePackLoadError(error.message, manifest);
      }
      throw error;
    }
    throw new ScenePackLoadError(`Could not load ${faction}/${mode} art: ${String(error)}`, manifest);
  }
}

function getCachedPack(faction: FactionId, mode: SceneMode): Promise<LoadedScenePack> {
  const key = packKey(faction, mode);
  const cached = packCache.get(key);
  if (cached) return cached;
  const request = loadScenePack(faction, mode);
  packCache.set(key, request);
  return request;
}

function imageWidth(image: DecodedImage): number {
  const htmlImage = image as HTMLImageElement;
  return htmlImage.naturalWidth || image.width;
}

function imageHeight(image: DecodedImage): number {
  const htmlImage = image as HTMLImageElement;
  return htmlImage.naturalHeight || image.height;
}

function drawCover(ctx: CanvasRenderingContext2D, image: DecodedImage): void {
  const width = imageWidth(image);
  const height = imageHeight(image);
  if (width <= 0 || height <= 0) return;
  const scale = Math.max(SCENE_WIDTH / width, SCENE_HEIGHT / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  ctx.drawImage(image, (SCENE_WIDTH - drawWidth) / 2, (SCENE_HEIGHT - drawHeight) / 2, drawWidth, drawHeight);
}

function drawFitContain(
  ctx: CanvasRenderingContext2D,
  image: DecodedImage,
  source: SceneRect,
  box: SceneRect,
): void {
  const [sourceX, sourceY, sourceWidth, sourceHeight] = source;
  const [boxX, boxY, boxWidth, boxHeight] = box;
  if (sourceWidth <= 0 || sourceHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) return;
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = boxX + (boxWidth - drawWidth) / 2;
  const drawY = boxY + (boxHeight - drawHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
}

function sourceFrameRect(
  frame: SceneRect,
  frames: readonly SceneRect[],
  image: DecodedImage,
): SceneRect {
  const width = imageWidth(image);
  const height = imageHeight(image);
  const usesEndpoints = frames.some(([x, y, frameWidth, frameHeight]) => (
    x + frameWidth > width || y + frameHeight > height
  ));
  if (!usesEndpoints) return frame;
  const [x, y, right, bottom] = frame;
  return [x, y, Math.max(1, right - x), Math.max(1, bottom - y)];
}

function drawImageWithBlend(
  ctx: CanvasRenderingContext2D,
  blend: BlendMode,
  draw: () => void,
): void {
  ctx.globalCompositeOperation = blend;
  draw();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function paletteFor(faction: FactionId, manifest: ScenePackManifest | null): readonly string[] {
  const palette = manifest?.fallbackPalette;
  return palette && palette.length >= 5 ? palette : DEFAULT_FALLBACK_PALETTES[faction];
}

function drawFallback(
  canvas: HTMLCanvasElement,
  faction: FactionId,
  manifest: ScenePackManifest | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
  const palette = paletteFor(faction, manifest);
  const gradient = ctx.createLinearGradient(0, 0, 0, SCENE_HEIGHT);
  gradient.addColorStop(0, palette[0]);
  gradient.addColorStop(0.56, palette[1]);
  gradient.addColorStop(1, palette[4]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);
}

function drawPack(
  canvas: HTMLCanvasElement,
  pack: LoadedScenePack,
  visualFrame: number,
  reducedMotion: boolean,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  for (const asset of pack.manifest.assets) {
    const image = pack.images.get(asset.file);
    if (!image) throw new Error(`Missing decoded asset ${asset.file}`);
    drawImageWithBlend(ctx, asset.blend, () => {
      if (asset.kind === 'cover') drawCover(ctx, image);
      else if (asset.rect) drawFitContain(ctx, image, [0, 0, imageWidth(image), imageHeight(image)], asset.rect);
    });
  }

  for (const sprite of pack.manifest.sprites) {
    const image = pack.images.get(sprite.file);
    if (!image) throw new Error(`Missing decoded sprite ${sprite.file}`);
    for (const place of sprite.places) {
      const frameIndex = place.frame >= 0
        ? Math.min(place.frame, sprite.frames.length - 1)
        : sceneStripFrame(visualFrame, sprite.frameRate, sprite.frames.length, reducedMotion);
      const source = sourceFrameRect(
        sprite.frames[frameIndex] ?? sprite.frames[0],
        sprite.frames,
        image,
      );
      const [x, y, width, height] = place.box;
      const drift = sprite.drift
        ? sceneMotionOffset(visualFrame, sprite.drift.amplitude, sprite.drift.phase, reducedMotion)
        : 0;
      drawImageWithBlend(ctx, sprite.blend, () => {
        drawFitContain(ctx, image, source, [x, y + drift, width, height]);
      });
    }
  }

  const twinkles = pack.manifest.twinkles;
  if (twinkles) {
    const image = pack.images.get(twinkles.mask);
    if (!image) throw new Error(`Missing decoded twinkle mask ${twinkles.mask}`);
    const pulseFrame = quantizeSceneTime(visualFrame * SCENE_STEP_MS, twinkles.fps);
    const pulse = reducedMotion ? 0.9 : 0.35 + ((Math.sin(pulseFrame * 0.8) + 1) / 2) * 0.55;
    ctx.globalAlpha = pulse;
    drawImageWithBlend(ctx, 'screen', () => drawCover(ctx, image));
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
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
  private activePackKey: string;
  private activePack: LoadedScenePack | null = null;
  private fallbackManifest: ScenePackManifest | null = null;
  private loadGeneration = 0;

  constructor(container: HTMLElement, options: FrontEndSceneOptions) {
    this.container = container;
    this.faction = options.faction ?? 'sunweaver';
    this.mode = options.mode ?? 'menu';
    this.reducedMotion = options.reducedMotion ?? false;
    this.activePackKey = packKey(this.faction, this.mode);
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
    const ctx = this.canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;
    this.root.append(this.canvas);
    container.append(this.root);
    this.markFallback('loading');
    this.paint(0);
    this.loadActivePack();
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
    this.selectPack();
  }

  setMode(mode: SceneMode): void {
    if (this.destroyed || mode === this.mode) return;
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.selectPack();
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
    this.loadGeneration += 1;
    if (this.rafId !== null) cancelFrame(this.rafId);
    this.rafId = null;
    this.root.remove();
  }

  private selectPack(): void {
    this.activePackKey = packKey(this.faction, this.mode);
    this.activePack = null;
    this.fallbackManifest = null;
    this.markFallback('loading');
    this.paint(this.reducedMotion ? 0 : this.frame);
    this.loadActivePack();
  }

  private loadActivePack(): void {
    const key = this.activePackKey;
    const generation = ++this.loadGeneration;
    void getCachedPack(this.faction, this.mode).then(
      (pack) => {
        if (this.destroyed || generation !== this.loadGeneration || key !== this.activePackKey) return;
        this.activePack = pack;
        this.fallbackManifest = null;
        this.paint(this.reducedMotion ? 0 : this.frame);
      },
      (error: unknown) => {
        if (this.destroyed || generation !== this.loadGeneration || key !== this.activePackKey) return;
        this.activePack = null;
        this.fallbackManifest = error instanceof ScenePackLoadError ? error.manifest : null;
        const message = error instanceof Error ? error.message : String(error);
        this.markFallback(message);
        this.paint(this.reducedMotion ? 0 : this.frame);
      },
    );
  }

  private paint(frame: number): void {
    const visualFrame = sceneMotionFrame(frame, this.reducedMotion);
    this.frame = Math.max(0, Math.floor(frame));
    this.paintedFrame = visualFrame;
    if (this.activePack === null) {
      drawFallback(this.canvas, this.faction, this.fallbackManifest);
      return;
    }
    try {
      drawPack(this.canvas, this.activePack, visualFrame, this.reducedMotion);
      this.root.dataset.artReady = 'true';
      delete this.root.dataset.artError;
    } catch (error) {
      const failedPack = this.activePack;
      this.activePack = null;
      this.fallbackManifest = failedPack.manifest;
      const message = error instanceof Error ? error.message : String(error);
      this.markFallback(message);
      drawFallback(this.canvas, this.faction, this.fallbackManifest);
    }
  }

  private markFallback(error: string): void {
    this.root.dataset.artReady = 'false';
    this.root.dataset.artError = error;
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

/** Mount an authored civilization scene into a menu or loading container. */
export function mountFrontEndScene(
  container: HTMLElement,
  options: FrontEndSceneOptions = {},
): FrontEndSceneController {
  return new SceneRenderer(container, options);
}

/** Alias for callers that prefer a factory name. */
export const createFrontEndScene = mountFrontEndScene;
export const createFrontEndSceneRenderer = mountFrontEndScene;
