import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLoadingSegmentMarkup,
  LOADING_SEGMENT_COUNT,
  loadingSegmentCount,
  loadingSegmentState,
} from '../src/loading-segments';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiRoot = path.join(repoRoot, 'public', 'front-end-ui');
const fontsRoot = path.join(uiRoot, 'fonts');
const iconsRoot = path.join(uiRoot, 'icons');
const shellCssPath = path.join(repoRoot, 'public', 'front-end-shell.css');
const indexPath = path.join(repoRoot, 'index.html');
const generatedDesktopPath = path.join(repoRoot, 'dist', 'desktop.html');
const desktopGeneratorPath = path.join(repoRoot, 'scripts', 'gen-desktop.mjs');
const startScreenPath = path.join(repoRoot, 'src', 'start-screen.ts');
const mainPath = path.join(repoRoot, 'src', 'main.ts');
const shellCss = readFileSync(shellCssPath, 'utf8');
const indexSource = readFileSync(indexPath, 'utf8');
const generatedDesktop = existsSync(generatedDesktopPath) ? readFileSync(generatedDesktopPath, 'utf8') : '';
const desktopGenerator = readFileSync(desktopGeneratorPath, 'utf8');
const startScreen = readFileSync(startScreenPath, 'utf8');
const mainSource = readFileSync(mainPath, 'utf8');

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

const frontEndSurface = [shellCss, indexSource, generatedDesktop, startScreen, mainSource].join('\n');
const bannedSurfaceStyle = /Trebuchet|Segoe(?: UI)?|Arial|generic\s+sans-serif|backdrop-filter|filter\s*:\s*blur|(?:linear|radial|conic)-gradient|cubic-bezier|hue-rotate/i;
assert.doesNotMatch(frontEndSurface, bannedSurfaceStyle, 'front-end surface has no banned font, glass, gradient, easing, or hue treatment');
assert.doesNotMatch(frontEndSurface, /box-shadow\s*:[^;]*(?:blur|\d+px\s+\d+px\s+\d+px)/i, 'front-end surface uses hard shadows only');
assert.doesNotMatch(frontEndSurface, /\bborder-radius\s*:\s*(?:[3-9]|[1-9]\d|\d+\.\d+)px/i, 'front-end surface has no radius above 2px');
assert.doesNotMatch(frontEndSurface, /\btranslate(?:X|Y)?\([^)]*\.\d/i, 'front-end surface has no fractional translate');
assert.doesNotMatch(frontEndSurface, /FPE-\d+ LEGACY/i, 'front-end surface has no legacy marker');
assert.match(desktopGenerator, /readFileSync\('dist\/index\.html'/, 'desktop.html is generated from the built index');
assert.match(desktopGenerator, /writeFileSync\('dist\/desktop\.html'/, 'desktop.html has one generator owner');
if (generatedDesktop !== '') {
  assert.match(generatedDesktop, /id="rotate-gate"/, 'generated desktop preserves the corrected rotate gate markup');
  assert.match(generatedDesktop, /id="desktop-override"/, 'generated desktop owns only the desktop visibility override');
  assert.doesNotMatch(generatedDesktop, bannedSurfaceStyle, 'generated desktop has no banned inline surface style');
}

const sunweaverManifest = JSON.parse(readFileSync(path.join(repoRoot, 'public', 'front-end', 'civilizations', 'sunweaver', 'manifest.json'), 'utf8')) as Record<string, unknown>;
const gravemarkManifest = JSON.parse(readFileSync(path.join(repoRoot, 'public', 'front-end', 'civilizations', 'gravemark', 'manifest.json'), 'utf8')) as Record<string, unknown>;
assert.equal((sunweaverManifest.menu as { scene?: string }).scene, 'sunweaver-capital', 'Sunweaver manifest keeps its authored scene id');
assert.equal((gravemarkManifest.menu as { scene?: string }).scene, 'gravemark-quarry', 'Gravemark manifest keeps its authored scene id');
assert.notDeepEqual(sunweaverManifest, gravemarkManifest, 'authored faction manifests remain distinct');
assert.match(`${startScreen}\n${mainSource}`, /mountFrontEndScene/);
assert.doesNotMatch(`${startScreen}\n${mainSource}`, /procedural|drawFallback|fallbackPalette/i, 'production front-end path does not reference a procedural scene renderer');

for (const glyph of ['▦', '◷', '✧', '✉', '✦', '◌']) {
  assert.equal(productionSource.includes(glyph), false, `old Unicode asset ${glyph} is absent from production TypeScript/HTML`);
}
const utilitySourceStart = startScreen.indexOf('private utilityButton');
const utilitySource = utilitySourceStart >= 0 ? startScreen.slice(utilitySourceStart, startScreen.indexOf('private renderProfile', utilitySourceStart)) : '';
assert.doesNotMatch(utilitySource, /[\u2190-\u2bff]/u, 'utility controls have no Unicode icon text');
assert.doesNotMatch(startScreen, /class="panel-close"[^>]*>[^<]*[^\x00-\x7F]/u, 'close control has no Unicode icon text');

const motionDeclarations = [...shellCss.matchAll(/\b(?:transition|animation)\s*:\s*([^;]+)/g)].map((match) => match[1]);
assert.ok(motionDeclarations.length > 0, 'front-end shell has explicit motion declarations');
for (const declaration of motionDeclarations) {
  if (/\bnone\b/i.test(declaration)) continue;
  assert.match(declaration, /steps\(/i, `active shell motion is stepped: ${declaration}`);
}
assert.doesNotMatch(shellCss, /\b(?:scale|skew)(?:X|Y)?\s*\(/i, 'front-end shell has no scale or skew motion');
assert.doesNotMatch(shellCss, /\b(?:spring|drift)\b/i, 'front-end shell has no spring or drift motion');

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

const rotateGateMarkupStart = indexSource.indexOf('<div id="rotate-gate"');
assert.ok(rotateGateMarkupStart >= 0, 'portrait rotate gate markup is present in index.html');
const rotateGateMarkup = indexSource.slice(rotateGateMarkupStart, indexSource.indexOf('</div>\n    </div>', rotateGateMarkupStart) + '</div>\n    </div>'.length);
assert.match(rotateGateMarkup, /class="rotate-gate-card"/);
assert.match(rotateGateMarkup, /LANDSCAPE COMMAND REQUIRED/);
assert.match(rotateGateMarkup, /Rotate the iPad to landscape to command Starhaven/);
assert.doesNotMatch(rotateGateMarkup, /[\u2190-\u2bff]/u, 'rotate gate has no Unicode orientation icon text');

const rotateCssStart = shellCss.indexOf('/* FPE-5 PORTRAIT ORIENTATION GATE');
const rotateCssEnd = shellCss.indexOf('/* FPE-2 MAIN MENU PIXEL SHELL');
assert.ok(rotateCssStart >= 0 && rotateCssEnd > rotateCssStart, 'rotate-gate CSS section is explicitly bounded');
const rotateCss = shellCss.slice(rotateCssStart, rotateCssEnd);
assert.match(rotateCss, /\.rotate-gate-card[\s\S]*width:\s*min\(640px/);
assert.match(rotateCss, /\.rotate-gate-card[\s\S]*height:\s*280px/);
assert.match(rotateCss, /\.rotate-gate-card[\s\S]*border:\s*2px\s+solid/);
assert.match(rotateCss, /\.rotate-gate-card::before[\s\S]*border:\s*1px\s+solid/);
assert.match(rotateCss, /\.rotate-gate-card[\s\S]*box-shadow:\s*4px\s+4px\s+0/);
assert.match(rotateCss, /\.rotate-gate-card[\s\S]*clip-path:\s*polygon\(8px\s+0/);
assert.match(rotateCss, /\.rotate-gate-kicker[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(rotateCss, /\.rotate-gate-card h1[\s\S]*font-family:\s*var\(--font-display\)/);
assert.match(rotateCss, /\.rotate-gate-copy[\s\S]*font-family:\s*var\(--font-body\)/);
assert.doesNotMatch(rotateCss, bannedSurfaceStyle, 'rotate-gate surface has no banned font, glass, gradient, easing, or hue treatment');

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
const setupPanelCssEnd = shellCss.indexOf('/* FPE-4 SEGMENTED LOADING COMMAND PANEL');
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
const panelCardRule = setupPanelCss.match(/(?:^|\n)\.panel-card\s*\{\s*display:\s*flex[\s\S]*?\n\}/)?.[0] ?? '';
const panelFrameRule = setupPanelCss.match(/\.setup-heading::after,[\s\S]*?\.panel-card::before\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
const panelAccentRule = setupPanelCss.match(/(?:^|\n)\.panel-card::after\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
const oddPanelAccentRule = setupPanelCss.match(/\.panel-card\[data-panel-kind="tutorial"\]::after,[\s\S]*?\.panel-card\[data-panel-kind="history"\]::after\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
const evenPanelAccentRule = setupPanelCss.match(/\.panel-card\[data-panel-kind="records"\]::after,[\s\S]*?\.panel-card\[data-panel-kind="dispatches"\]::after\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
assert.ok(panelCardRule, 'panel card rule is present');
assert.match(panelCardRule, /width:\s*min\(880px,\s*calc\(100vw - 48px\)\)/, 'panel cards keep the shared 880px width');
assert.doesNotMatch(panelCardRule, /min-height/, 'panel cards have no fixed minimum height');
assert.match(panelFrameRule, /position:\s*absolute/);
assert.match(panelFrameRule, /inset:\s*2px/);
assert.match(panelFrameRule, /border:\s*1px\s+solid/);
assert.match(panelAccentRule, /display:\s*block/);
assert.match(panelAccentRule, /position:\s*static/, 'panel accent remains in normal flow');
assert.match(panelAccentRule, /flex:\s*0 0 auto/);
assert.match(panelAccentRule, /margin-top:\s*16px/);
assert.match(oddPanelAccentRule, /height:\s*1px/);
assert.match(evenPanelAccentRule, /height:\s*2px/);
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
assert.match(startScreen, /setAttribute\('data-panel-kind', kind\)/, 'panel kind is exposed for responsive geometry QA');

const loadingCssStart = shellCss.indexOf('/* FPE-4 SEGMENTED LOADING COMMAND PANEL');
assert.ok(loadingCssStart === setupPanelCssEnd, 'segmented loading CSS section is explicitly bounded');
const loadingCss = shellCss.slice(loadingCssStart);
assert.doesNotMatch(shellCss, /FPE-\d+ LEGACY/i, 'no FPE legacy marker remains in production CSS');
assert.doesNotMatch(productionSource, /FPE-\d+ LEGACY/i, 'no FPE legacy marker remains in production source');

const segmentMarkup = createLoadingSegmentMarkup();
assert.equal(LOADING_SEGMENT_COUNT, 16, 'loading strip has exactly 16 segments');
assert.equal((segmentMarkup.match(/class="front-loading-segment"/g) ?? []).length, 16, 'pure loading helper emits exactly 16 segment elements');
assert.equal((segmentMarkup.match(/<span\b/g) ?? []).length, 16, 'loading helper emits real span elements');
assert.equal((segmentMarkup.match(/<i\b/g) ?? []).length, 0, 'loading helper has no legacy continuous child');
assert.deepEqual(
  [1, 2, 3].map((stage) => loadingSegmentCount(stage as 1 | 2 | 3)),
  [4, 10, 16],
  'loading stages use complete segment states only',
);
assert.equal(loadingSegmentState(1, 3), 'active');
assert.equal(loadingSegmentState(2, 9), 'active');
assert.equal(loadingSegmentState(3, 15), 'complete');
assert.equal(loadingSegmentState(3, 16), 'future');
assert.match(mainSource, /createLoadingSegmentMarkup\(\)/);
assert.match(mainSource, /function markLoadingScreenCreated\(\)/);
assert.match(mainSource, /function markLoadingSceneReady\(\)/);
assert.match(mainSource, /function markLoadingMatchReady\(\)/);
assert.match(mainSource, /new MutationObserver\(checkReady\)/);
assert.match(mainSource, /disconnectLoadingSceneObserver\(\)/);
assert.match(mainSource, /loadingScreenCreated/);
assert.match(mainSource, /loadingSceneReady/);
assert.match(mainSource, /loadingMatchReady/);
assert.doesNotMatch(mainSource, /aria-valuenow|role="progressbar"/i, 'loading does not claim a fake numeric progress value');
assert.doesNotMatch(mainSource, /front-loading-track|<i\b|Math\.random|setTimeout\s*\(/, 'loading has no legacy bar, random progress, or artificial delay');
assert.doesNotMatch(loadingCss, /front-loading-track|front-loading-progress|scaleX|(?:^|[;\s])width:\s*\d+%/i, 'loading has no continuous progress child or scale animation');
assert.match(loadingCss, /\.front-loading-card[\s\S]*width:\s*704px[\s\S]*height:\s*152px/);
assert.match(loadingCss, /\.front-loading-card[\s\S]*border:\s*2px\s+solid/);
assert.match(loadingCss, /\.front-loading-card::before[\s\S]*border:\s*1px\s+solid/);
assert.match(loadingCss, /\.front-loading-card[\s\S]*box-shadow:\s*4px\s+4px\s+0/);
assert.match(loadingCss, /\.front-loading-card[\s\S]*clip-path:\s*polygon\(8px\s+0/);
assert.match(loadingCss, /\.front-loading-segment-track[\s\S]*grid-template-columns:\s*repeat\(16/);
assert.match(loadingCss, /\.front-loading-segment-track[\s\S]*gap:\s*4px/);
assert.match(loadingCss, /\.front-loading-segment-track[\s\S]*border:\s*2px\s+solid/);
assert.match(loadingCss, /\.front-loading-kicker[\s\S]*font-family:\s*var\(--font-interface\)/);
assert.match(loadingCss, /\.front-loading-card h1[\s\S]*font-family:\s*var\(--font-display\)/);
assert.match(loadingCss, /\.front-loading-meta[\s\S]*font-family:\s*var\(--font-body\)/);
assert.match(loadingCss, /\.front-loading-tip[\s\S]*font-family:\s*var\(--font-body\)/);
assert.match(loadingCss, /animation:\s*front-loading-segment-blink\s+800ms\s+steps\(2, end\)/);
assert.match(loadingCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*front-loading-segment\[data-state="active"\][\s\S]*animation:\s*none/);
assert.doesNotMatch(loadingCss, /backdrop-filter|filter\s*:\s*blur|(?:linear|radial|conic)-gradient|cubic-bezier|Trebuchet|Segoe|Arial|generic sans-serif/i, 'loading CSS uses the production pixel bans');
assert.doesNotMatch(shellCss, /backdrop-filter|filter\s*:\s*blur|(?:linear|radial|conic)-gradient|cubic-bezier|Trebuchet|Segoe UI|Arial|fonts\.(?:googleapis|gstatic)\.com/i, 'full front-end shell has no banned glass, gradient, font, or CDN treatment');
assert.doesNotMatch(shellCss, /box-shadow\s*:[^;]*(?:blur|\d+px\s+\d+px\s+\d+px)/i, 'full front-end shell uses hard shadows only');
assert.doesNotMatch(shellCss, /front-loading-card[^}]*font-family:\s*["'](?:Trebuchet|Segoe)/i, 'old loading font is gone');

// SPX-10: the protected gameplay/compositor/asset baseline moved with the product
// merge. Anchor the invariant to the current product baseline f6f2add
// (docs/SPX10_PIXEL_UI_INTEGRATION.md protected hashes) instead of the pre-merge
// pixel branch baseline 645b0ec, whose render.ts predates the accepted Forge Art
// combat row overrides.
const baselineCommit = 'f6f2add';
execFileSync('git', ['cat-file', '-e', `${baselineCommit}^{commit}`], { cwd: repoRoot });
const protectedFiles = [
  'src/sim.ts',
  'src/engine.ts',
  'src/render.ts',
  'src/front-end-scene.ts',
  'src/generated/sunweaver-lumen-guard-accepted.ts',
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

console.log('FPE-5 pixel front-end shell tests: PASS');
