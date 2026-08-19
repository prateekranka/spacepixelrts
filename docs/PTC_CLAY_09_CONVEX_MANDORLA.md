# PTC-CLAY-09 — Convex Solid Mandorla (kill the dark-center "portal" read)

## Single visual concern

Gate (a) still FAILs (rounds 7-8). Latest diagnostic (Luna, on the current front-ortho capture) is precise: "Inside the crown mandorla, the CENTER is darker than the edges. It reads as a recessed central shadow band spanning one-half to two-thirds of the usable mandorla width, with lighter rims and side facets. The front spine is bright near the top but too narrow and discontinuous, lost against the dark inset." Prescription: "Make the mandorla a shallow CONVEX faceted shell by pushing a broad central plane/ridge forward and leaving only thin side seams for shadow."

Everything else is accepted: gates (b)(c)(d)(e) PASS; proportions 0.7; plinth/drums/vault/wings/towers/talons/collar are done. Do NOT touch them.

## Required change (mandorla + spine only, in `src/sunweaver-town-center-structural.ts`)

Rebuild `crystal_mandorla` so its front surface at every height is CONVEX (bulging toward the viewer, +Z), never concave/waisted, with a broad bright center and only thin side seams in shadow:

1. **Convex faceted body.** Replace the current lathe profile with a strictly convex envelope: the body's half-width rises smoothly from the collar (base half-width ~0.92-0.96 world at Y~7.6) to a max around 35-45% of crown height, then tapers convexly to the apex Y~11.7. No waist, no inward dip anywhere. Keep ~8 facet segments of the FRONT-facing surface and close the rear (the shell stays watertight; rear visibility is irrelevant but must not create holes).
   - Prefer an explicit faceted construction: either (a) a lathe whose profile is a convex arc/almond (radius as function of height is strictly convex-peaked), plus (b) an added broad front ridge; or (c) a convex almond prism extruded along the front bulge. Your choice — the OUTCOME is what matters: from the front, the mandorla center must read LIT and SOLID.
2. **Broad dominant front ridge/spine.** Replace the thin spine with a broad raised central rib-plane: width ~0.40-0.50 world units at mid-crown (i.e., roughly 45-55% of the mandorla's mid width), standing proud ~0.18-0.22 of the surrounding surface, continuous from the collar socket Y~7.65 to the finial, tapering with the almond. It must read as a solid lit ridge, not a seam.
3. **Objective luminance gate (NEW — run AND report this):** after capturing `beauty-front-ortho.png`, probe the mandorla region. At two heights (roughly 25% and 55% of the mandorla's own height above the collar) sample: the center-column mean luminance (the spine/central ridge) and the mean luminance of the two side columns ~half-way out to the mandorla edge. REQUIRE: center mean >= side-mean - 2 (in 0-255 gray) at both heights — i.e., the center must NOT be darker than the edges (no dark inner band). Extend `scripts/crown-geometry-probe.mjs` (or add a small luminance probe) to compute this on the captured PNG and print PASS/FAIL numbers.

## Constraints

- Gate (a) target: "broad faceted central mandorla, clearly tallest, dominant front center spine, reads SOLID not hollow".
- Gates (b)(c)(d)(e) unchanged and must still pass; talon cage must still wrap the mandorla (re-run the AABB checks; if the new convex body pokes through the talon orbit/apex-band, keep the mandorla within the accepted envelope: base half-width ~0.95, apex-band radius 0.4, max radius 1.9).
- 4 talons / 4 towers / 4 buttresses / 4 wings unchanged. Neutral clay #B8B4AC flat-shaded; runtime API unchanged; stages unchanged; footprint 7.0; nothing above Y12.2.
- Update the manifest honestly (mandorla construction, spine width).

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. Re-run the crown-geometry talon checks (report numbers) AND the new mandorla luminance gate (report center/side means at both heights).
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_09_CONVEX_MANDORLA.md`, `src/sunweaver-town-center-structural.ts`, `scripts/crown-geometry-probe.mjs` if changed, and capture/report files that must change, prefix `PTC-CLAY-09`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
