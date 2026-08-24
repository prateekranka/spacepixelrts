import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  SCENE_FPS,
  SCENE_STEP_MS,
  quantizeSceneTime,
  sceneForFaction,
  sceneMotionFrame,
  sceneMotionOffset,
  type SceneId,
} from '../src/front-end-scene';

const ids: readonly SceneId[] = ['sunweaver-capital', 'gravemark-quarry'];
assert.deepEqual(ids, ['sunweaver-capital', 'gravemark-quarry']);
assert.equal(sceneForFaction('sunweaver'), 'sunweaver-capital');
assert.equal(sceneForFaction('gravemark'), 'gravemark-quarry');
assert.equal(new Set(ids).size, 2, 'factions have distinct scene packs');

assert.equal(SCENE_FPS, 12);
assert.equal(SCENE_STEP_MS, 1000 / 12);
assert.equal(quantizeSceneTime(0), 0);
assert.equal(quantizeSceneTime(1), 0);
assert.equal(quantizeSceneTime(SCENE_STEP_MS), 1);
assert.equal(quantizeSceneTime(SCENE_STEP_MS * 2.99), 2);
assert.equal(quantizeSceneTime(Number.NaN), 0);

assert.equal(sceneMotionFrame(18, true), 0, 'Reduced Motion freezes the visual frame');
assert.equal(sceneMotionFrame(18, false), 18);
assert.equal(sceneMotionOffset(18, 8, 0, true), 0, 'Reduced Motion removes moving-unit offsets');
assert.notEqual(sceneMotionOffset(18, 8, 0, false), 0);

const sourcePath = fileURLToPath(new URL('../src/front-end-scene.ts', import.meta.url));
const source = readFileSync(sourcePath, 'utf8');
assert.equal(source.includes('Math.random'), false, 'scene packs do not use random themes');
assert.equal(source.includes('hue-rotate'), false, 'scene packs do not filter a flattened painting');
assert.equal(source.includes('front-end-theme-runtime'), false, 'scene packs are not old theme copies');

console.log('Front-end scene tests: PASS');
