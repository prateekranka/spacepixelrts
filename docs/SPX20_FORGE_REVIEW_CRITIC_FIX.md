# SPX-20 Forge Review critic repair — round 2

Status: LOCKED ROUND SPEC

Card: `t_255339ba`
Source verdict: `/home/bobbyranka/workspace/evidence/starhaven-kanban/t_255339ba/20/20260830T235424Z/critic-round1-verdict.md`

## Goal

Close the critic's single largest gap. The proof clip must show one complete, truthful control sequence with no black lead-in. Improve the two sparse spatial diagnostics and make each display-only perspective identifiable in the captured frame.

## Non-goals for this wave

Do not change route scenario semantics, simulation setup, player HUD layout, game balance, saved state, input commands, or shipped art. The critic must judge those remaining findings again after this largest-gap repair.

## Invariants

- `src/sim.ts` and `src/engine.ts` remain byte-identical.
- Review controls remain development-only behind `import.meta.env.DEV && ?forge=1`.
- Freeze and bounded step remain the only simulation-time controls.
- Perspective, fog, camera, overlay, UI, and snapshot controls remain display-only or read-only.
- The production build contains no Forge module, marker, UI, or exact review specifier string.
- The capture uses one live game canvas. Contact sheets contain frozen PNG or decoded WebM frames only.

## Required changes

1. Proof clip
   - Hold a lit, loaded workbench frame before the first retained video frame.
   - Trim browser-load and game-only lead-in from the final WebM.
   - Show frozen seed identity, a bounded `+37` step with tick readback, `tactical-close`, `paths` checked with a visible world cue, and a final `SNAPSHOT CELL` readback in the frozen-pane strip.
   - Keep the final overlay and snapshot state visible for at least two seconds.
   - Fail `--clip` if trim or final readback verification fails.
2. Sparse diagnostics
   - Paths: retain the exact read-only route, but add high-contrast waypoint markers so the route is legible at 1366×1024.
   - Facing: use a unique high-contrast color, longer shaft, and arrowhead derived only from the existing facing value.
   - No inferred or invented path points.
3. Perspectives
   - Add an in-frame development-only chip naming `PLAYER KNOWLEDGE`, `RIVAL KNOWLEDGE`, or `OMNISCIENT`.
   - Increase review-mode fog contrast only. Do not alter visibility or explored arrays.
4. Selected scout proof
   - Frame the selected scout at tactical-close in the selected-scout evidence cell. Do not change selection truth.

## Acceptance

- Strict Forge typecheck, Forge tests, build, M0 tests, and 29 browser QA checks pass.
- Emitted production assets contain none of the frozen review marker/specifier strings.
- A full 40-cell seed-`424242` proof pack validates with empty error arrays.
- `overlay-paths` and `overlay-facing` have materially stronger visible cue counts than round 1 (`15` and `22`) and are semantically readable in their original PNGs.
- The three perspective cells remain at one tick and camera. Each carries the correct chip and has an obvious world-region difference without changing world knowledge.
- A one-frame-per-second contact from the final WebM starts on a lit Forge panel, visibly includes the overlay toggle, and ends with a captured-cell readback.
- A fresh Grok 4.6 XHigh critic supplies the visual verdict. Builder self-review is not approval.
