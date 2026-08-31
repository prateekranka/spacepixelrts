# SPX-20 Forge Review critic repair — round 3

Status: LOCKED ROUND SPEC

Card: `t_255339ba`
Source verdict: `/home/bobbyranka/workspace/evidence/starhaven-kanban/t_255339ba/20/20260831T020226Z/critic-round2-verdict.md`

## Goal

Close the round-2 single largest gap. Guidance targeting must not impersonate selection. The proof clip must end with one legally selected scout, matching player HUD and workbench readback, plus a visible path produced through the existing player command path.

## Root cause

The gold circular `#guidance-target` marks the next tutorial subject. It is not a selected entity. Its circular ring and bare `WORKER` label reuse selection language, so the truthful HUD `Nothing selected` and workbench `selected 0` appear false.

## Scope exception

`src/hud.ts` is added for this round only to correct the ambiguous guidance presentation. No command behavior, economy, simulation, balance, or general HUD layout may change.

## Invariants

- `src/sim.ts`, `src/engine.ts`, save state, and map generation remain byte-identical.
- Guidance reads state only. It does not select or command an entity.
- Actual selection continues to use the existing Input set and renderer selection ring.
- The clip may issue a move only through existing player-facing selection, command-button, and game-canvas input paths. It may not write an order, path, target, entity, or world field directly.
- Review remains development-only. Production isolation stays green.

## Required behavior

1. Guidance marker
   - Replace the circular ring with a non-circular guide reticle, such as four corner brackets or a diamond frame.
   - Prefix its label with `GUIDE ·` so `GUIDE · WORKER` cannot be read as selected-unit identity.
   - Preserve off-screen guidance behavior and the current target source.
2. Clip
   - Select the deterministic scout with the existing Forge selection helper.
   - Invoke MOVE through the rendered player command button, then click valid game-canvas ground through the existing pointer input path while frozen.
   - Verify selection count is one and the selected entity is the scout before stepping.
   - Step exactly 37 ticks, set tactical-close, enable paths, and capture the final identity as before.
   - Verify a screenshot of the final clip state contains a material count of path-color pixels. Persist the count in `clipReadback`; fail below the calibrated visible threshold.
   - Final panel readback must show one selected entity, not zero.
3. Evidence
   - Focused opening pack at seed 424242, original 1366×1024 source frames, and 1 fps clip contact.
   - Include a focused still that shows both the guide marker and real scout selection so their visual languages can be judged together.

## Non-goals

Do not fix route scenario differentiation or the TECHNOLOGY PATH command-strip overflow in this round. Those remain candidates for the next fresh critic after the largest gap closes.

## Acceptance

- Strict Forge typecheck, build, Forge tests, M0, and 29 browser gates pass.
- Protected hashes and production marker scan pass.
- Focused manifest is clean-commit, valid, and error-free.
- Clip readback proves: seed match, frozen, tick delta 37, tactical-close, paths on, captured pane, selection count 1, scout selected, and visible path-color pixels.
- First and last clip frames are lit. The final source frame visibly agrees across guide marker, selected scout, player HUD, and workbench.
- A fresh Grok 4.6 XHigh critic supplies the verdict.
