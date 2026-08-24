export type PresentationThemeId = 'nebula' | 'solar' | 'rift' | 'ember';

export interface PresentationTheme {
  readonly id: PresentationThemeId;
  readonly label: string;
  readonly accent: string;
  readonly accentRgb: string;
  readonly secondary: string;
  readonly menuArt: string;
  readonly loadingArt: string;
  readonly loadingVerb: string;
  readonly tip: string;
}

export interface PresentationThemeSelection {
  readonly requested?: string | null;
  readonly deterministicKey?: string | null;
  readonly previousId?: PresentationThemeId | null;
  readonly randomUint32?: number;
}

const asset = (id: PresentationThemeId, screen: 'menu' | 'loading'): string =>
  `/ui/presentation/${id}-${screen}.webp`;

export const PRESENTATION_THEMES: readonly PresentationTheme[] = Object.freeze([
  {
    id: 'nebula',
    label: 'Nebula Frontier',
    accent: '#a96cff',
    accentRgb: '169,108,255',
    secondary: '#6d86ff',
    menuArt: asset('nebula', 'menu'),
    loadingArt: asset('nebula', 'loading'),
    loadingVerb: 'Synchronizing star map',
    tip: 'Scout early and secure the Central Lumen Field.',
  },
  {
    id: 'solar',
    label: 'Solar Expanse',
    accent: '#ffb33f',
    accentRgb: '255,179,63',
    secondary: '#ff672c',
    menuArt: asset('solar', 'menu'),
    loadingArt: asset('solar', 'loading'),
    loadingVerb: 'Calibrating solar relays',
    tip: 'Two Ore workers fund the fastest reliable opening.',
  },
  {
    id: 'rift',
    label: 'Rift Network',
    accent: '#4de5e1',
    accentRgb: '77,229,225',
    secondary: '#3f8fd6',
    menuArt: asset('rift', 'menu'),
    loadingArt: asset('rift', 'loading'),
    loadingVerb: 'Mapping the rift network',
    tip: 'Lumen control grants Charge and periodic vision pulses.',
  },
  {
    id: 'ember',
    label: 'Ember Reach',
    accent: '#ff5362',
    accentRgb: '255,83,98',
    secondary: '#c12b48',
    menuArt: asset('ember', 'menu'),
    loadingArt: asset('ember', 'loading'),
    loadingVerb: 'Analyzing enemy approach',
    tip: 'Rebuild missing combat roles before the next push.',
  },
]);

export const DEFAULT_PRESENTATION_THEME = PRESENTATION_THEMES[0];

export function presentationThemeById(value: string | null | undefined): PresentationTheme | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return PRESENTATION_THEMES.find((theme) => theme.id === normalized) ?? null;
}

function hashKey(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function secureRandomUint32(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] >>> 0;
  }
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

export function selectPresentationTheme(
  selection: PresentationThemeSelection = {},
): PresentationTheme {
  const requested = presentationThemeById(selection.requested);
  if (requested) return requested;

  const source = selection.deterministicKey
    ? hashKey(selection.deterministicKey)
    : (selection.randomUint32 ?? secureRandomUint32()) >>> 0;
  let index = source % PRESENTATION_THEMES.length;

  if (
    selection.previousId
    && PRESENTATION_THEMES.length > 1
    && PRESENTATION_THEMES[index].id === selection.previousId
  ) {
    index = (index + 1) % PRESENTATION_THEMES.length;
  }
  return PRESENTATION_THEMES[index];
}

export function bindPresentationTheme(
  element: HTMLElement,
  theme: PresentationTheme,
  screen: 'menu' | 'loading',
): void {
  element.dataset.presentationTheme = theme.id;
  element.style.setProperty('--presentation-art', `url("${screen === 'menu' ? theme.menuArt : theme.loadingArt}")`);
  element.style.setProperty('--presentation-accent', theme.accent);
  element.style.setProperty('--presentation-accent-rgb', theme.accentRgb);
  element.style.setProperty('--presentation-secondary', theme.secondary);
}
