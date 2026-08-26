import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneStripFrame, validatePack } from '../src/front-end-scene';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const civilizations = ['sunweaver', 'gravemark'] as const;
const modes = ['menu', 'loading'] as const;
const issues: string[] = [];

assert.equal(sceneStripFrame(0, 6, 6), 0);
assert.equal(sceneStripFrame(11, 6, 6), 5);
assert.equal(sceneStripFrame(12, 6, 6), 0);
assert.equal(sceneStripFrame(19, 8, 8), 4);
assert.equal(sceneStripFrame(19, 8, 8, true), 0, 'Reduced Motion pins strips to frame 0');

for (const civilization of civilizations) {
  const civilizationRoot = path.join(repoRoot, 'public', 'front-end', 'civilizations', civilization);
  const manifestPath = path.join(civilizationRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    issues.push(`${civilization}: missing ${manifestPath}`);
    continue;
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    issues.push(`${civilization}: could not parse ${manifestPath}: ${String(error)}`);
    continue;
  }

  for (const mode of modes) {
    const pack = manifest[mode];
    const packLabel = `${civilization}/${mode}`;
    const validationErrors = validatePack(pack);
    for (const error of validationErrors) issues.push(`${packLabel}: ${error}`);
    if (typeof pack !== 'object' || pack === null) continue;

    const candidate = pack as {
      assets?: Array<{ file?: unknown; kind?: unknown; blend?: unknown }>;
      sprites?: Array<{ file?: unknown; frames?: unknown; blend?: unknown }>;
      twinkles?: { mask?: unknown };
    };
    const files = new Set<string>();
    for (const asset of candidate.assets ?? []) {
      if (typeof asset.file === 'string') {
        files.add(asset.file);
        if (!asset.file.toLowerCase().endsWith('.webp')) issues.push(`${packLabel}: scenic asset is not .webp: ${asset.file}`);
      }
      if (asset.kind !== 'cover' && asset.kind !== 'rect') issues.push(`${packLabel}: invalid asset kind in ${String(asset.file)}`);
      if (asset.blend !== 'source-over' && asset.blend !== 'screen') issues.push(`${packLabel}: invalid asset blend in ${String(asset.file)}`);
    }
    for (const sprite of candidate.sprites ?? []) {
      if (typeof sprite.file === 'string') {
        files.add(sprite.file);
        if (!sprite.file.toLowerCase().endsWith('.png')) issues.push(`${packLabel}: sprite is not .png: ${sprite.file}`);
      }
      if (!Array.isArray(sprite.frames) || sprite.frames.length === 0) issues.push(`${packLabel}: empty frames: ${String(sprite.file)}`);
      if (sprite.blend !== 'source-over' && sprite.blend !== 'screen') issues.push(`${packLabel}: invalid sprite blend in ${String(sprite.file)}`);
    }
    if (candidate.twinkles && typeof candidate.twinkles.mask === 'string') {
      files.add(candidate.twinkles.mask);
      if (!fs.existsSync(path.join(civilizationRoot, mode, candidate.twinkles.mask))) {
        issues.push(`${packLabel}: missing twinkles mask ${candidate.twinkles.mask}`);
      }
    }
    for (const file of files) {
      const filePath = path.join(civilizationRoot, mode, file);
      if (!fs.existsSync(filePath)) issues.push(`${packLabel}: missing referenced file ${file}`);
    }
  }
}

assert.equal(
  issues.length,
  0,
  ['AAA front-end pack validation failed:', ...issues].join('\n'),
);

console.log('AAA front-end scene tests: PASS');
