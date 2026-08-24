import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiRoot = path.join(repoRoot, 'public', 'front-end-ui');
const fontsRoot = path.join(uiRoot, 'fonts');
const iconsRoot = path.join(uiRoot, 'icons');
const shellCssPath = path.join(repoRoot, 'public', 'front-end-shell.css');
const startScreenPath = path.join(repoRoot, 'src', 'start-screen.ts');
const shellCss = readFileSync(shellCssPath, 'utf8');
const startScreen = readFileSync(startScreenPath, 'utf8');

const requiredFonts = [
  'PixelifySans-Bold.woff2',
  'Silkscreen-Regular.woff2',
  'Silkscreen-Bold.woff2',
  'KodeMono-Regular.woff2',
  'KodeMono-Medium.woff2',
] as const;
const requiredLicenses = [
  'PixelifySans-OFL.txt',
  'Silkscreen-OFL.txt',
  'KodeMono-OFL.txt',
] as const;
const requiredIcons = [
  'records.svg',
  'history.svg',
  'codex.svg',
  'dispatches.svg',
  'sunweaver-sigil.svg',
  'gravemark-sigil.svg',
] as const;

function assertNonEmpty(filePath: string): void {
  assert.equal(statSync(filePath).isFile(), true, `${filePath} is a file`);
  assert.ok(statSync(filePath).size > 0, `${filePath} is non-empty`);
}

for (const file of requiredFonts) {
  const filePath = path.join(fontsRoot, file);
  assertNonEmpty(filePath);
  assert.equal(readFileSync(filePath).subarray(0, 4).toString('ascii'), 'wOF2', `${file} is WOFF2`);
}

for (const file of requiredLicenses) {
  const filePath = path.join(fontsRoot, file);
  assertNonEmpty(filePath);
  const license = readFileSync(filePath, 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE/i, `${file} identifies the SIL license`);
  assert.match(license, /Version 1\.1/i, `${file} identifies OFL 1.1`);
}

const provenancePath = path.join(uiRoot, 'PROVENANCE.md');
assertNonEmpty(provenancePath);
const provenance = readFileSync(provenancePath, 'utf8');
assert.match(provenance, /SIL Open Font License 1\.1/i);
for (const file of requiredFonts) assert.match(provenance, new RegExp(file.replace(/[.[\]\\]/g, '\\$&')));

for (const file of requiredIcons) {
  const filePath = path.join(iconsRoot, file);
  assertNonEmpty(filePath);
  const svg = readFileSync(filePath, 'utf8');
  const viewBox = svg.match(/\bviewBox\s*=\s*"([^"]+)"/i)?.[1] ?? '';
  assert.match(viewBox, /^-?\d+\s+-?\d+\s+-?\d+\s+-?\d+$/, `${file} has an integer viewBox`);
  assert.match(svg, /shape-rendering\s*=\s*"crispEdges"/i, `${file} uses crisp edges`);
  assert.doesNotMatch(svg, /<text\b/i, `${file} has no text nodes`);
  assert.doesNotMatch(svg, /<filter\b|\bfilter\s*=/i, `${file} has no filters`);
  assert.doesNotMatch(svg, /-?\d+\.\d+/, `${file} has no fractional numeric values`);
  const pathData = [...svg.matchAll(/\bd\s*=\s*"([^"]*)"/gi)].map((match) => match[1]).join(' ');
  assert.doesNotMatch(pathData, /[CQSAcqsa]/, `${file} has no curve-dependent path commands`);
}

const exactTokens: ReadonlyArray<readonly [string, string]> = [
  ['--px-black', '#05070c'],
  ['--px-ink', '#090d15'],
  ['--px-panel', '#0d1420'],
  ['--px-panel-raised', '#131b29'],
  ['--px-border-dark', '#020408'],
  ['--px-border-mid', '#39485c'],
  ['--px-text', '#f1ead8'],
  ['--px-text-muted', '#a6b0bd'],
  ['--px-disabled', '#59616d'],
  ['--civ-primary', '#f3b83f'],
  ['--civ-bright', '#ffe8a4'],
  ['--civ-secondary', '#75d7df'],
  ['--civ-warning', '#e37d48'],
  ['--civ-shadow', '#6d4315'],
  ['--civ-primary', '#76d5df'],
  ['--civ-bright', '#cafaff'],
  ['--civ-secondary', '#6f9b82'],
  ['--civ-warning', '#e37d48'],
  ['--civ-shadow', '#193a43'],
];
for (const [name, value] of exactTokens) {
  assert.match(shellCss, new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}`), `${name} ${value}`);
}

const fontBlocks = shellCss.match(/@font-face\s*\{[\s\S]*?\}/g) ?? [];
assert.equal(fontBlocks.length, requiredFonts.length, 'one local @font-face exists for every fixed font file');
for (const block of fontBlocks) {
  assert.match(block, /url\(["']\/front-end-ui\/fonts\/[^"']+\.woff2["']\)/);
  assert.doesNotMatch(block, /fonts\.(?:googleapis|gstatic)\.com/i);
}
assert.doesNotMatch(shellCss, /fonts\.(?:googleapis|gstatic)\.com|https?:\/\//i, 'CSS has no runtime font CDN');

function collectFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

const productionFiles = [
  ...collectFiles(path.join(repoRoot, 'src')).filter((file) => file.endsWith('.ts')),
  ...collectFiles(path.join(repoRoot, 'public')).filter((file) => file.endsWith('.css') || file.endsWith('.html')),
  path.join(repoRoot, 'index.html'),
];
const productionSource = productionFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
assert.doesNotMatch(productionSource, /fonts\.(?:googleapis|gstatic)\.com/i, 'production has no runtime font CDN');

for (const glyph of ['▦', '◷', '✧', '✉', '✦', '◌']) {
  assert.equal(productionSource.includes(glyph), false, `old Unicode asset ${glyph} is absent from production TypeScript/HTML`);
}

const utilityButtons: ReadonlyArray<readonly [string, string, string]> = [
  ['records', 'Records', 'records.svg'],
  ['history', 'Match History', 'history.svg'],
  ['codex', 'Tech Codex', 'codex.svg'],
  ['dispatches', 'Dispatches', 'dispatches.svg'],
];
for (const [action, label, icon] of utilityButtons) {
  assert.match(
    startScreen,
    new RegExp(`utilityButton\\('${action}', '${label}', '/front-end-ui/icons/${icon}'\\)`),
    `${label} keeps its authored icon reference`,
  );
}
assert.match(startScreen, /private utilityButton\(action: PanelKind, label: string, iconSrc: string\)/);
assert.match(startScreen, /<button type="button" class="utility-button"/);
assert.match(startScreen, /aria-label="\$\{label\}"/);
assert.match(startScreen, /data-start-action="\$\{action\}"/);
assert.match(startScreen, /--px-icon-src:url\('\$\{iconSrc\}'\)/);
assert.match(startScreen, /sunweaver-sigil\.svg/);
assert.match(startScreen, /gravemark-sigil\.svg/);

const baselineCommit = '645b0ec';
execFileSync('git', ['cat-file', '-e', `${baselineCommit}^{commit}`], { cwd: repoRoot });
const protectedFiles = [
  'src/sim.ts',
  'src/engine.ts',
  ...execFileSync('git', ['ls-tree', '-r', '--name-only', baselineCommit, '--', 'public/front-end/civilizations'], { cwd: repoRoot })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean),
];
for (const relativePath of protectedFiles) {
  const current = readFileSync(path.join(repoRoot, relativePath));
  const baseline = execFileSync('git', ['show', `${baselineCommit}:${relativePath}`], { cwd: repoRoot });
  assert.deepEqual(current, baseline, `${relativePath} is unchanged from ${baselineCommit}`);
}

console.log('FPE-1 pixel front-end foundation tests: PASS');
