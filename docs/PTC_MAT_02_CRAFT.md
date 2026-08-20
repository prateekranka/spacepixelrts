# PTC-MAT-02 — Material craft: layered gold, stone depth, crystal focal hierarchy

## Single visual concern

The palette is applied (PTC-MAT-01, committed) but the blind critic returned FAIL (overall 0.56, material execution 0.53): "the candidate's blocky, low-detail architecture and FLAT materials do not reproduce the reference's ornate radial construction, LAYERED GOLD TRIM, and GLOWING CYAN CRYSTAL focal hierarchy." This round is the MATERIAL CRAFT pass — no geometry changes.

Approved palette remains: stone #F0E0B6, gold #D9B26E, crystal #7AB591/#36C9FF, deep blue #1E3A6D.

## Required change (material assignment/detail only, in `src/sunweaver-town-center-structural.ts`)

Keep the PTC-MAT-01 mechanism (`palette` pass, per-mesh `userData.paletteMaterial`, beauty clay default, viewer pass switch). Improve the CRAFT of the palette set:

1. **Layered gold trim (the biggest flagged gap).** Add gold BANDING to the stone body of the reference rhythm:
   - Lower + upper drums: 2 thin gold horizontal bands each (narrow torus/ring strips, ~0.04-0.06 high, flush or 0.02 proud) at the top and bottom quarters of each drum, matching the drum radius. THE drums must read "layered gold", not one gold collar.
   - Wings (each of the 4): a thin gold edge strip along the arch/recessed frame of the wing (the existing wing pointed-arch frame becomes gold-trimmed; keep the stone shell).
   - Vault frame: gold INNER edge on the pointed-arch frame (a thin gold band just inside the arch opening), plus the existing gold outer — two gold lines framing the ivory.
   - Talons: a thin gold base ring where each talon foot meets the collar (the existing shoulder can be a stronger gold band).
   - Collar ribs + plinth/stair lips already gold: keep, and make the stair lip and landing lip distinctly gold.
2. **Stone depth (kill the flat read).**
   - Add a subtle two-tone to the big stone surfaces: a somewhat darker stone variant (#E3D09C) for the lower band / recessed faces (wing recesses, drum bottom quarters, vault interior behind the jewel), and the bright ivory #F0E0B6 for sun-facing upper faces. This is material assignment on existing geometry — no new geometry.
   - Add thin horizontal stone COURSE lines on the drums: 2-3 faint darker hairline bands (slightly darker ivory, ~0.02 high) so large surfaces read as masonry, not a flat cylinder.
3. **Crystal focal hierarchy (make the crown unmistakably the energy center).**
   - Increase the central column's emissive presence: crown mandorla + front spine + vault jewel use a cyan base (#7AB591) with a stronger cyan emissive (#36C9FF) — emissive intensity tuned so the crown visibly glows against the stone but never clips harshly (target: crown center reads clearly brighter than the grey surroundings; keep p99 < 8ms; 1.5-2.2x current emissive is the starting band).
   - Give the crystal depth with the deep blue (#1E3A6D): interior/rear faces of the mandorla facets and the talon inner sides get a deep-blue tint (shade variant), so the cyan front reads volumetric, not flat.
4. **Do NOT touch**: geometry, stages, footprint, runtime API, cameras, the `beauty` clay default, `src/sim.ts`, `src/engine.ts`. No Flowdeck.

## Verification (repo root; all must pass)

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 console/page errors, no empty/black captures, gameplay distinct, fresh qa/report.json (clay + palette captures). Kill server after; no leaks.
5. FPS probe on the PALETTE front-3q view: p99 < 8 ms (emissive cost allowed but bounded).
6. Color-coherence table of palette-front-ortho.png: top-6 quantized colors must now include an ivory/gold family and a teal/cyan family; the cyan crown center must be in the palette.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_MAT_02_CRAFT.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-MAT-02`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually (a blind critic judges the render).
