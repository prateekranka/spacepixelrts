# M4 — Technology Paths (two-way, irreversible)

Contract sources: `docs/FIRST_PLAYABLE.md` §M4, `docs/CANONICAL_VOCABULARY.md`,
`docs/FIRST_PLAYABLE_GAP_ANALYSIS.md` FP-GAP-201 (P0) + FP-GAP-202 (P1).
This spec is the build contract. Implement exactly this. No scope growth.

## Contract restated

Each faction makes exactly ONE irreversible choice between TWO technology paths.
Committing locks the path for the rest of the skirmish. There is no linear ladder,
no ages, no epochs, no "age up" anywhere in player-facing text.

| Faction | Path A | Path B |
|---|---|---|
| Sunweaver | Solar Ascendancy `solar-ascendancy` | Sky Dominion `sky-dominion` |
| Gravemark | Iron Colossus `iron-colossus` | Rift Engineering `rift-engineering` |

## Design decisions (locked by lead)

1. **One flat commitment.** No tiers inside a path. Before commit: Worker, Scout,
   Habitat, Yard, resource gathering, links, rigs all available exactly as today
   (base kit). After commit: path-gated combat kinds unlock (today: Fighter, Siege,
   faction unique). M5 freezes rosters; do not touch rosters here.
2. **Committing is a Nexus research**, same mechanics as the old age-up so feel is
   preserved: cost 400 ore + 80 charge, 40 s channel on the Hall, Hall cannot train
   while channeling, not cancellable, other Halls may not start a second commit.
3. **Irreversibility:** once `techPath !== null` no call may change it;
   `tryCommitPath` returns false forever after. UI shows the chosen path as locked.
4. **Path effects — exactly two per path, one place** (`PATH_EFFECTS` in content):
   - `solar-ascendancy`: link re-form delay after sever 10 s → 5 s; boost drain ×0.75.
   - `sky-dominion`: non-worker combat unit speed ×1.12; Scout-type LOS +2.
   - `iron-colossus`: finished-rig HP ×1.5; rig extraction interval 1.0 s → 0.75 s.
   - `rift-engineering`: ranged (non-melee) attack range +1.0; Siege-kind train time ×0.7.
   Effects apply to BOTH teams' own units/buildings only. Numbers live in one table;
   tests assert plumbing, not tuning.
5. **Internal fields:** keep `TeamEco.epoch` / `ageT` storage (vocab doc defers the
   rename). `ageT` is reused as the commit-channel timer. On commit set `epoch = 1`
   once for legacy readers, then never write it again. All NEW logic reads
   `techPath`. Delete the epoch>1 concept everywhere (enemy marshal included).
6. **AI:** at tick 240 the enemy marshal commits its doctrine path instead of the
   old `epoch = 2` jump: vespari → `sky-dominion`, aurion → `iron-colossus`.
   Because commit opens all gates, current army timing is preserved. M7 revisits.
7. **Language:** player-visible strings use path names only. Banned in
   player-facing surfaces (HUD, guidance, setup, results): "epoch", "age", "Spark",
   "Orbit", "Dominion" as stage, "Apex". Note "Sky Dominion" is a proper noun and
   allowed. Internal identifiers unchanged.

## Pieces

### M4-A — sim core + content table (this brief)
Files: `src/engine.ts` (TeamEco field), `src/content.ts` (paths, effects, gates),
`src/sim.ts` (tryCommitPath, gate checks, AI commit, marshal edit), 
`tests/m4-tech-paths.test.ts`.
Definition of done:
- `TechPathId` union exported from engine or content; `TeamEco.techPath: TechPathId | null`.
- `World.tryCommitPath(team, path): boolean` — validates path belongs to team's civ,
  costs resources atomically, starts the 40 s channel, blocks Hall training while
  channeling, irreversible.
- `World.techPathOf(team): TechPathId | null`, `World.pathChannelT(team): number` remaining.
- Gate rewrite: `minTrainEpoch(kind)` replaced by `isPathGated(kind)` +
  `gateOpen(eco, kind)`; Yard refuses gated kinds until commit (same refusal path
  as today — silent for AI, disabled button for HUD).
- Effects from decision 4 wired at their existing mechanic sites (sever window,
  boost drain, speed lookup, LOS lookup, rig hp/extraction, range, siege train).
- Enemy marshal tick-240 commit per decision 6; delete `epoch = 2` writes.
- `npm run test:m4` green; all existing suites (`test:m0`, `test:m2*`, `test:m3`)
  still green; `npm run build` clean.
- Tests cover: happy-path commit (resources deducted, channel elapses, gates open),
  wrong-faction path rejected, double-commit rejected, commit during channel
  rejected, poor funds rejected with no state change, each path effect observable,
  AI auto-commit at tick 240, irreversibility under direct field write attempt via
  public API only.

### M4-B — HUD choice UI + guidance sweep
Files: `src/hud.ts`, `src/opening-guidance.ts`, `scripts/qa-m4.mjs`,
`package.json` (`qa:m4`, `test:m4` script entries).
Definition of done:
- Hall panel uncommitted: two buttons with path name + one-line effect summary +
  cost sub-label. Channeling: countdown label, both disabled. Committed: single
  locked readout of the chosen path.
- No banned words in any rendered string (grep gate in QA script over DOM text).
- `opening-guidance` adds one nudge when ore ≥ 400 and uncommitted; suppresses
  after commit.
- `qa:m4` headless proof passes: commit flow click → channel → locked, effects
  visible (e.g. tether sever label), zero console errors, screenshots saved to
  evidence dir.

## Verification bar

`npm run test:m4 && npm run test:m0 && npm run test:m2 && npm run test:m2-ai &&
npm run test:m3 && npm run build && npm run qa:m4` — all green, evidence saved.
Visual three-critic pass stays queued (no vision route in this environment);
objective gates carry the gate per PROGRESS.md precedent.
