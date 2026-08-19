# PTC-CLAY-01R — Recover the Terminated Structural Builder

## Evidence

Partial implementation exists in the five files listed by `PTC_CLAY_REBUILD_V01.md`.
The actual live render is `critic/out/town-center-structural-v01/beauty-front-ortho.png`.

The partial build is not accepted.

## Proven failures

1. TypeScript fails because `resize()` uses nullable `host` instead of narrowed `viewerHost`.
2. The crown cage floats too high and the fixed camera clips its top.
3. The front primary-wing box blocks the entrance arch.
4. The broad front stair is missing.
5. Lower/upper drums dominate; four wing lobes do not read as the primary silhouette.
6. Orthographic gameplay close/normal/far cameras produce the same apparent scale.
7. Stage-2 temporary crown floats above the lower drum.
8. Factory state (`clay`, `parts`, `pickables`) is module-global and unsafe for multiple instances.
9. The structural HTML triggers a 404, likely the favicon, and the capture harness correctly fails.
10. No stage contact sheet is produced.

## Required recovery

### Runtime safety

- Move clay material, `parts`, and `pickables` into the factory instance.
- Do not add hidden source meshes to the root. Keep source groups local, clone from them, and record source IDs in manifest/userData.
- Preserve shared geometry/material references across clones.
- Dispose each unique geometry/material once.

### Macro silhouette

- Reduce drum radii enough that all four primary wings project as obvious lobes in top/front/side views.
- Move wing centers outward while keeping the 7-unit footprint.
- Replace the solid front-facing wing box with a wing shell that has a real pointed facade opening/frame and side masses. The south copy must leave the entrance visible.
- Keep exactly four primary wings and four side towers.
- Place side towers on diagonal axes. Offset secondary buttresses to the interleaved 8-fold rhythm so they do not occupy the same centers as towers.

### Entrance and stair

- Add one broad south stair with at least five persistent additive treads.
- Keep no rear stair.
- Move the entrance back wall deep behind the pointed frame. It must not fill the arch opening.
- Use thick side lips/pylons as structural masses. No flat cyan/shield geometry.

### Crown

- Align cage arches around the central faceted volume. The arch bottom must connect to cage base around Y 3.1–3.3, and the cage top must frame—not float above—the crystal.
- Replace the one-ended cylinder crystal with a faceted double-pointed or almond-like clay volume.
- Stage-2 temporary crown must connect to the Stage-2 shell around Y 1.8–2.2.
- Stage-3 crown/cage base must connect to the upper drum.
- Stage-4 final central volume is the only full-height spire.

### Camera and viewer

- Fix TypeScript narrowing.
- Add a data-URI favicon so canonical runs have no 404.
- Give each view a fixed orthographic half-height/zoom. Gameplay close, normal, and far must visibly differ.
- Increase front/side/3Q framing height so the full crown and footprint fit with margin.
- Keep neutral clay and fixed lighting only.

### Capture

- Generate all required captures.
- Build a 2×2 Stage 1–4 contact sheet with no labels inside source frames; filename labels may exist outside frames.
- Fail on browser/page errors, missing runtime, empty image, or identical gameplay-scale captures.

## Verification

Run and pass:

- `npx tsc --noEmit`
- `npm run build`
- `npx vite build --config vite.structural.config.ts`
- correct structural Vite server on port 5174
- `node scripts/town-center-structural-shots.mjs`
- `node scripts/measure.mjs` against the structural viewer

Target: p99 `< 8 ms`; browser errors `0`.

Commit only the five structural files plus `docs/PTC_CLAY_REBUILD_V01.md` and this recovery contract with prefix `PTC-CLAY-01R`.
Do not self-approve visually. Sol and isolated Luna B judge the resulting images.
