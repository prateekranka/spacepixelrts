# PTC-CLAY-08 — Restore Central-Body Hierarchy (Solid Faceted Vault + Lower Towers)

## Single visual concern

Round 7: overall still 0.60; proportions layer fixed (0.7). Gate (a) REGRESSED. Critic verbatim: "The central mandorla still reads as a hollow pointed portal, not a broad, tall, solid faceted energy vault with a dominant front spine. The side towers also approach its height, weakening central hierarchy."

The round-7 crown scale (1.35x) made the mandorla tall and narrow with subtle facets — in flat clay that reads as an arched/portal opening. And the towers that were re-mounted on the taller upper drum now reach near the crown's lower body.

Do NOT touch the now-passing gates (b) talon cage, (c) wings, (d) stair, (e) footprint/collar. Do NOT redesign the bent-talon cage, wings, plinth, stair, vault, or collar. Do NOT change total height targets (crown apex ~11.7). This round fixes TWO things only: mandorla solidity/presence, and side-tower subordination.

## Required change (all in `src/sunweaver-town-center-structural.ts`)

### 1. Mandorla: solid faceted vault read (fix "hollow portal")
- Broaden the mandorla base below the spine: base half-width from ~0.74 to ~0.92-0.96 (in world units at the collar springline ~Y7.6), so it reads as a BULKY solid vault, not an oval opening. Apex stays ~Y11.7 (unchanged), so the mandorla gets a broader, more substantial lower third.
- Deepen the facet ridges so flat-shaded clay shows clear planar facets (keep 8 segments; make each facet's angular change larger — the silhouette must read faceted, not smooth).
- Front center spine: make it a DOMINANT feature — width from ~0.12-scaled (~0.16) to ~0.22, proud of the surface ~0.18 (from 0.13), running continuously from the collar socket at Y~7.65 up to the finial. It must read as a raised central rib band (solid), reinforcing the solid-vault read. Add a slight knuckle/band near Y 8.6 if it strengthens the rib read (caution: keep it thin and flush-ish; do not create a new greeble).
- Keep tail: the four talon apex-band currently max radius 0.4; the mandorla broadens at the BASE (not apex), so talons still wrap the upper two-thirds. Re-run the AABB checks to confirm the interlock still reads after broadening (talon x-overlap of mandorla >= 60% of talon height, face angle >= 25 deg).

### 2. Side towers: clearly subordinate (fix "approach its height")
- Keep the tower design and diagonal placement and 4-count. Reduce total tower height so tower tops land at or below ~Y8.0-8.2, clearly beneath the mandorla's body (mandorla base ~Y7.6, mid-body ~Y9.6). Suggestions (pick what keeps the design): scale the tower source ~0.82-0.9 and/or lower the mount base to ~Y5.7-5.9. The interleaved 8-fold secondary buttresses stay below the towers (tops clearly beneath tower tops).
- The front view must show: one clear tall central crown (mandorla + talon cage), with towers peaking roughly at the crown's collar-to-lower-body zone, NOT at its mid-body.

## Constraints

- Gates (b)(c)(d)(e) must still pass; gate (a) must pass again: "broad faceted central mandorla, tallest element, visible dominant front center spine".
- 4 towers, 4 buttresses, 4 talons, 4 wings unchanged in count/placement grammar.
- Nothing beyond footprint radius 3.5; nothing above Y12.2; neutral clay #B8B4AC; runtime API unchanged; stages unchanged; update manifest honestly (mandorla base half-width, spine dims, tower mount/scale).

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. Re-run `scripts/crown-geometry-probe.mjs` and report the talon checks (x-overlap fraction, face angle) — must stay PASS.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_08_SOLID_VAULT_HIERARCHY.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-08`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
