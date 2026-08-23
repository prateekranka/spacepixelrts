# VS-3 — Terminal, Results, and Same-Page Replay

Status: **ACTIVE / FROZEN**. Parent: `docs/VERTICAL_SLICE_SPRINT.md`.
This piece closes the user journey. It does not change combat balance, AI doctrine, objectives, art,
or match configuration.

## Required flow

The existing `AppFlow` transitions are canonical:

```text
Playing -> Victory|Defeat -> CONTINUE -> Results
Results -> REMATCH -> MatchSetup
Results -> MAIN_MENU -> MainMenu
```

No page reload, URL navigation, or new state. Simulation advances only in Playing.

### Victory / Defeat terminal

When the real World winner triggers the existing transition:

- simulation stops on that exact tick;
- full-screen dim scrim keeps the final battlefield visible;
- panel shows `VICTORY` / `DEFEAT`;
- subline uses `Enemy Nexus shattered` / `Your Nexus is ash`;
- one 44px-min button: `CONTINUE`;
- button is touch/keyboard focusable and dispatches `CONTINUE` exactly once;
- no world/touch command can mutate the stopped match.

### Results

`Results` hides topbar, bottom deck, matchup, hints, and guidance. It shows one centered results panel:

- kicker `MATCH COMPLETE // HELIOS RIFT`;
- outcome `VICTORY` or `DEFEAT`;
- duration `MM:SS` from terminal World.tick × DT;
- player faction vs rival faction and selected difficulty;
- two comparison columns, canonical faction names;
- rows:
  - `RESOURCES GATHERED` — `Ore / Volatiles / Charge`;
  - `UNITS TRAINED`;
  - `UNITS LOST`;
  - `CORE DAMAGE`;
  - `TECHNOLOGY PATH` — committed path name or `No path chosen`;
- buttons `PLAY AGAIN` (`REMATCH`) and `MAIN MENU` (`MAIN_MENU`), both >=44px;
- no score, stars, achievements, save/load, or invented progression.

Results values remain frozen after terminal; no live counting in Results.

## Match stats

Add a defensive snapshot API in `World`:

```ts
interface MatchTeamStats {
  resources: { ore: number; gas: number; energy: number };
  unitsTrained: number;
  unitsLost: number;
  coreDamage: number;
}
interface MatchStats {
  tick: number;
  teams: readonly [MatchTeamStats, MatchTeamStats];
}
world.matchStats(): MatchStats
```

Rules:

- reset zeros all stats before initial spawns and arms tracking only after `spawnScenario`;
- initial Workers/Scout/Core and starting resources do not count;
- any post-reset spawned team 0/1 unit counts trained exactly once, including auto-produced Worker;
- unit death counts lost exactly once when corpse/dissolve begins; buildings/resources do not;
- resources include all positive income after reset: Worker returns, Sunweaver Solar link, Gravemark
  rig extraction, and Central Lumen Charge. Spending/drains do not subtract gathered totals;
- Core damage is actual HP removed from an enemy `Kind.Hall`, capped by remaining HP; melee, bolt,
  turret, and overkill use attacker/bolt team; repair does not subtract damage dealt;
- `matchStats()` returns copies; callers cannot mutate World;
- terminal tick and snapshots cannot change after AppFlow stops simulation.

## Same-page second match

Remove the one-match guard. Reuse the same bound `World`, `GameRenderer`, `Input`, and `Hud` objects
on match 2+; do not duplicate host/window listeners or canvases.

### Input reset

`Input.resetForMatch()` clears:

- selection and all groups;
- placement and command modes;
- drag box, pointers, pan gesture, long-press timer/state, double-tap state;
- static held keys;
- camera is then set by existing `applyCamera`.

### Renderer reset

`GameRenderer.resetWorld(world)`:

- disposes/removes old terrain geometry/material and owned tile/decal/height textures;
- disposes/removes old fog geometry/material and its old height texture, but reuses the shared fog
  data texture;
- rebuilds terrain/fog from the new seed and updates `heightData`;
- clears transient procedural-worker visibility/VFX presentation as needed;
- leaves one game canvas + one overlay canvas, shared atlas, lights, camera, and event bindings;
- next draw reflects the new map/fog with no old-frame artifact.

### HUD reset

`Hud.resetForMatch()` clears command/civ/guidance/Lumen signatures, terminal/results mode, and hides all
terminal surfaces. `Hud.setAppState(state, difficulty)` controls what is visible.

`prepareMatch` creates objects only on match 1. On match 2+, it applies factions/fog/difficulty,
resets World, Renderer, Input, HUD, camera, accumulators, SFX count, and terminal latch. Increment
`resetCount` once each match.

## QA routes

After implementation, `victory`, `defeat`, and `results` are no longer scaffolds in
`src/qa-scenarios.ts`. Their event sequences and deterministic config remain unchanged.

## Strict RED→GREEN

Create `tests/vs3-results.test.ts` and `test:vs3` before production changes. Save
`tasks/VS3-red.log`.

Required test behaviors:

1. initial/reset stats are zero and defensive;
2. post-reset spawn increments trained once; initial spawns remain zero;
3. Worker return, Solar link, rig, and Lumen income enter the correct resource buckets;
4. unit death increments lost exactly once; building/resource death does not;
5. melee and bolt Core damage record actual HP removed and cap overkill;
6. reset clears all stats and preserves existing gameplay state contracts;
7. AppFlow terminal/results/rematch/menu remain legal and sim gate remains Playing-only;
8. victory/defeat/results scenario scaffold flags are false.

## Browser proof

Add `scripts/qa-vs3-results.mjs` + `qa:vs3` at 1366×1024.
Use actual World operations and AppFlow; never write winner/stats/app state directly.

Run one bounded two-match sequence:

1. Playing: create nonzero gathered/trained/core-damage facts through ordinary sim methods;
2. damage enemy Core to death through a legal attack fixture;
3. assert Victory, stable terminal tick, visible/focusable `CONTINUE`, no world mutation while stopped;
4. click Continue; assert Results, exact MM:SS and stat rows, hidden game HUD, 44px buttons;
5. click Play Again; assert MatchSetup; start a second deterministic match with changed seed/factions;
6. assert Playing, `resetCount=2`, tick near zero, winner -1, stats zero, selection/modes cleared,
   exactly one #game/#overlay/#hud, changed terrain/height signature, console 0;
7. damage player Core through legal rival attack; assert Defeat -> Continue -> Results;
8. click Main Menu; assert MainMenu, one start screen, no HUD overlay leak;
9. primary 13 QA routes still unique and no scenario scaffold for victory/defeat/results;
10. software GL sim share <8ms; hardware p99 <8ms.

Capture: victory terminal, victory results, second setup, second Playing, defeat terminal, defeat results,
main menu. Evidence outside repo. Fresh Sol gate judges terminal/results hierarchy and touch clarity.

## Scope / acceptance

Owned production: `src/sim.ts`, `src/input.ts`, `src/render.ts`, `src/hud.ts`, `src/main.ts`,
`src/qa-scenarios.ts`, test/QA/package. AppFlow transitions must not change. No content, AI, stats balance,
combat behavior, terrain generation, sprite, or asset edits.

All existing VS1/VS2/M0–M5 gates and build pass. Builder commits prefix `VS3:`. Lead reviews actual
two-match browser proof and fresh Sol gate. Deploy after PASS.
