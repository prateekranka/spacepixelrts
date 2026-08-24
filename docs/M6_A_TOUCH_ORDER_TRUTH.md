# M6-A — Touch order truth + first resource income

Sources: `docs/FIRST_PLAYABLE.md` §M6, two sealed blind production playtests
(51:05 touch-only; 52:25 first-time mouse/touch), and root-cause trace in `src/input.ts`.
This is a P0 repair contract. Implement exactly this piece before radial menus,
formations, or queued multi-orders.

## Observed production failures

1. MOVE/ATTACK buttons are comments only (`Hud.handle`); `Input.commandAt` ignores them.
2. The next tap always runs `selectTap`, so MOVE→ground deselects instead of ordering.
3. Long-press always issues `Ord.Move`; it never context-picks resources/enemies.
4. `closestEnemyScreen` accepts every non-player entity. Resource nodes are team 3,
   so a resource press is classified as enemy before `closestResource`; workers show
   `Attacking` and income never starts.
5. Resource screen hit radius is 28px, below the required 44px touch target.

These five code facts exactly reproduce both critic reports. No sim-economy change is
needed: `thinkGather` already collects, returns cargo, and deposits correctly once an
actual `Ord.Gather` reaches a real Resource tid.

## Locked interaction contract

### Command modes

`Input.commandMode: 'move' | 'attack' | 'gather' | null` is readable by HUD.

- MOVE button: sets `move`; button visibly stays armed. Next world tap issues `Ord.Move`
  at tapped ground, preserves selection, clears mode.
- ATTACK button: sets `attack`; next enemy tap issues `Ord.Attack`; next ground tap issues
  `Ord.AttackMove`; preserves selection, clears mode.
- GATHER button (workers): sets `gather`; next Resource tap issues `Ord.Gather` to selected
  Workers only, preserves selection, clears mode. Non-resource tap keeps gather armed and
  shows the existing hint as `Tap a resource node`.
- STOP: stops units and clears mode. Selecting a different friendly entity clears mode.
- Build placement and command mode are mutually exclusive. Arming one clears the other.

### Context long-press/right-click

One shared context resolver, in this priority:

1. visible enemy sprite, excluding `Kind.Resource` → Attack;
2. visible Resource sprite → Gather, selected Workers only;
3. ground → Move.

Long-press and right-click call this same resolver. Resource nodes are never enemy picks.
Mixed selections do not put combat units into Gather.

### Touch hit and feedback

- Resource screen hit radius: 44 CSS px minimum at every zoom.
- MOVE/ATTACK/GATHER armed tile uses existing `.on` state.
- Arming hint: `MOVE ARMED · Tap ground`, `ATTACK ARMED · Tap target or ground`,
  `GATHER ARMED · Tap a resource node`.
- On issuance, existing unit ORDER field is the confirmation; no new overlay in this piece.
- Worker panel gets a visible GATHER button. Other unit panels do not.

## Strict RED→GREEN gate

Create `scripts/qa-touch-contract.mjs` and package script `qa:touch-contract` BEFORE
production changes. It boots `?qa=opening&qa-run=1` at 1024×768, uses real pointer/touch
input for actions, and may use QA handles only for assertions/fast stepping.

RED assertions on the current tree:

1. Scout selected → MOVE tile → ground tap: selection remains scout, order is Move,
   target changes, mode clears. Current tree must fail this.
2. Worker selected → GATHER tile → Resource tap: order is Gather, tid is Resource,
   selection remains worker; after deterministic stepping, the correct team resource total
   increases. Current tree must fail this.
3. Worker long-press and right-click on Resource both produce Gather, never Attack.
4. Combat unit in mixed selection never gets Gather.
5. Enemy attack pick excludes Resource.
6. Zero console errors; composited screenshots saved under the passed `--out` root.

Save the first failing output verbatim to `tasks/M6A-red.log`. After implementation,
`npm run qa:touch-contract` must PASS plus all existing suites/build.

## Definition of done

- All locked behavior above implemented in `src/input.ts` + `src/hud.ts` only.
- `src/sim.ts` untouched.
- RED proof exists and failed for the expected missing behavior.
- GREEN: `qa:touch-contract`, `test:m0`, `test:m2`, `test:m2-ai`, `test:m3`, `test:m4`,
  `test:m5`, build all pass.
- Fresh blind touch critic must successfully MOVE by armed tap and earn visible resource
  income before this piece can pass the gameplay gate.
