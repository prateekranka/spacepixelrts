import { readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync('index.html', 'utf8');
const idx = readFileSync('dist/index.html', 'utf8');
const override = '<style id="desktop-override">#rotate-gate{display:none !important}#app,#hud{visibility:visible !important}html,body{width:100vw;height:100vh;overflow:hidden}</style>';
const desktop = (html) => html.replace('<div id="app"></div>', override + '\n    <div id="app"></div>');
writeFileSync('desktop.html', desktop(source));
writeFileSync('dist/desktop.html', desktop(idx));
console.log('desktop.html generated');
