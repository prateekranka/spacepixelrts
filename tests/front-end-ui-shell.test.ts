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
assert.match(startScreen, /aria-describedby="\$\{tooltipId\}"/);
assert.match(startScreen, /class="utility-tooltip" id="\$\{tooltipId\}" role="tooltip"/);
assert.match(startScreen, /sunweaver-sigil\.svg/);
assert.match(startScreen, /gravemark-sigil\.svg/);

assert.doesNotMatch(startScreen, /START_SCREEN_CSS|injectCss/, 'start-screen presentation is not injected at runtime');
assert.match(startScreen, /this\.root\.dataset\.civ\s*=\s*this\.profile\.preferredFaction/);

const menuMarkupStart = startScreen.indexOf('<section class="menu-view">');
const setupMarkupStart = startScreen.indexOf('<section class="setup-view"');
assert.ok(menuMarkupStart >= 0 && setupMarkupStart > menuMarkupStart, 'Main Menu markup section is present');
const mainMenuMarkup = startScreen.slice(menuMarkupStart, setupMarkupStart);
assert.equal((mainMenuMarkup.match(/data-primary-action="true"/g) ?? []).length, 1, 'Main Menu has one primary action marker');
assert.equal((mainMenuMarkup.match(/class="menu-item primary"/g) ?? []).length, 1, 'Main Menu has one primary button');
assert.match(mainMenuMarkup, /data-start-action="new-skirmish"/);
assert.doesNotMatch(mainMenuMarkup, /data-start-action="start-match"/);

const mainMenuCssStart = shellCss.indexOf('/* FPE-2 MAIN MENU PIXEL SHELL');
const mainMenuCssEnd = shellCss.indexOf('/* FPE-3 MATCH SETUP AND PANELS PIXEL SHELL');
assert.ok(mainMenuCssStart >= 0 && mainMenuCssEnd > mainMenuCssStart, 'Main Menu CSS section is explicitly bounded');
const mainMenuCss = shellCss.slice(mainMenuCssStart, mainMenuCssEnd);
assert.match(mainMenuCss, /\.start-heading h1[\s\S]*font-family:\s*var\(--font-display\)/);
assert.match(mainMenuCss, /\.start-kicker[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.menu-item strong[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.menu-item small[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.start-promise[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.start-note[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.profile-badge em[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.start-promise[\s\S]*font-size:\s*16px[\s\S]*letter-spacing:\s*\.04em/);
assert.match(mainMenuCss, /\.start-note[\s\S]*font-size:\s*13px[\s\S]*letter-spacing:\s*\.04em/);
assert.match(mainMenuCss, /\.start-footer[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(mainMenuCss, /\.start-footer[\s\S]*text-shadow:\s*1px 1px 0 var\(--px-border-dark\)/);
assert.match(mainMenuCss, /\.start-footer span:last-child::before[\s\S]*height:\s*12px[\s\S]*background-color:\s*var\(--civ-primary\)/);
assert.match(mainMenuCss, /@media \(max-width:\s*1200px\)[\s\S]*padding-bottom:\s*28px/);
assert.match(mainMenuCss, /@media \(max-height:\s*820px\) and \(min-width:\s*1201px\)[\s\S]*padding-bottom:\s*24px/);
assert.match(mainMenuCss, /\.profile-badge[\s\S]*width:\s*448px[\s\S]*height:\s*64px[\s\S]*border:\s*2px[\s\S]*box-shadow:\s*4px 4px 0/);
assert.match(mainMenuCss, /\.menu-item[\s\S]*height:\s*64px[\s\S]*min-height:\s*64px[\s\S]*border:\s*2px/);
assert.match(mainMenuCss, /\.menu-list[\s\S]*gap:\s*8px[\s\S]*width:\s*448px/);
assert.match(mainMenuCss, /\.utility-button[\s\S]*width:\s*56px[\s\S]*height:\s*56px/);
assert.match(mainMenuCss, /\.menu-item:hover[^\{]*[\s\S]*transform:\s*translateX\(2px\)/);
assert.match(mainMenuCss, /\.menu-item:active[^\{]*[\s\S]*transform:\s*translateY\(2px\)/);
assert.match(mainMenuCss, /transition:\s*transform 100ms steps\(2, end\)/);
assert.match(mainMenuCss, /mask-image:\s*var\(--px-icon-src\)/);
assert.match(mainMenuCss, /-webkit-mask-image:\s*var\(--px-icon-src\)/);
assert.match(mainMenuCss, /\.pixel-selection-marker/);
assert.doesNotMatch(mainMenuCss, /backdrop-filter|filter\s*:\s*blur|(?:linear|radial)-gradient|cubic-bezier/i);
assert.doesNotMatch(mainMenuCss, /\bbox-shadow\s*:[^;]*(?:blur|\d+px\s+\d+px\s+\d+px)/i);
assert.doesNotMatch(mainMenuCss, /\bborder-radius\s*:\s*(?:[3-9]|[1-9]\d|\d+\.\d+)px/i);
assert.doesNotMatch(mainMenuCss, /\btranslate(?:X|Y)?\([^)]*\.\d/);
assert.doesNotMatch(mainMenuCss, /\b(?:ease|ease-in|ease-out)\b/i);

const setupPanelCssStart = mainMenuCssEnd;
const setupPanelCssEnd = shellCss.indexOf('/* FPE-4 LEGACY LOADING RULES');
assert.ok(setupPanelCssStart >= 0 && setupPanelCssEnd > setupPanelCssStart, 'setup/panel CSS section is explicitly bounded');
const setupPanelCss = shellCss.slice(setupPanelCssStart, setupPanelCssEnd);
assert.doesNotMatch(shellCss, /FPE-3 LEGACY SETUP AND PANELS/i, 'FPE-3 legacy marker is removed');
assert.doesNotMatch(setupPanelCss, /backdrop-filter|blur|(?:linear|radial|conic)-gradient|cubic-bezier/i, 'setup/panel CSS has no glass, blur, or gradient treatment');
assert.doesNotMatch(setupPanelCss, /\b(?:ease|ease-in|ease-out)\b/i, 'setup/panel CSS has no smooth easing');
assert.doesNotMatch(setupPanelCss, /\bbox-shadow\s*:[^;]*(?:blur|\d+px\s+\d+px\s+\d+px)/i, 'setup/panel shadows stay hard');
assert.doesNotMatch(setupPanelCss, /\bborder-radius\s*:\s*(?:[3-9]|[1-9]\d|\d+\.\d+)px/i, 'setup/panel geometry has no rounded corners');
assert.doesNotMatch(setupPanelCss, /\btranslate(?:X|Y)?\([^)]*\.\d/i, 'setup/panel transforms use integer pixels');
assert.doesNotMatch(setupPanelCss, /background(?:-color)?\s*:\s*transparent/i, 'setup/panel has no transparent invisible hotspot surface');
assert.match(setupPanelCss, /border:\s*2px\s+solid/);
assert.match(setupPanelCss, /border:\s*1px\s+solid/);
assert.match(setupPanelCss, /box-shadow:\s*6px\s+6px\s+0\s+var\(--px-border-dark\)/);
assert.match(setupPanelCss, /clip-path:\s*polygon\(8px\s+0/);
assert.match(setupPanelCss, /\.setup-heading h2[\s\S]*font-family:\s*var\(--font-display\)/);
assert.match(setupPanelCss, /\.setup-field legend[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(setupPanelCss, /\.setup-status[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(setupPanelCss, /\.seed-row input[\s\S]*font-family:\s*var\(--font-body\)/);
assert.match(setupPanelCss, /\.panel-card h2[\s\S]*font-family:\s*var\(--font-display\)/);
assert.match(setupPanelCss, /\.panel-content[\s\S]*font-family:\s*var\(--font-body\)/);
assert.match(setupPanelCss, /animation:\s*panel-reveal\s+140ms\s+steps\(4, end\)/);
assert.match(setupPanelCss, /@keyframes panel-reveal[\s\S]*clip-path:/);
assert.match(setupPanelCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.panel-card[\s\S]*animation:\s*none !important/);
assert.match(setupPanelCss, /\.setup-card::-webkit-scrollbar[\s\S]*width:\s*12px/);
assert.match(setupPanelCss, /\.setup-card::-webkit-scrollbar-thumb[\s\S]*background-color:\s*var\(--civ-primary\)/);
assert.match(setupPanelCss, /\.panel-card[\s\S]*scrollbar-color:\s*var\(--civ-primary\)\s+var\(--px-ink\)/);
assert.match(setupPanelCss, /\.panel-close-icon::before[\s\S]*transform:\s*rotate\(45deg\)/);
assert.match(setupPanelCss, /\.panel-close-icon::after[\s\S]*transform:\s*rotate\(-45deg\)/);

assert.doesNotMatch(startScreen, /<button[^>]*class="panel-close"[^>]*>[^<]*×/u, 'panel close has no Unicode icon text');
assert.match(startScreen, /class="panel-close"[^>]*aria-label="Close"[^>]*><span class="panel-close-icon"/);
for (const action of ['tutorial', 'factions', 'settings', 'records', 'history', 'codex', 'dispatches']) {
  assert.match(startScreen, new RegExp(`['"]${action}['"]`), `${action} panel action remains present`);
}

const fpe4Marker = '/* FPE-4 LEGACY LOADING RULES';
assert.equal((shellCss.match(/FPE-\d+ LEGACY/g) ?? []).length, 1, 'loading is the only explicitly scoped legacy surface');
assert.equal((shellCss.match(new RegExp(fpe4Marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g')) ?? []).length, 1);
assert.doesNotMatch(shellCss.slice(0, setupPanelCssEnd), /\bLEGACY\b/i, 'pre-loading production sections have no legacy marker');
assert.match(shellCss.slice(setupPanelCssEnd), /\.front-loading-screen/);

const baselineCommit = '645b0ec';
execFileSync('git', ['cat-file', '-e', `${baselineCommit}^{commit}`], { cwd: repoRoot });
const protectedFiles = [
  'src/sim.ts',
  'src/engine.ts',
  'src/render.ts',
  'src/front-end-scene.ts',
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

console.log('FPE-3 pixel front-end shell tests: PASS');
