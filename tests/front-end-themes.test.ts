import assert from 'node:assert/strict';
import {
  FRONT_END_THEMES,
  frontEndThemeById,
  isFrontEndThemeId,
  resolveFrontEndThemeId,
} from '../src/front-end-theme-runtime';

const ids = FRONT_END_THEMES.map((theme) => theme.id);
assert.deepEqual(ids, [
  'violet-orbit',
  'solar-foundry',
  'cyan-rift',
  'crimson-citadel',
], 'the approved P6/L6 family contains one base and three additional variants');

assert.equal(resolveFrontEndThemeId('?front-theme=solar-foundry', () => 0), 'solar-foundry');
assert.equal(resolveFrontEndThemeId('?front-theme=cyan-rift&qa=opening', () => 0), 'cyan-rift');
assert.equal(resolveFrontEndThemeId('?qa=opening', () => 0.99), 'violet-orbit', 'QA remains deterministic');
assert.equal(resolveFrontEndThemeId('', () => 0), 'violet-orbit');
assert.equal(resolveFrontEndThemeId('', () => 0.249999), 'violet-orbit');
assert.equal(resolveFrontEndThemeId('', () => 0.25), 'solar-foundry');
assert.equal(resolveFrontEndThemeId('', () => 0.5), 'cyan-rift');
assert.equal(resolveFrontEndThemeId('', () => 0.75), 'crimson-citadel');
assert.equal(resolveFrontEndThemeId('', () => 0.999999), 'crimson-citadel');
assert.equal(resolveFrontEndThemeId('?front-theme=not-a-theme', () => Number.NaN), 'violet-orbit');

assert.equal(isFrontEndThemeId('violet-orbit'), true);
assert.equal(isFrontEndThemeId('not-a-theme'), false);
assert.equal(frontEndThemeById('crimson-citadel').label, 'Crimson Citadel');

for (const theme of FRONT_END_THEMES) {
  assert.match(theme.accent, /^#[0-9a-f]{6}$/i, `${theme.id} has a CSS accent`);
  assert.ok(theme.progress >= 60 && theme.progress <= 85, `${theme.id} has a credible loading state`);
  assert.ok(theme.tip.length >= 50, `${theme.id} has a useful gameplay tip`);
  assert.equal(/\bRTS\b/i.test(theme.label), false, `${theme.id} does not put RTS under the Starhaven name`);
  assert.equal(theme.terrain.length, 3, `${theme.id} has three pixel-terrain layers`);
}

console.log('Front-end theme selection tests: PASS');
