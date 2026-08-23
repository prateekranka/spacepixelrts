# M3 — Asymmetric faction economies (frozen implementation contract)

Status: **ACTIVE** for pieces A/B/C below. Governs `src/sim.ts`, `src/render.ts`,
`src/hud.ts`, `tests/m3-economies.test.ts`, `scripts/qa-m3-economies.mjs`. Contract
source: `docs/FIRST_PLAYABLE.md` M3. The AI uses these exact rules and receives no
arbitrary resource income (R5 of M2-D stays in force).

Legacy ids: Sunweaver = `vespari`, Gravemark = `aurion` (private adapters until migration).

## M3-A — Sunweaver collection links (Solar network)

A1 — Solar (Lumen) nodes only. The first Gather pulse of a Sunweaver worker at a Solar
node creates a `Link { nodeId, hallId, team, severedUntil }` from the node to the nearest
Hall of that team. Links are pooled in `World.links` (public, re-inited in reset).

A2 — While a live link exists and `tick >= severedUntil`, a Sunweaver worker at that node
pulses at **0.40 s** (vs the common 0.55 s), delivering **+1 energy directly** to the team
(no walk-back, no cargo). Node hp still -1 per pulse.

A3 — Vulnerable links: at each pulse, if any enemy unit (other team, alive) is within
**1.8 world units of the tether midpoint**, the link severs: `severedUntil = tick + 300`
(10 s). A severed link forces the standard gather/return behavior; after the cooldown the
next pulse relinks. Deterministic — no randomness, no clock dependence beyond the tick.

A4 — Links render as a thin amber tether from node to Hall (render.ts, only when the node
or Hall is visible to the viewing team). A severed link draws dimmer until it relinks.

## M3-B — Gravemark extraction rigs

B1 — Rig state lives on the resource node: `rigTeam` (-1 none, 0/1 owner), `rigProgress`
(0..1), `rigHp`. No new Ent kind; no enum changes.

B2 — A Gravemark worker with a Build order on an Ore or Gas node builds the rig: progress
+0.10/s while in build range (same cadence as buildings), `rigHp` ramps with progress to
**700**. A rigged node cannot be re-rigged by the other team while alive; a finished rig
cannot be cancelled.

B3 — A finished rig auto-extracts: **1 unit per 1.0 s** of the node's cargo into the owning
team (ore for Ore, gas for Gas), consuming **0.5 node hp** per unit ("refining" — twice the
yield per hp of worker gathering). Workers may still gather a rigged node normally.

B4 — Attacking a rigged node first strips `rigHp`; only after rigHp 0 does the base node
hp (280/200) take damage. A destroyed rig reverts `rigTeam = -1` and leaves the remaining
node hp harvestable.

B5 — AI: when `civ[1] === 'aurion'`, idle AI workers pick the nearest **discovered** Ore or
Gas node without a friendly rig and Build it (same imperfect-knowledge rule as M2-D). After
the rig finishes, the worker returns to Gather. No more than one worker builds any one rig.

## M3-C — Excess-energy boosts (Sunweaver)

C1 — Player-facing HUD toggles next to the resource strip (exactly three): **Production**
(8 energy/s), **Vision** (5 energy/s), **Shields** (6 energy/s). One active at a time;
activating one turns the others off. Only the Sunweaver faction gets boost toggles.

C2 — Effects while active and energy is above the drain:
- Production: team building `trainT` depletes at 1.8x.
- Vision: team units' fog radius uses `los + 2.5`.
- Shields: team buildings regen +6 hp/s (Hall self-repair stays separate, no stacking).

C3 — A boost auto-disables when `energy < 4` (deterministic, tick-driven). Re-enable needs
a fresh toggle. AI (when `civ[1] === 'vespari'`): engages Production while training military
and energy > 80, Vision during its scout's first 90 s, Shields never — one boost at a time,
same rule.

C4 — Boost state is per-team: `World.boosts: (0|1|2|3)[]` (0 off, 1 prod, 2 vision,
3 shields), re-inited in reset. Rendered HUD shows the active boost with a drain hint.

## Acceptance (each piece)

1. `npm run test:m0`, `test:m2`, `test:m2-ai`, new `test:m3` all pass.
2. New `qa:m3-economies` browser proof passes on the deterministic opening route: correct
   link/rig/boost behavior per piece, zero unknown-resource gathers, zero console errors,
   p99 rule from `qa-m2-ai` (hardware GL: render p99 < 8 ms; software GL: sim-share gate).
3. `npm run build` passes, `git diff --check` clean.
4. Commit message exactly `feat: <piece summary>`; deploy to production
   (`wrangler pages deploy dist --project-name=spacepixelrts --branch=main`) after each
   piece so the running game shows the change.
