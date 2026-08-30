// Forge Review Deck — proof-pack artifact writers (console.txt, critic brief).
import fs from 'node:fs';

/** Post-board artifact write order; console.txt must follow clip when --clip is set. */
export const CAPTURE_WRITE_ORDER = ['board', 'clip', 'console', 'critic-brief'];

/**
 * Build console.txt lines from per-cell logs plus optional clip entries.
 * Clip entries use a `clip` cell prefix and stable seq ordering after route logs.
 */
export function buildConsoleTxt(manifest, clipConsole = []) {
  const allConsole = [];
  for (const group of [manifest.pack.routes, manifest.pack.extras, manifest.pack.perspectives]) {
    for (const cell of group) {
      for (const entry of cell.allConsole ?? []) {
        allConsole.push({ cell: cell.id, seq: entry.seq ?? 0, type: entry.type, text: entry.text });
      }
    }
  }
  for (const entry of clipConsole) {
    allConsole.push({
      cell: 'clip',
      seq: entry.seq ?? 0,
      type: entry.type,
      text: entry.text,
    });
  }
  allConsole.sort((a, b) => a.seq - b.seq);
  const lines = allConsole.map((e) => `${e.cell} [${e.type}] ${e.text}`);
  if (lines.length === 0) lines.push('(no console messages captured)');
  return `${lines.join('\n')}\n`;
}

export function composeCriticBrief({
  manifest,
  gateP99,
  renderer,
  softwareRenderer,
  routes,
  orientations,
  totalRouteCount = 13,
}) {
  const cells = [
    ...manifest.pack.routes,
    ...manifest.pack.extras,
    ...manifest.pack.perspectives,
  ];
  const gateCounts = new Map();
  for (const cell of cells) {
    for (const gate of cell.gates) {
      const name = gate.split(' ')[0].split(':')[0];
      gateCounts.set(name, (gateCounts.get(name) ?? 0) + 1);
    }
  }
  const capturedRoutes = [...new Set(manifest.pack.routes.map((cell) => cell.id))];
  const routeNames = capturedRoutes.join(', ');
  const lines = [];
  lines.push('STARHAVEN FORGE REVIEW — CRITIC BRIEF');
  lines.push('====================================');
  lines.push('');
  lines.push(`Tool: ${manifest.tool}  schema ${manifest.schemaVersion}`);
  lines.push(`Started: ${manifest.startedAt}  Finished: ${manifest.finishedAt}`);
  lines.push(`Git: ${manifest.git.branch} @ ${manifest.git.commit}${manifest.git.dirty ? ' (dirty)' : ''}`);
  lines.push(`Seed requested: ${manifest.requestedSeed}  Seed actual: ${manifest.actualSeed}`);
  lines.push(`Viewport: ${manifest.viewport.width}x${manifest.viewport.height} deviceScaleFactor ${manifest.viewport.deviceScaleFactor}`);
  lines.push(`Routes captured: ${manifest.pack.routes.length}  Extras: ${manifest.pack.extras.length}  Perspectives: ${manifest.pack.perspectives.length}`);
  lines.push(`WebGL renderer: ${renderer || '(unavailable)'}`);
  lines.push(`softwareRenderer: ${softwareRenderer} — this Linux host typically runs SwiftShader software WebGL (~20fps); treat numbers here as context, not target verdicts.`);
  lines.push('');
  lines.push('PACK CONTENTS');
  lines.push(`  cells/: ${cells.length} PNG captures (1366x1024 each)`);
  for (const cell of manifest.pack.routes) {
    lines.push(
      `    route ${cell.id} ${cell.orientation} — state ${cell.actualState} tick ${cell.tick} pal ${cell.image ? Math.round(cell.image.paletteAdherence * 100) : '?'}% ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join(' | ')}]` : ''}`,
    );
  }
  for (const cell of manifest.pack.extras) {
    lines.push(`    extra ${cell.id} — ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join(' | ')}]` : ''}`);
  }
  const overlayCells = manifest.pack.extras.filter((cell) => cell.id.startsWith('overlay-'));
  if (overlayCells.length) {
    lines.push(`  overlay evidence cells: ${overlayCells.length}`);
    for (const cell of overlayCells) {
      lines.push(
        `    ${cell.id} — overlay readback=${JSON.stringify(cell.overlays)} hits=${cell.overlayColorHits ?? 'n/a'} ok=${cell.ok}`,
      );
    }
  }
  for (const cell of manifest.pack.perspectives) {
    lines.push(
      `    perspective ${cell.id} — ok=${cell.ok}${cell.gates.length ? ` gates=[${cell.gates.join(' | ')}]` : ''}`,
    );
  }
  lines.push(`  board.png — labeled contact board (failed cells red-labeled)`);
  lines.push(`  console.txt — all console output + page errors, prefixed per cell`);
  lines.push(`  critic-brief.txt — this file`);
  if (manifest.pack.clip) {
    const clipSize = fs.existsSync(manifest.pack.clip) ? fs.statSync(manifest.pack.clip).size : 0;
    lines.push(`  proof.webm — short recorded sequence (${clipSize} bytes)`);
  } else if (manifest.args?.clip === true) {
    lines.push('  proof.webm — MISSING (args.clip=true)');
  }
  lines.push('');
  lines.push('OBJECTIVE GATES RUN BY THE BUILDER (results only, no verdicts)');
  lines.push(`  requested seed ${manifest.requestedSeed} vs actual seed ${manifest.actualSeed} (equality is a hard gate)`);
  lines.push(`  expectedState == actualState on every route cell`);
  lines.push(`  screenshot exists, exact 1366x1024, not black, not empty`);
  lines.push(`  zero console/page errors per cell`);
  lines.push(`  paletteAdherence >= 0.35 (share of sampled pixels within 40 RGB units of a palette token)`);
  lines.push(`  gameWorkP99Ms (probe ring) and rafP99Ms (rAF spacing) recorded separately, never conflated`);
  if (gateP99 != null) lines.push(`  absolute budget enforced: gameWorkP99Ms < ${gateP99}ms (--gate-p99)`);
  else lines.push(`  no absolute perf budget enforced (--gate-p99 not passed)`);
  if (gateCounts.size) {
    lines.push('  gate tallies:');
    for (const [name, count] of [...gateCounts.entries()].sort()) lines.push(`    ${name}: ${count}`);
  } else {
    lines.push('  gate tallies: none (all cells passed their gates)');
  }
  if (manifest.failures.length) {
    lines.push('  run-level failures:');
    for (const f of manifest.failures) lines.push(`    - ${f}`);
  }
  lines.push('');
  lines.push('QUESTIONS FOR THE FRESH CRITIC');
  if (capturedRoutes.length === totalRouteCount) {
    lines.push(
      `  1. Does the shared palette read coherently across all ${totalRouteCount} states (menu -> victory/results)?`,
    );
  } else {
    lines.push(
      `  1. Does the shared palette read coherently across the ${capturedRoutes.length} captured route(s): ${routeNames}?`,
    );
  }
  lines.push('  2. Do the faction identities (sunweaver vs gravemark) read correctly in midgame and battle cells?');
  lines.push('  3. At 1366x1024, does the HUD occlude critical action in any state?');
  lines.push('  4. Do the extras (selected scout, tactical-close, strategic-far, ui-free) communicate camera and selection intent?');
  lines.push('  5. Are there any visual artifacts, z-fighting, or clipping issues visible in the captures?');
  lines.push('  6. (If perspectives present) Do player/rival/omniscient views differ as expected at the same tick?');
  lines.push('');
  lines.push('NOTE: this brief intentionally contains no builder visual verdicts; visual judgment is deferred to you.');
  lines.push('');
  return lines.join('\n');
}
