# M2-D — AI imperfect knowledge under fog (frozen implementation contract)

Status: **FROZEN**. Governs `src/sim.ts`, `tests/m2-ai-knowledge.test.ts`,
`scripts/qa-m2-ai.mjs`. Contract source: `docs/FIRST_PLAYABLE.md` M2 ("The AI must also
scout and starts without perfect map knowledge") and M7 ("never changes map knowledge or
grants resource cheats").

## Rules (exact)

R1 — Scripted marshal cheats are OFF. The legacy opening-scripted marshal system is gated
behind `scriptedMarshalEnabled` (default `false`). When false, none of these run:
- per-tick resource floors (`eco.ore = Math.max(...)` etc.);
- the tick-240 epoch/epoch-resource grant;
- the tick-250 free Siege spawn;
- fast train-time clamps for enemy Fighter/Siege;
- the staggered attack-march peel toward the player Core.

R2 — AI workers gather only from resources their team has discovered
(`seenBy & SEEN_RIVAL`). `nearestResourceForTeam(team, x, z)` skips undiscovered nodes.
The player path (`nearestResource`) keeps its old behavior.

R3 — The rival Scout explores deterministically. On each 1.4 s AI cadence an idle rival
Scout receives a Move order to a frontier tile: the explored-but-not-visible rival tile
nearest to the map center; ties broken by lowest row then lowest column. No randomness,
no clock dependence. Arrival leaves the Scout idle until the next cadence.

R4 — AI attackers drop targets lost from sight. A team-1 unit in Attack with target tid
whose team differs and whose tile is not currently visible to team 1 drops the order to
Idle. Evaluated on the existing 1.4 s cadence only (deterministic).

R5 — No resource grants. Team 1 income comes only from worker gathering under R2.
Nothing else writes to `teams[1]` balances.

## Public API added

- `World.scriptedMarshalEnabled: boolean = false`
- `World.nearestResourceForTeam(team, x, z): Ent | null`

Everything else stays private. `reset()` re-inits all new state.

## Acceptance

1. `npm run test:m0` passes.
2. `npm run test:m2` plus `tsx tests/m2-ai-knowledge.test.ts` passes:
   - fixed-seed 90-s step: zero unknown-resource gathers by AI workers;
   - every AI gather target satisfies `(seenBy & SEEN_RIVAL) !== 0`;
   - rival Scout explored area grows during scripted stepping;
   - attacker drops an out-of-sight player target within one cadence;
   - `teams[1]` ore/gas deltas equal sum of returned cargo (no grants);
   - `scriptedMarshalEnabled = true` restores legacy behavior (regression guard);
   - two worlds at same seed agree entity-for-entity (determinism).
3. `npm run qa:m2-ai -- --out=<absolute dir outside repo>` passes: p99 frame < 8 ms,
   zero browser errors, four AI Gather workers visible after 90 sim seconds, no
   unknown-resource or hidden-Core violations in the audit.
4. `npm run build` passes. `git diff --check` clean.

Commit message exactly: `feat: give AI scout-driven knowledge under fog rules`.
