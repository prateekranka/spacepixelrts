/**
 * FTR-REVIEW-ADAPTER — frame-reference deep link builder/parser for the Forge
 * Review Deck integration boundary (docs/FORGE_TRACE.md §11).
 *
 * Frozen link format:
 *   <reviewBaseUrl>?qa=<scenario>&qa-seed=<seed>&qa-run=1&orientation=landscape-left&forge-tick=<tick>
 *
 * `scenario` must be a route id from src/qa-scenarios.ts QA_SCENARIOS (default
 * `opening`); `seed` is a decimal unsigned 32-bit integer; `forge-tick` is a
 * non-negative integer. Unknown params are ignored by the game page, so the
 * format is forward-compatible; this module validates its own inputs strictly
 * on build and tolerantly on parse.
 */

import { QA_SCENARIOS } from './qa-scenarios';

export type ReviewOrientation = 'landscape-left' | 'landscape-right';

const DEFAULT_SCENARIO = 'opening';
const DEFAULT_ORIENTATION: ReviewOrientation = 'landscape-left';
const MAX_UINT32 = 4294967295;

const QA_ROUTE_IDS: ReadonlySet<string> = new Set(QA_SCENARIOS.map((scenario) => scenario.id));

function assertReviewSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_UINT32) {
    throw new TypeError(`qa-seed must be an unsigned 32-bit integer in [0, ${MAX_UINT32}], got ${seed}`);
  }
}

function assertForgeTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new TypeError(`forge-tick must be a non-negative integer, got ${tick}`);
  }
}

function assertScenarioId(scenario: string): void {
  if (!QA_ROUTE_IDS.has(scenario)) {
    throw new TypeError(`unknown QA scenario id "${scenario}"`);
  }
}

function assertReviewBaseUrl(reviewBaseUrl: string): void {
  if (typeof reviewBaseUrl !== 'string' || reviewBaseUrl.trim().length === 0) {
    throw new TypeError('reviewBaseUrl must be a non-empty string');
  }
}

function assertOrientation(orientation: ReviewOrientation): void {
  if (orientation !== 'landscape-left' && orientation !== 'landscape-right') {
    throw new TypeError(
      `orientation must be "landscape-left" or "landscape-right", got ${String(orientation)}`,
    );
  }
}

function encodeFrameParams(
  scenario: string,
  seed: number,
  orientation: ReviewOrientation,
  tick: number,
): string {
  return [
    `qa=${encodeURIComponent(scenario)}`,
    `qa-seed=${encodeURIComponent(String(seed))}`,
    'qa-run=1',
    `orientation=${encodeURIComponent(orientation)}`,
    `forge-tick=${encodeURIComponent(String(tick))}`,
  ].join('&');
}

export interface BuildReviewUrlOptions {
  reviewBaseUrl: string;
  seed: number;
  tick: number;
  orientation?: ReviewOrientation;
  scenario?: string;
}

export interface ParsedReviewUrl {
  scenario: string | null;
  seed: number | null;
  tick: number | null;
  orientation: ReviewOrientation;
  qaRun: boolean;
}

/**
 * Build a Forge Review Deck deep link. Params are appended in the frozen order
 * qa < qa-seed < qa-run < orientation < forge-tick, values are
 * encodeURIComponent'd, and any existing query in `reviewBaseUrl` is preserved
 * (appended with `&`). Invalid inputs throw TypeError.
 */
export function buildReviewUrl(options: BuildReviewUrlOptions): string {
  const { reviewBaseUrl, seed, tick } = options;
  assertReviewBaseUrl(reviewBaseUrl);
  assertReviewSeed(seed);
  assertForgeTick(tick);
  const scenario = options.scenario ?? DEFAULT_SCENARIO;
  assertScenarioId(scenario);
  const orientation = options.orientation ?? DEFAULT_ORIENTATION;
  assertOrientation(orientation);
  const separator = reviewBaseUrl.includes('?') ? '&' : '?';
  return `${reviewBaseUrl}${separator}${encodeFrameParams(scenario, seed, orientation, tick)}`;
}

const DECIMAL_INTEGER = /^[0-9]+$/;

function parseUnsignedInt(value: string | null, max: number): number | null {
  if (value === null || !DECIMAL_INTEGER.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

/**
 * Parse a Forge Review Deck deep link. Returns null for anything that is not a
 * URL. Extra unknown params are ignored; out-of-range or malformed known
 * values are treated as absent (never thrown). Orientation defaults to
 * `landscape-left` when missing or invalid.
 */
export function parseReviewUrl(url: string): ParsedReviewUrl | null {
  if (typeof url !== 'string') return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const scenarioValue = parsed.searchParams.get('qa');
  const scenario = scenarioValue !== null && QA_ROUTE_IDS.has(scenarioValue) ? scenarioValue : null;
  const seed = parseUnsignedInt(parsed.searchParams.get('qa-seed'), MAX_UINT32);
  const tick = parseUnsignedInt(parsed.searchParams.get('forge-tick'), Number.MAX_SAFE_INTEGER);
  const orientationValue = parsed.searchParams.get('orientation');
  const orientation: ReviewOrientation =
    orientationValue === 'landscape-right' ? 'landscape-right' : DEFAULT_ORIENTATION;
  const qaRun = parsed.searchParams.get('qa-run') === '1';
  return { scenario, seed, tick, orientation, qaRun };
}

/**
 * Build just the query-string portion of the frame-reference deep link
 * (no base URL), as used by Copy frame reference. Same validation as
 * buildReviewUrl; `opening` is the default scenario mapping.
 */
export function buildFrameRefParams(seed: number, tick: number): string {
  assertReviewSeed(seed);
  assertForgeTick(tick);
  return `?${encodeFrameParams(DEFAULT_SCENARIO, seed, DEFAULT_ORIENTATION, tick)}`;
}
