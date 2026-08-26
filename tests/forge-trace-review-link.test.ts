import assert from 'node:assert/strict';
import { QA_SCENARIOS } from '../src/qa-scenarios';
import {
  buildFrameRefParams,
  buildReviewUrl,
  parseReviewUrl,
} from '../src/forge-frames';

const DECK = 'https://deck.forge.example/review';

// --- 1. Round-trip every component through build -> parse -------------------

for (const scenario of QA_SCENARIOS) {
  const seed = 424242 + scenario.id.length;
  const url = buildReviewUrl({ reviewBaseUrl: DECK, seed, tick: 9600, scenario: scenario.id });
  const parsed = parseReviewUrl(url);
  assert.ok(parsed, `parse round-trip for scenario ${scenario.id}`);
  assert.equal(parsed.scenario, scenario.id, `scenario round-trips (${scenario.id})`);
  assert.equal(parsed.seed, seed, `seed round-trips (${scenario.id})`);
  assert.equal(parsed.tick, 9600, `tick round-trips (${scenario.id})`);
  assert.equal(parsed.orientation, 'landscape-left', `default orientation round-trips (${scenario.id})`);
  assert.equal(parsed.qaRun, true, `qa-run round-trips (${scenario.id})`);
}

const rightUrl = buildReviewUrl({
  reviewBaseUrl: DECK,
  seed: 7,
  tick: 3,
  orientation: 'landscape-right',
});
const rightParsed = parseReviewUrl(rightUrl);
assert.ok(rightParsed, 'parse landscape-right URL');
assert.equal(rightParsed.orientation, 'landscape-right', 'orientation override round-trips');
assert.equal(rightParsed.scenario, 'opening', 'default scenario mapping is opening');
assert.equal(rightParsed.seed, 7, 'seed round-trips with orientation override');
assert.equal(rightParsed.tick, 3, 'tick round-trips with orientation override');

const defaultUrl = buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: 1 });
assert.ok(defaultUrl.includes('qa=opening'), 'default scenario is opening');

// --- 2. Scenario validation against real QA_SCENARIOS ids -------------------

const KNOWN_ROUTE_IDS = QA_SCENARIOS.map((scenario) => scenario.id);
assert.ok(KNOWN_ROUTE_IDS.includes('opening'), 'QA_SCENARIOS still contains the default route');
for (const id of KNOWN_ROUTE_IDS) {
  assert.doesNotThrow(
    () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: 1, scenario: id }),
    `known scenario id "${id}" builds`,
  );
}
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: 1, scenario: 'not-a-route' }),
  TypeError,
  'unknown scenario id throws TypeError',
);

// --- 3. Seed boundary cases -------------------------------------------------

assert.equal(
  parseReviewUrl(buildReviewUrl({ reviewBaseUrl: DECK, seed: 0, tick: 0 }))?.seed,
  0,
  'seed 0 builds and round-trips',
);
assert.equal(
  parseReviewUrl(buildReviewUrl({ reviewBaseUrl: DECK, seed: 4294967295, tick: 0 }))?.seed,
  4294967295,
  'seed 4294967295 builds and round-trips',
);
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 4294967296, tick: 0 }),
  TypeError,
  'seed 4294967296 rejected',
);
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: -1, tick: 0 }),
  TypeError,
  'seed -1 rejected',
);
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 1.5, tick: 0 }),
  TypeError,
  'fractional seed rejected',
);
assert.throws(() => buildFrameRefParams(4294967296, 0), TypeError, 'frame-ref params reject seed overflow');
assert.throws(() => buildFrameRefParams(-1, 0), TypeError, 'frame-ref params reject negative seed');

// --- 4. Tick boundary cases -------------------------------------------------

assert.equal(
  parseReviewUrl(buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: 0 }))?.tick,
  0,
  'tick 0 builds and round-trips',
);
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: -1 }),
  TypeError,
  'negative tick rejected',
);
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: DECK, seed: 1, tick: 1.5 }),
  TypeError,
  'fractional tick rejected',
);
assert.throws(() => buildFrameRefParams(1, -1), TypeError, 'frame-ref params reject negative tick');
assert.throws(() => buildFrameRefParams(1, 1.5), TypeError, 'frame-ref params reject fractional tick');

// --- 5. Base-with-query append behavior -------------------------------------

const baseWithQuery = 'https://deck.forge.example/review?view=close';
const appended = buildReviewUrl({ reviewBaseUrl: baseWithQuery, seed: 9, tick: 4 });
assert.ok(
  appended.startsWith(`${baseWithQuery}&qa=opening`),
  'existing query preserved, params appended with &',
);
const appendedParsed = parseReviewUrl(appended);
assert.ok(appendedParsed, 'appended URL parses');
assert.equal(appendedParsed.seed, 9, 'seed survives base-with-query append');
assert.equal(appendedParsed.tick, 4, 'tick survives base-with-query append');
assert.throws(
  () => buildReviewUrl({ reviewBaseUrl: '', seed: 1, tick: 1 }),
  TypeError,
  'empty base rejected',
);

// --- 6. Parse tolerance of unknown future params ----------------------------

const tolerant = parseReviewUrl(
  'https://deck.forge.example/?qa=opening&qa-seed=7&qa-run=1&orientation=landscape-left&forge-tick=3&view=close&theme=dark',
);
assert.ok(tolerant, 'URL with unknown params parses');
assert.equal(tolerant.scenario, 'opening', 'unknown params do not disturb scenario');
assert.equal(tolerant.seed, 7, 'unknown params do not disturb seed');
assert.equal(tolerant.tick, 3, 'unknown params do not disturb tick');
assert.equal(tolerant.qaRun, true, 'unknown params do not disturb qa-run');

// --- 7. Parse returns null on garbage / non-URL -----------------------------

assert.equal(parseReviewUrl('not a url'), null, 'garbage string parses to null');
assert.equal(parseReviewUrl('https://'), null, 'bare scheme parses to null');
assert.equal(parseReviewUrl(''), null, 'empty string parses to null');
assert.equal(parseReviewUrl(42 as unknown as string), null, 'non-string input parses to null');

// --- 8. Frozen param order --------------------------------------------------

const orderUrl = buildReviewUrl({
  reviewBaseUrl: DECK,
  seed: 5,
  tick: 2,
  scenario: 'battle',
  orientation: 'landscape-right',
});
const iQa = orderUrl.indexOf('qa=');
const iSeed = orderUrl.indexOf('qa-seed=');
const iRun = orderUrl.indexOf('qa-run=');
const iOri = orderUrl.indexOf('orientation=');
const iTick = orderUrl.indexOf('forge-tick=');
assert.ok(iQa !== -1 && iSeed !== -1 && iRun !== -1 && iOri !== -1 && iTick !== -1, 'all five params present');
assert.ok(
  iQa < iSeed && iSeed < iRun && iRun < iOri && iOri < iTick,
  'param order frozen: qa < qa-seed < qa-run < orientation < forge-tick',
);

// --- 9. buildFrameRefParams exact query string ------------------------------

assert.equal(
  buildFrameRefParams(424242, 9600),
  '?qa=opening&qa-seed=424242&qa-run=1&orientation=landscape-left&forge-tick=9600',
  'frame-ref params string is frozen exactly',
);
const paramsRoundTrip = parseReviewUrl(`${DECK}${buildFrameRefParams(57005, 12000)}`);
assert.ok(paramsRoundTrip, 'frame-ref params compose into a parseable URL');
assert.equal(paramsRoundTrip.scenario, 'opening');
assert.equal(paramsRoundTrip.seed, 57005);
assert.equal(paramsRoundTrip.tick, 12000);
assert.equal(paramsRoundTrip.qaRun, true);

// --- 10. Parse validates ranges: bad values treated as absent ---------------

const badSeed = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=abc&qa-run=1&forge-tick=5');
assert.ok(badSeed, 'URL with non-numeric seed still parses');
assert.equal(badSeed.seed, null, 'non-numeric seed is absent');
const negSeed = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=-1&forge-tick=5');
assert.ok(negSeed, 'URL with negative seed still parses');
assert.equal(negSeed.seed, null, 'negative seed is absent');
const overflowSeed = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=4294967296&forge-tick=5');
assert.ok(overflowSeed, 'URL with overflowing seed still parses');
assert.equal(overflowSeed.seed, null, 'overflowing seed is absent');
const badTick = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=1&forge-tick=abc');
assert.ok(badTick, 'URL with non-numeric tick still parses');
assert.equal(badTick.tick, null, 'non-numeric tick is absent');
const negTick = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=1&forge-tick=-5');
assert.ok(negTick, 'URL with negative tick still parses');
assert.equal(negTick.tick, null, 'negative tick is absent');
const unknownScenario = parseReviewUrl('https://deck.forge.example/?qa=future-route&qa-seed=1&forge-tick=5');
assert.ok(unknownScenario, 'URL with unknown scenario id still parses');
assert.equal(unknownScenario.scenario, null, 'unknown scenario id is absent');
assert.equal(unknownScenario.seed, 1, 'other components survive an unknown scenario');
const badOrientation = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-seed=1&forge-tick=5&orientation=portrait');
assert.ok(badOrientation, 'URL with bad orientation still parses');
assert.equal(badOrientation.orientation, 'landscape-left', 'bad orientation falls back to landscape-left');
const noParams = parseReviewUrl('https://deck.forge.example/review');
assert.ok(noParams, 'paramless URL parses');
assert.deepEqual(
  noParams,
  { scenario: null, seed: null, tick: null, orientation: 'landscape-left', qaRun: false },
  'paramless URL yields all-absent defaults',
);
const qaRunZero = parseReviewUrl('https://deck.forge.example/?qa=opening&qa-run=0&forge-tick=1');
assert.ok(qaRunZero, 'URL with qa-run=0 parses');
assert.equal(qaRunZero.qaRun, false, 'qa-run=0 is not a run flag');

console.log('FTR review link tests: PASS');
