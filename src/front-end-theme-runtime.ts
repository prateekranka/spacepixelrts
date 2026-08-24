export type FrontEndThemeId =
  | 'violet-orbit'
  | 'solar-foundry'
  | 'cyan-rift'
  | 'crimson-citadel';

export interface FrontEndTheme {
  readonly id: FrontEndThemeId;
  readonly label: string;
  readonly art: string;
  readonly accent: string;
  readonly accentRgb: string;
  readonly accentBright: string;
  readonly panel: string;
  readonly loadingVerb: string;
  readonly loadingDetail: string;
  readonly tip: string;
  readonly progress: number;
}

export const FRONT_END_THEMES: readonly FrontEndTheme[] = [
  {
    id: 'violet-orbit',
    label: 'Violet Orbit',
    art: '/front-end-themes/violet-orbit.svg',
    accent: '#9f72ff',
    accentRgb: '159,114,255',
    accentBright: '#d9c9ff',
    panel: '#0b0920',
    loadingVerb: 'Synchronizing star map',
    loadingDetail: 'Helios beacon acquired',
    tip: 'Scout early and secure the Central Lumen Field before committing your army.',
    progress: 72,
  },
  {
    id: 'solar-foundry',
    label: 'Solar Foundry',
    art: '/front-end-themes/solar-foundry.svg',
    accent: '#f4b642',
    accentRgb: '244,182,66',
    accentBright: '#ffe2a3',
    panel: '#171006',
    loadingVerb: 'Calibrating strategic matrix',
    loadingDetail: 'Solar foundry uplink stable',
    tip: 'Keep two Workers on Ore until your permanent technology path is funded.',
    progress: 68,
  },
  {
    id: 'cyan-rift',
    label: 'Cyan Rift',
    art: '/front-end-themes/cyan-rift.svg',
    accent: '#4be1e8',
    accentRgb: '75,225,232',
    accentBright: '#c8fbff',
    panel: '#03161b',
    loadingVerb: 'Mapping the rift network',
    loadingDetail: 'Lumen route triangulated',
    tip: 'Owning the Lumen Field grants Charge and periodic global vision pulses.',
    progress: 81,
  },
  {
    id: 'crimson-citadel',
    label: 'Crimson Citadel',
    art: '/front-end-themes/crimson-citadel.svg',
    accent: '#ff5e57',
    accentRgb: '255,94,87',
    accentBright: '#ffc4b5',
    panel: '#190707',
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

function applyTheme(theme: FrontEndTheme): void {
  const root = document.documentElement;
  root.dataset.frontTheme = theme.id;
  root.style.setProperty('--front-accent', theme.accent);
  root.style.setProperty('--front-accent-rgb', theme.accentRgb);
  root.style.setProperty('--front-accent-bright', theme.accentBright);
  root.style.setProperty('--front-panel', theme.panel);
  root.style.setProperty('--front-art', `url("${theme.art}")`);
}

function preloadArt(theme: FrontEndTheme): void {
  const image = new Image();
  image.decoding = 'async';
  image.src = theme.art;
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
  preloadArt(activeTheme);

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
