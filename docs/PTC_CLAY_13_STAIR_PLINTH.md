# PTC-CLAY-13 — South Stair + Plinth Legibility (kill the "blank conical plinth")

## Single visual concern

The crown gate (a) now PASSES (unified lit jewel-column, round 12). The remaining grounded gap (critic on the post-light frames): gate (d) — "the lower south/front assembly is a blank TWO-TIER CONICAL PLINTH; it lacks the broad stepped stair and entrance-collar hierarchy." The plinth reads as a smooth cone in the front view, not as architecture; the south stair does not read as a broad stepped flight. Related: gate (c) "wing lobes unclear" — the wings sit just above the plinth and the flat dark plinth swallows them.

Do not touch the crown, talon cage, vault jewel, upper drums, towers, or proportions. This round is the BASE/front assembly only.

## Required change (base + plinth + stair only, in `src/sunweaver-town-center-structural.ts`)

1. **Plinth tiers read as steps, not a cone.** Give each of the two plinth tiers a clear architectural rim lip: thin raised edge rings at the top of tier-1 (Y≈1.8) and tier-2 (Y≈3.3), each ring standing ~0.12-0.18 proud and extending slightly wider than the tier body below it (a proper step nosing). Increase the tier taper so the silhouette shows distinct step shelves (tier-1 outer r 3.5 top r 3.15; tier-2 outer r 3.25 top r 2.75), creating a visible two-step pyramid-of-base rather than a single cone.
2. **Broad south stair reads as a stepped flight.** On the south face, replace/host a broad stepped flight from the ground up to the plinth top landing: total stair width ~4.2-4.6 units (broad), tread depth ~0.32-0.38, riser ~0.22-0.26, so it reaches the tier-2 top (Y≈3.3) and lands on a visible platform in front of the entrance. The stair must occupy a clearly visible wedge of the front silhouette (bright lit treads, visible side edges) — NOT blend into the plinth face. Keep exactly ONE stair, no rear stair.
3. **Entrance-collar hierarchy.** At the plinth-top landing, make the entrance read clearly: the vault frame's base + the small dark doorway plus flanking steps/nosing must read as a coherent entrance collar (entry steps fanning to the frame base). The small doorway stays ~1.0 x 0.6 and subordinate, but aligned with the stair centerline.
4. **Wing legibility.** Do not redesign the wings. After the plinth/light changes, VERIFY the four wings still read as distinct radial lobes above the plinth (they sit at wing-base Y≈3.9). If the tall bright plinth still obscures them, allow adding a thin horizontal ledge/skirting band on the inner face of each wing where it meets the plinth (small chamfer ~0.1) — placement only, no redesign. Report whether wings read as lobes in the front view.

## Constraints

- Gate (a) unified column + (b) talon cage + (e) footprint/collar must STILL pass — do not touch crown/vault/talons.
- Gates (c) wings and (d) stair must pass this round (targets: four clear radial lobes with gaps vs diagonal towers; ONE broad stepped south stair, no rear stair).
- 4 of everything; neutral clay #B8B4AC; runtime API/stages unchanged; footprint 7.0; plinth stays within the building footprint (max r 3.5); nothing above Y12.2; update manifest honestly.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. crown-geometry-probe.mjs: talon checks + luminance gates + no-shelf check stay PASS; ALSO run a new stair-read check if feasible (count lit treads in the south stair wedge on the front capture; report the count and the stair wedge's vertical extent vs the plinth).
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_13_STAIR_PLINTH.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-13`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
