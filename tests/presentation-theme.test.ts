import assert from 'node:assert/strict';
import {
  DEFAULT_PRESENTATION_THEME,
  PRESENTATION_THEMES,
  presentationThemeById,
  selectPresentationTheme,
} from '../src/presentation-theme';

assert.deepEqual(
  PRESENTATION_THEMES.map((theme) => theme.id),
  ['nebula', 'solar', 'rift', 'ember'],
  'presentation theme IDs stay stable',
);
assert.equal(DEFAULT_PRESENTATION_THEME.id, 'nebula');
assert.equal(presentationThemeById(' RIFT ')?.id, 'rift', 'theme query parsing is case/space tolerant');
assert.equal(presentationThemeById('unknown'), null, 'unknown theme query is ignored');

for (const theme of PRESENTATION_THEMES) {
  assert.equal(selectPresentationTheme({ requested: theme.id, randomUint32: 0 }).id, theme.id);
  assert.equal(theme.menuArt, `/ui/presentation/${theme.id}-menu.webp`);
  assert.equal(theme.loadingArt, `/ui/presentation/${theme.id}-loading.webp`);
  assert.ok(!theme.label.toLowerCase().includes('rts'), `${theme.id} label has no RTS suffix`);
}

const deterministicA = selectPresentationTheme({ deterministicKey: 'qa:start-menu' });
const deterministicB = selectPresentationTheme({ deterministicKey: 'qa:start-menu' });
assert.equal(deterministicA.id, deterministicB.id, 'QA theme selection is deterministic');

assert.equal(selectPresentationTheme({ randomUint32: 0 }).id, 'nebula');
assert.equal(selectPresentationTheme({ randomUint32: 1 }).id, 'solar');
assert.equal(selectPresentationTheme({ randomUint32: 2 }).id, 'rift');
assert.equal(selectPresentationTheme({ randomUint32: 3 }).id, 'ember');
assert.equal(
  selectPresentationTheme({ randomUint32: 0, previousId: 'nebula' }).id,
  'solar',
  'normal reroll cannot immediately repeat the previous theme',
);

console.log('Presentation theme tests: PASS');
