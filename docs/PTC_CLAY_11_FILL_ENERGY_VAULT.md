# PTC-CLAY-11 — Fill the Energy-Vault (kill the "hollow Gothic portal")

## Single visual concern

Gate (a) has failed five consecutive critics (rounds 7-10), and the two most recent independent reviewers BOTH name the exact same phenomenon: "the central focal mass reads as a hollow Gothic portal, not a tall uninterrupted solid convex mandorla." Diagnosis (orchestrator): the crown mandorla is now provably solid (convex + filled + bright-center luminance gate). The remaining dark pointed "portal" is the ROUND-7 ENERGY-VAULT: a 3.0×3.0 pointed arch frame with a 2.6×1.8 RECESSED DARK OPENING (depth 0.45) at the building's front center — literally a gothic arch with a black hole. The reference's vault opening is the BRIGHT SOLID faceted almond energy-jewel (blue in the reference), not a dark void.

Everything else is accepted: crown mandorla + ridge + talon cage (CLAY-09/10), wings, towers, plinth, stairs, collar, proportions. Do NOT touch them.

## Required change (energy-vault only, in `src/sunweaver-town-center-structural.ts`)

1. **Fill the vault opening with a SOLID convex faceted almond jewel.** Replace the vault's recessed dark interior (the 2.6×1.8 opening + depth-0.45 recess + inner almond + seam jewel) with ONE continuous solid faceted form that FILLS the vault frame:
   - Outer vault frame stays (thick pointed-arch frame, ~0.35-0.4, interior opening ~2.6 tall × 1.8 wide at Y ~4.4-7.4).
   - The opening is filled by a solid CONVEX faceted almond jewel: ~2.4-2.6 tall × ~1.7-1.9 wide, bulging toward +Z (bright), faceted in the SAME language as the crown mandorla (convex, ~8 segments, flat-shaded, reads lit). The jewel's surface should be at or slightly P ROU D of the frame plane (z-forward), so no dark recess is visible behind it from the front.
   - Keep a small recessed doorway at the vault's BASE (~Y 4.6-5.4, ~1.0 wide × 0.6 tall) — the reference's actual small dark entrance. It must stay clearly SUBORDINATE (no tall void).
2. **No dark aperture.** From the front ortho, the vault region must read as bright solid clay with only the small base doorway darker. The pointy dark opening is banned.
3. **Objective vault-luminance gate (extend the probe):** on the front-ortho capture, measure the mean luma in the vault opening band (the jewel area, roughly Y 5.6-6.9 world / middle of the vault) at the center column. REQUIRE: vault-jewel center mean luma >= 100 (clay #B8B4AC is ~166 gray; background gray ~136; a dark void would be far below). Also require the jewel band mean > background gray by +8. Print the numbers.

## Constraints

- Gate (a) target: the central column reads as ONE tall solid faceted energy form (vault jewel -> collar -> crown mandorla), no hollow pointed portal anywhere.
- Gates (b)(c)(d)(e) must still pass. Crown + talon AABB/luminance checks must stay PASS (do not remove the seam jewel if it helps; if kept, keep it small and on the jewel surface).
- 4 of everything; neutral clay #B8B4AC; runtime API stages unchanged; footprint 7.0; nothing above Y12.2; update manifest honestly.

## Verification

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vite build --config vite.structural.config.ts`
4. Structural vite server on 5174 (background), curl 200, `node scripts/town-center-structural-shots.mjs` — 0 errors, no black/empty, gameplay distinct, fresh qa/report.json. Kill server after.
5. FPS probe on front-3q beauty view: p99 < 8 ms.
6. Re-run crown-geometry-probe.mjs (talon checks, luminance gate) AND the new vault-jewel luminance gate; report all numbers.
7. Fresh qa/report.json integrity; no rear stair; footprint 7.0; errors [].

## Commit

Commit only `docs/PTC_CLAY_11_FILL_ENERGY_VAULT.md`, `src/sunweaver-town-center-structural.ts`, and capture/report files that must change, prefix `PTC-CLAY-11`. No unrelated files. Do not touch `src/sim.ts` / `src/engine.ts`. Do not self-approve visually.
