# M6-B — Reachable technology handoff + honest costs

Sources: three sealed blind production playtests (51:05 touch, 52:25 first-time,
93:39 systems across Standard+Cadet), `docs/FIRST_PLAYABLE.md` §M4/§M6, and code trace.
This is the next P0 progression repair after M6-A restored gathering.

## Verified production failures

1. Yard shows Lumen Guard/Solar Strider only as disabled `needs path`; there is no
   actionable route from that dead end to the Nexus path panel.
2. Path choices exist only while the Hall/Nexus is selected. Building art/hit overlap made
   Hall selection unreliable in both desktop and touch sessions.
3. HUD build/train sub-lines show Ore only. Sim costs also deduct Gas/Charge; e.g. Yard
   visibly says `150 ore` but deducts 150 Ore + 20 Charge. This hidden spend directly harms
   the 400 Ore + 80 Charge path requirement.
4. After Yard spend, a functioning economy can recover, but the player cannot discover the
   required handoff or audit the true cost.

## Locked contract

### First-class technology entry

- Add `Input.focusHall(): boolean`: select and center the player's alive, completed Hall,
  clear placement/command modes, play select feedback, return success.
- Add command `tech-focus` to the bottom command deck when uncommitted:
  - no selection: `TECHNOLOGY PATH` / `Open Nexus research`;
  - Yard selected: one `CHOOSE PATH` tile before unit buttons / `Open Nexus research`;
  - Yard's locked combat buttons say `Choose path first`, not bare `needs path`.
- Clicking `tech-focus` calls `focusHall`; the Hall panel immediately renders both existing
  M4 path tiles, affordable or not. The path stays a Nexus research—no direct Yard commit.
- Once a path is committed, tech-focus disappears and Yard combat buttons use normal gates.
- If no completed Hall exists, tech-focus remains visible but hint says `Build a Nexus first`.

### Honest cost labels

One `costLabel(stats)` helper used by every build/train button and path cost line:

- include each non-zero cost in fixed order: Ore · Volatiles · Charge;
- spell units: `150 Ore · 20 Charge`, `90 Ore · 35 Volatiles · 20 Charge`;
- no hidden deduction may be absent from the visible pre-click sub-line;
- pop cost remains in the selection stat/disabled state, not this price line.

Path tiles stay `400 Ore · 80 Charge` and countdown/locked states unchanged.

### Feedback

- Clicking tech-focus: Nexus selected, camera centers, hint `Choose one permanent path`.
- Unaffordable path tiles remain readable; cost line uses current unaffordable styling.
- A locked unit button is disabled, but its sub-line names the recovery action:
  `Choose path first`.

## Strict RED→GREEN browser gate

Create `scripts/qa-progression-handoff.mjs` + `qa:progression-handoff` before production edits.
At 1024×768, real button/touch input; QA handles only for staging/assertions/fast stepping.

RED on current tree must prove:

1. completed Yard selected + uncommitted team has no actionable `tech-focus` button;
2. Yard build button exposes hidden-cost mismatch (`150 ore` vs 150 Ore + 20 Charge);
3. locked train buttons say bare `needs path` and provide no handoff.

GREEN assertions:

1. no-selection tech-focus touch selects Hall and both M4 path tiles appear;
2. Yard tech-focus does the same; hint correct;
3. Yard label exactly `150 Ore · 20 Charge`;
4. Solar Strider label exactly `90 Ore · 35 Volatiles · 20 Charge`;
5. grant 500 Ore/120 Charge, touch Solar Ascendancy, assert 400/80 deduction,
   channel countdown, step to completion, path locked;
6. select Yard; Lumen Guard and Solar Strider now enabled and no tech-focus remains;
7. zero console errors; composited screenshots + manifest.

Save expected current-tree failure to `tasks/M6B-red.log` before source edits.

## Definition of done

- Scope: input.ts/hud.ts + new QA/package only; sim/content/render untouched.
- Strict RED log exists; GREEN QA passes.
- All m0–m6 existing gates and build pass.
- Fresh blind player from a selected Yard must reach path choice without guessing or direct
  Hall art selection, see complete costs, commit, and return to an enabled Yard roster.
