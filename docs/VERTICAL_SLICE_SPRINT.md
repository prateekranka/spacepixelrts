# Starhaven Vertical Slice Sprint — ACTIVE

This sprint implements the smallest complete skirmish before any deep M6 controls or visual
polish. `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, and `docs/FIRST_PLAYABLE.md` remain
higher authority. Preserve all verified M0–M6-A behavior.

## Product target

One honest Standard match closes this chain:

`menu → setup → scout → gather → choose path → train four-unit compact army → contest center →
destroy/lose Core → Continue → Results → setup/menu`

A deterministic automated match must resolve by 18:00. Short human/Luna checks are capped at
5–10 real minutes and test one seam. Sol performs fresh blind final gates only.

## Current code truth

Already real and preserved:

- menu/setup/loading/application states;
- player-driven fog opening and discovery;
- touch Move/Gather orders and visible income;
- both faction economies;
- irreversible path sim/channel/effects;
- exact compact rosters and combat sim;
- winner detection and Playing→Victory/Defeat transition.

Current blockers:

1. Yard/no-selection UI has no actionable route to Nexus path choice; costs hide Volatiles/Charge.
2. Honest AI never builds a Yard, commits a path, or fields an army. The old marshal path that did
   this used grants and is correctly disabled.
3. `battle`/`victory` QA routes are state-only scaffolds, not real fixtures.
4. Victory/Defeat has no clickable Continue and Results has no player-facing screen/actions.
5. Combat units use tiny 32px startup rasters; the required four roster silhouettes need one
   coherent 8-direction asset pass after the loop closes.

## Locked order

### VS-1 — Progression handoff and honest costs

Implement `docs/M6_B_PROGRESSION_HANDOFF.md` exactly. This is input/HUD/QA only; sim untouched.
A Yard-selected player reaches the two Nexus choices in one touch and sees every actual resource
cost before spending. Fresh focused check cap: 5 minutes.

### VS-2A — Honest AI production doctrine

No grants, instant units, hidden map knowledge, or `scriptedMarshalEnabled`.

- AI workers use existing discovered-resource gathering.
- After it can pay exact costs, AI assigns one eligible Worker to build one Yard at a deterministic
  valid slot near its Core through the same `tryPlace` rules.
- After the Yard completes and it can pay 400 Ore + 80 Charge, AI uses `tryCommitPath` and the same
  40-second channel. Standard doctrine: Sunweaver `sky-dominion`; Gravemark `iron-colossus`.
- After commit, AI trains a mixed four-unit force: alternate Fighter and faction unique unit,
  maintaining at least a 2+2 first wave when resources permit.
- AI rallies at the Central Lumen Field. It attacks the player Core only after that Core has been
  discovered by the AI. It does not target unseen entities.
- Standard reaction loop remains 1.4s. Cadet 2.6s; Veteran 0.8s. Match config passes difficulty
  into World explicitly.

Objective acceptance: deterministic sim QA proves no resource grants, legal Yard/path deductions,
four combat units, center rally, discovered-target attack, and an 18-minute hard-cap resolution
under a deterministic QA player policy.

### VS-2B — Minimal Central Lumen conflict

The center accelerates conflict but is not an alternate victory:

- radius 4.5 world units around `central-lumen-field`;
- one team present and no enemy present: capture advances; ownership after 5 seconds;
- contested or empty: no capture progress; owner persists;
- owner receives +1 Charge/second;
- every 30 seconds, owner gets a 4-second global vision pulse;
- HUD shows `LUMEN: NEUTRAL / CAPTURING / CONTESTED / SUNWEAVER / GRAVEMARK` plus a compact bar;
- minimap uses the existing center marker with faction tint when owned.

QA fast-steps real units into/out of the zone and verifies ownership, income, pulse, contest, and
no victory side effect.

### VS-3 — Terminal and Results closure

- Victory/Defeat overlay is interactive and has one `CONTINUE` button.
- Continue legally dispatches to Results.
- Results screen shows outcome, duration, resources gathered, units trained, units lost, and enemy
  Core damage. Add deterministic match-stat counters at real sim seams.
- Results has `PLAY AGAIN` (MatchSetup) and `MAIN MENU` actions through legal app events.
- Starting a second match from setup works on the same page: renderer/input/HUD/world lifecycle is
  disposed and recreated exactly once. No full-page reload.
- `victory`, `defeat`, and `results` routes become non-scaffold, composited, and browser-tested.

### VS-4 — Combat silhouette asset pack (only after VS-1–3 pass)

Generate and integrate four runtime pixel assets:

- Sunweaver Lumen Guard (Fighter): broad round radiant shield + long spear;
- Sunweaver Solar Strider (Ravager): low four-legged support walker + sun-disk engine;
- Gravemark Rift Guard (Fighter): tall rectangular basalt shield + crystal spear;
- Gravemark Burden Walker (Prism): massive high-backed industrial quadruped + rift engine.

Asset rules are frozen in `docs/VS1_COMBAT_ASSETS.md`. One atlas and one instanced draw path;
no draw-call regression. This replaces only the four slice-critical combinations.

## Gauntlet gates per piece

1. Builder receives one complete brief and commits its piece.
2. Lead reviews diff and reruns objective tests/build.
3. Luna runs one focused 5–10 minute seam check with explicit steps.
4. Fresh Sol critic inspects the actual running build/captures. It names one biggest gap.
5. Iterate that gap until PASS. Do not run another full 18-minute human session; use deterministic
   accelerated QA for pacing and reserve full-match play for final slice certification.
6. Commit, push, deploy, update `PROGRESS.md` after every verified piece.

## First certification

The slice passes only when:

- a fresh player can reach path choice and first combat unit without guessing;
- deterministic Standard match resolves by 18:00 with legal economies for both sides;
- terminal Continue and Results actions work;
- current build has zero console errors and game-work p99 < 8ms on hardware (software GL records
  render p99 and gates sim-work share);
- fresh Sol blind critique says the loop is understandable and the four combat roles are distinct.
