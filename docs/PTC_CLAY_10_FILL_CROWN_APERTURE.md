# PTC-CLAY-10 — Fill the Crown Aperture (Mandorla fills the talon cage)

## Single visual concern

Gate (a) has failed four consecutive critics (rounds 7-9). The consistent read: the crown reads as a "hollow/narrow pointed portal" — i.e., a dark void between the two flanking talons / between the mandorla and the cage. The round-9 luminance probe PROVES the mandorla alone is now bright-centered with a broad ridge (convex fix landed). Therefore the residual "portal/void" comes from the SPACE around the mandorla: the mandorla is too narrow (max half-width ~0.95) for the talon cage (orbit ~1.76), leaving a ~0.6-0.8 world dark gap on each flank in the front view.

Reference proportions (approved pack): the crown's "framed crystal envelope" is a solid mass that fills the cage; the four prongs hug the central vault, sweeping over it — there is no dark aperture between crystal and prongs.

Everything else is accepted: gates (b)(c)(d)(e)' underlying geometry; proportions; vault; plinth; wings; towers; collar. Do NOT touch their designs. Only the mandorla/cage size relationship changes.

## Required change (crown proportions only, in `src/sunweaver-town-center-structural.ts`)

1. **Broaden the mandorla to fill the cage interior.** Increase the mandorla's max half-width from ~0.945 world to ~1.12-1.18 world (profile peak, ~35-45% up the crown). Keep the convex faceted shell + dominant front ridge from CLAY-09 (do not undo). Base half-width ~0.95-1.0 at the collar; convex taper to apex Y~11.7.
2. **Bring the four talons IN to hug the broadened mandorla.** Keep the accepted bent-talon design, yaw/cant, foot flares, and count=4, but reduce the talon ORBIT so the talons wrap close around the new mandorla surface (target orbit ~1.15-1.35 world at the body band; body radius >= mandorla max half-width so the mandorla does not poke through). Feet still flare outward to sit on the collar rim (~r2.05); talon max radius (base) stays <= 1.9; apex-band keeps small (<=0.35). The front view must show four ribs sweeping tightly over a SOLID vault with only thin seam shadows between them — NO large flat dark gap on either flank.
3. **Apex envelope sanity**: mandorla max half-width (1.15) must be <= talon body orbit + talon half-depth; verify with the AABB probe (no poke-through). If the cage needs to sit ON the mandorla's surface slightly, that is correct (reference prongs rest on the crystal) — but the mandorla must not visibly cross outside the talon cage silhouette in the front view.

## Constraints

- Gate (a) target: one broad, solid, convex, faceted central vault with a dominant front ridge, NOT a pointed arch with a dark opening.
- Gates (b)(c)(d)(e) must still pass; talon AABB checks (x-overlap >= 60% of talon height, face angle >= 25 deg) must stay PASS.
- 4 talons / 4 towers / 4 buttresses / 4 wings; neutral clay #B8B4AC; runtime API/stages unchanged; footprint 7.0; nothing above Y12.2; collar stays ~r2.05. Update manifest honestly.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. Re-run crown-geometry-probe.mjs: talon checks (PASS) + luminance gate (PASS) + NEW poke-through check (mandorla max half-width <= talon orbit + talon half-depth at the same band) — report all numbers.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_10_FILL_CROWN_APERTURE.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-10`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
