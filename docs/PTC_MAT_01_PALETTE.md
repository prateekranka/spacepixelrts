# PTC-MAT-01 — Sunweaver Town Center: palette/material pass on the accepted structural geometry

## Context

The neutral-clay structural baseline (PTC-CLAY-01R → 13) is ACCEPTED as the geometry contract by the orchestrator (gpt-5.6-luna): p99 ~3ms, errors 0, all geometry/luminance gates green, crown reads SOLID and lit, stair gate PASS. The remaining "generic castle" read comes from the uncolored clay. This piece applies the APPROVED reference palette to the geometry WITHOUT changing it.

Approved palette (`references/Sunweaver_TownCenter_Reference_v01/12_materials_2048.png`):
- Ivory stone: #F0E0B6
- Gold/trim: #D9B26E
- Teal/cyan crystal: #7AB591 and #36C9FF (energy)
- Deep blue accent: #1E3A6D

## Scope (ALL in `src/sunweaver-town-center-structural.ts` + viewer + shots)

1. **Add a `palette` pass** (alongside the existing `beauty`/`silhouette`/etc.). `beauty` stays the neutral clay baseline (do not break the 13-round accepted state). `palette` swaps in the colored material set on the SAME geometry, stages, and runtime API. Expose via the existing `pass=` query param and a `setPass(name)` switch on the runtime if not already present.
2. **Material map** (world units / module semantics; keep the clay material classes where they exist):
   - Stone family (#F0E0B6): foundation, plinth tiers + rim lips, lower/upper drums, wings (bases + uppers), side towers (base/shaft), buttresses, stage-2 crown, low-risk large surfaces. Add one or two shade variants (slightly darker #E4D3A0 / shadow #D6C48E) for visual separation; do not re-light the scene.
   - Gold/trim (#D9B26E, with a brighter #E8C98F highlight variant): vault frame + collar frame, entrance collar (sill/nosing/frame base), plinth/stair lips + stair nosings, collar ring ribs, cage talon shoulders near the collar, banner mounts.
   - Crystal/energy (#7AB591 base, #36C9FF emissive, #1E3A6D depth): central jewel-column (vault jewel + crown mandorla + front spine + finial), the four cage talons, side-tower caps, small seam jewel. The central column's crystal must be the brightest/energy element: teal base with a cyan emissive that reads as the reference's glowing energy crystal (emissive intensity tuned so the crown is the focal point but never blown out at the p99 target).
   - Keep flat-shaded where flat shading is present; metals/pbr allowed in Three.js (this is NOT the EEVEE constraint).
3. **Viewer**: `pass=palette` must render the colored set; add palette captures to `scripts/town-center-structural-shots.mjs` (a `palette-front-ortho`, `palette-front-3q`, `palette-top-ortho`, and the 4 stage views from the fixed front-3q camera). Existing clay captures must still be produced (the harness now runs both).
4. **Do NOT touch**: geometry, stages, footprint, runtime API, cameras, `beauty` clay material, `src/sim.ts`, `src/engine.ts`. Preserve all unrelated dirty files. No Flowdeck.

## Verification (all from repo root; all must pass)

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, then `node scripts/town-center-structural-shots.mjs` — 0 console/page errors, no empty/black captures, gameplay-close/normal/far distinct, fresh qa/report.json (BOTH clay and palette captures present). Kill the server after; no leaks.
5. FPS probe on the PALETTE front-3q view: p99 < 8 ms.
6. Report a small color-coherence table: top-6 quantized colors of `palette-front-ortho.png` (should include ivory/teal/cyan/gold families; no raw unlit dark mass dominating).
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_MAT_01_PALETTE.md`, `src/sunweaver-town-center-structural.ts`, `src/town-center-structural-viewer.ts`, `scripts/town-center-structural-shots.mjs`, and capture/report files that must change, prefix `PTC-MAT-01`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
