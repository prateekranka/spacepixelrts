import { readFileSync, writeFileSync } from 'node:fs';
const idx = readFileSync('dist/index.html', 'utf8');
const override = '<style id="desktop-override">#rotate-gate{display:none !important}#app,#hud{visibility:visible !important}html,body{width:100vw;height:100vh;overflow:hidden}</style>';
writeFileSync('dist/desktop.html', idx.replace('<div id="app"></div>', override + '\n    <div id="app"></div>'));
console.log('desktop.html generated');
