# PTC-CLAY-12 — Unify the Central Jewel-Column (vault -> collar -> crown as one solid form)

## Single visual concern

Gate (a) has failed seven consecutive critics. The three most recent independent reviewers converge on the SAME specific prescription: the central assembly must read as ONE CONTINUOUS SOLID FACETED JEWEL-COLUMN "flowing from the front vault through the collar into the crown mandorla" (critic verbatim). Today the crown region presents as separate stacked pieces — vault jewel, a distinct collar ledge, then the crown mandorla — with a break at the collar that reads as an interruption/portal.

Accepted and do NOT redesign: the four-talon cage (gate b), wings, towers, buttresses, plinth, stairs, footprint, vault frame, entrance doorway, proportions (~11.7 tall on 7.0 footprint), neutral clay. The crown mandorla's convex-faceted language is the right language — it just needs to flow through the collar into the vault without a ledge-step in the silhouette.

## Required change (central column only, in `src/sunweaver-town-center-structural.ts`)

1. **Continuous convex faceted column.** The central element becomes ONE flowing faceted body (either a single geometry, or the vault jewel + collar + mandorla merged with SHARED silhouette edges) from the vault base (~Y 4.45) to the crown apex (~Y 11.7):
   - Max half-width ~1.0-1.1 world around Y 5.5-7.0.
   - The profile tapers CONVEXLY up through the old collar zone (~Y 7.4-8.0) with NO inward step/ledge: the silhouette width at Y 7.6 (old collar springline) must be >= the width at Y 8.2, and the transition is smooth (a convex decreasing curve), not a shelf.
   - The old collar ring becomes a thin RIB/ring set FLUSH against the column's surface (it may read as a subtle band seam but must NOT create a wider ledge or a break in the column outline).
2. **Continuous dominant front ridge.** ONE bright vertical ridge running the full column: from the vault band (~Y 5.2) up through the crown to the finial (~Y 11.5), width ~0.40-0.50 lower tapering toward the top, proud ~0.18-0.22, Faceted per the existing language. Merge the current vault-ridge and crown-mandorla-ridge into this single continuous rib (they must visually join; no gap at the collar zone).
3. **Vault frame + entrance stay as relief.** The outer pointed vault frame remains as a thick relief band ON the lower column (its face may sit slightly proud of the jewel), and the small dark entrance doorway stays at the base (~Y 4.6-5.4, ~1.0 x 0.6). Neither may create a silhouette ledge that breaks the column.
4. **Talon cage unchanged** (gate b): the four bent talons keep hugging the column's upper two-thirds exactly as accepted in CLAY-10/11. Verify AABB checks still pass after the unified body (the column max half-width must not exceed the talon envelop at the wrap bands: keep max half-width <= 1.15 so no poke-through).

## New objective check (must run + report)

**No-shelf check:** from the front ortho, sample the central column's world half-width at Y 6.5, 7.0, 7.6 (old collar), 8.2, 8.8. Requirement: monotonic non-increasing from Y 6.5 to Y 8.8 (allow +0.02 tolerance per step), i.e., NO silhouette widening at the collar band. Print the width table and PASS/FAIL.

## Constraints

- Gate (a) target: one continuous solid faceted jewel-column with a dominant continuous ridge; NO hollow/portal; no collar ledge break.
- Gates (b)(c)(d)(e) must still pass; talon AABB checks + mandorla luminance + vault luminance gates stay PASS.
- 4 of everything; neutral clay #B8B4AC; runtime API/stages unchanged; footprint 7.0; nothing above Y12.2; update manifest honestly.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. crown-geometry-probe.mjs: talon checks + luminance gates + the NEW no-shelf check; report all numbers.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_12_UNIFY_CENTRAL_COLUMN.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-12`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
