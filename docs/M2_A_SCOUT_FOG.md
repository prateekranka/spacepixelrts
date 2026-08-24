# M2-A — Scout and fog foundation

Status: **ACTIVE IMPLEMENTATION CONTRACT**

## Exact production reset

For team 0 and team 1, spawn exactly:

- one `Kind.Hall` Core;
- four `Kind.Worker` units;
- one `Kind.Scout`.

Spawn no House, Barracks, Fighter, Siege, unique unit, forward camp, corpse, or pre-issued combat
order. Workers and scouts start Idle so the player and later AI code must act.

Keep the existing faction start resource budgets. Hall cap must cover five starting population.

## Resource pads

Keep the deterministic Helios Rift terrain and central contested resource art. Add mirrored,
base-adjacent Ore, Gas, and Solar nodes within initial LOS. Do not place nodes on the Core or unit
spawn positions. Random map patches remain unchanged.

## Honest fog

- `World.fogOfWarEnabled` defaults true; the validated match config can still set false.
- Remove `revealOpeningVision` from reset.
- Remove all tick-window center reveal and forced tableau/camp visibility.
- Own entities remain visible. Neutral resources and enemy entities use current LOS.
- `GameRenderer` fog mesh visibility and updates use `world.fogOfWarEnabled`, not a URL-only review
  flag.
- The central map tile is unexplored at tick 0 when fog is on.

## Camera

Change the normal `OPENING_CAMERA` to the player base around `(12, 12)` with a strategic half-height
that shows the Core, four workers, scout, and nearby resource pads. Keep `OPENING_CENTER` for later
map landmarks.

## Touch move

In `Input`, add a stationary single-pointer long press of at least 450 ms:

- only when a selection exists and building placement is not active;
- issue `Ord.Move` through the existing order path;
- no effect after drag movement, two-finger gestures, right click, or pointer cancel;
- tap select, double tap, box select, wheel, keyboard, and desktop right-click remain unchanged.

## Deterministic tests

Add `tests/m2-opening.test.ts` and package command `test:m2`.

At seed `0x5eed`, assert:

1. Each team has exactly 1 Hall, 4 Workers, 1 Scout, and no other team entity.
2. All starting units are Idle.
3. Population is 5 and cap is sufficient.
4. At least one Ore, Gas, and Solar node is within 10 world units of each Hall.
5. With fog on, player base is explored but center is not.
6. With fog off, visible/explored arrays are full.
7. Two same-seed resets produce identical team entity and resource positions.

Add a bounded Playwright touch smoke or extend an existing QA script to select the scout, long-press
unexplored terrain, and prove its order/target changes without browser errors.

## Owned files

- `src/sim.ts`
- `src/render.ts`
- `src/input.ts`
- `src/opening-presentation.ts`
- `tests/m2-opening.test.ts`
- one bounded M2-A browser smoke script if needed
- `package.json`
- `docs/M2_OPENING_SCOUTING.md`
- `docs/M2_A_SCOUT_FOG.md`
- `PROGRESS.md`

Do not edit combat stats, economy costs, AI strategy, HUD guidance, discovery latches, technology,
assets, or unrelated QA scenarios.

## Acceptance

- `npm run test:m0`
- `npm run test:m2`
- `npm run build`
- M2-A touch smoke passes.
- `qa:m0` opening route passes in both orientations.
- Full M0/M1 regression passes.
- Browser errors 0; p99 < 8 ms.
- Commit exactly `feat: complete scout-driven fog exploration loop` and push.
