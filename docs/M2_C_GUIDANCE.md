# M2-C — Contextual opening guidance

Status: **ACTIVE IMPLEMENTATION CONTRACT**

Read `docs/M2_OPENING_SCOUTING.md` first.

## Goal

Teach the first scouting action through compact, non-blocking hints driven by real game state.

## Exact text and states

1. No player scout selected:
   - `Select your scout`
2. Player scout selected; Central Lumen field not discovered:
   - `Explore the nearby signal`
3. Central Lumen field discovered:
   - `A shared Lumen field has been discovered`
   - `The enemy may contest this location`

The final state uses two stacked lines so timing does not hide either required message.

## State source

Create a pure evaluator in `src/opening-guidance.ts`.

- Selection comes from the real `Input.selected` ids.
- The selected entity must be an alive team-0 `Kind.Scout`.
- Discovery comes from the `central-lumen-field` landmark player bit.
- No independent boolean can claim progress.
- Same world/selection state always returns the same message.
- Fog-off matches may enter the final state immediately because the objective is already known.

## Presentation

Add one pointer-transparent HUD prompt beneath the top resource bar.

- 4:3 landscape first.
- Safe-area aware.
- Maximum width 460 px.
- Clear at normal iPad distance.
- Does not cover the center reticle, minimap, unit card, or command deck.
- No close button, Next button, modal, dimmer, or input capture.
- Hide with the rest of the HUD for UI-free evidence.
- Use the existing palette and pixel-frame language.
- Update DOM text only when the guidance id changes.
- `select-scout` adds a small pointer-transparent bracket over the real player scout.
- `explore-signal` adds a small `SIGNAL` bracket at the real landmark projection; clamp it to the
  safe viewport edge when the objective is off-screen.
- `objective-found` removes the target bracket because the discovered world marker and minimap beacon
  now carry the state.
- No pulsing, animation, beam, or large arrow is part of this milestone.

## Deterministic verification

Add `tests/m2-guidance.test.ts`:

- reset gives `select-scout`;
- selecting a worker does not advance;
- selecting the player scout gives `explore-signal`;
- setting the Central Lumen player discovery bit gives `objective-found` with both exact lines;
- reset restores the first state.

Add `scripts/qa-m2-guidance.mjs` and `qa:m2-guidance`:

- private Vite port and 1366 × 1024;
- frozen `?qa=opening` route;
- capture `guidance-select-scout.png`;
- click the real Scout HUD control and capture `guidance-explore-signal.png`;
- teleport the selected scout to the central Solar objective, call one public `world.step()`, center the camera,
  assert both final lines, and capture `guidance-objective-found.png`;
- p99 < 8 ms, console/page errors 0, non-black PNGs, absolute external evidence, reliable cleanup.

## Non-goals

- no tutorial modal;
- no voice-over;
- no building/economy guidance yet;
- no AI change;
- no prompt timers;
- no VFX pass;
- no gameplay balance change.

## Acceptance

```text
npm run test:m0
npm run test:m2
npm run build
npm run qa:m2-guidance -- --out=<absolute external evidence path>
npm run qa:m2-opening -- --out=<absolute external evidence path>/opening-regression
npm run qa:m2-discovery -- --out=<absolute external evidence path>/discovery-regression
npm run qa:m1 -- --out=<absolute external evidence path>/m1-regression
npm run qa:m0 -- --viewport=1366x1024 --orientations=landscape-left,landscape-right --seed=0x5eed --out=<absolute external evidence path>/m0-regression
```

Atomic commit:

```text
feat: add contextual opening guidance
```
