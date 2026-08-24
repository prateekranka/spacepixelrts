# VS-5A — Fully Visible Technology Choice

Status: **ACTIVE / FROZEN**. Parent: `docs/VS5_PACING_CLOSURE.md`.

## Loss

Fresh Sol blind gate failed only frame 3:

> The Sky Dominion card is clipped by the bottom edge, breaking the fully visible two-path choice.

At 1366×1024, `#bottom` is 112px high. Each `.choice` is at least 88px and spans all command
columns. Two full-width rows plus the gap cannot fit. This is structural; text tuning is forbidden.

## Locked design

When a completed Nexus is selected and no path is committed:

- command deck enters `path-focus` mode;
- before commit, show only the two doctrine cards;
- arrange them in two equal columns on one row;
- each card remains >=88px high and >=44px wide;
- both cards, all text, and borders must be fully within the 1366×1024 viewport;
- exact names, blurbs, and `400 Ore · 80 Charge` remain unchanged;
- both cards remain touch-enabled when affordable and disabled when unaffordable;
- no scrolling is required.

During the 40-second channel:

- only the chosen doctrine card remains;
- it spans both columns;
- countdown and progress bar remain visible and update;
- it is fully inside the viewport.

After commitment:

- normal Nexus controls return unchanged;
- the committed readout and train/build controls preserve existing behavior.

No sim, costs, guidance, AI, input, art, renderer, app-flow, or results changes.

## Strict RED→GREEN proof

Extend `scripts/qa-vs5-pacing.mjs` first. At `03-choose-path` record bounding boxes for both path
buttons and assert:

1. exactly two buttons;
2. visible and enabled;
3. each width>=44 and height>=88;
4. every edge lies inside the 1366×1024 viewport;
5. top-edge difference <=4px, proving one row;
6. text retains exact cost.

At `04-channel`, assert the sole card is inside the viewport, width>=the combined choice width minus
4px, height>=88, disabled, and shows countdown.

Run unchanged commit and save RED showing Sky Dominion bottom >1024. Then implement minimal HUD/CSS
repair. Add no arbitrary waits or state bypasses.

Owned production: `src/hud.ts` only. QA: `scripts/qa-vs5-pacing.mjs`; force-add
`tasks/VS5A-red.log`. Package scripts unchanged.

Acceptance:

- `npm run qa:vs5 -- --out /home/bobbyranka/workspace/evidence/starhaven-vs5a-choice` PASS;
- fresh Sol same five-frame blind gate PASS;
- all VS5/VS4/VS3/VS2B/VS2A/progression/touch tests and build remain green.
