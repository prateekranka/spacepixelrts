# Spacepixel RTS — Orchestration

Grok 4.6 Extra High is the orchestrator. Composer 2.5 are builders, critics, integrators. This file is the piece registry.

---

## Loop

For every piece:

1. Orchestrator writes a **self-contained brief** (spec, files to read, DoD, verify steps).
2. Spawn builder via the leak-safe wrapper (bounded timeout, process-group kill on exit):

```
scripts/spawn-composer.sh tasks/<id>-brief.md tasks/<id>.md 600
```

Never leave a Composer process running after the piece finishes. Do not spawn raw `cursor-agent` in a detached tmux session without the wrapper.

3. Orchestrator reviews the **diff**, not the agent's claim.
4. Spawn a **fresh** critic (new process, no builder context) that inspects the **running game** via `npm run critic` and/or Playwright against `npm run dev`. Blind bar: AoE2:DE.
5. On fail: name the **single biggest gap**, spawn builder again with that gap only. No round cap.
6. DONE only when a fresh critic is wowed on that piece's scope.
7. Builder commits with prefix `Pxx:`. Orchestrator updates this file + `PROGRESS.md` and deploys.

Between waves: one **integrator** plays the whole game and smooths seams.

**Do not** hand design judgment to sub-agents. They implement `docs/DESIGN.md` + `docs/ARCHITECTURE.md`.

---

## Brief template (every spawn)

```
You are the Composer 2.5 builder for Spacepixel RTS piece <ID>: <title>.
Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: docs/ARCHITECTURE.md, docs/DESIGN.md, docs/ORCHESTRATION.md, PROGRESS.md, then the files listed below.
Do not redesign civs, renderer architecture, or the tick loop.
Definition of done: ...
Verify: npm run build ; (dev server / critic as specified)
When done: git add -A (no secrets, no critic/out png dumps unless tiny) && git commit -m "Pxx: ..."
Write tasks/<id>.md with what you changed and how you verified. This report is not evidence for the critic.
```

Critic brief extra:

```
You are a FRESH critic. Do not read tasks/*.md as truth. Run the game. Use npm run critic.
Compare blind to Age of Empires II: Definitive Edition on: battle clarity, command feel, empire presence, pixel craft, 60fps.
Pass = genuinely wowed for THIS piece's scope. Fail = name the single biggest gap (one sentence) and what to change.
Write tasks/<id>-critic.md. Do not change game code unless the orchestrator said you may patch a one-liner probe.
```

---

## Piece registry

Status: `queued | building | critic | iterate | done`

### Wave 0 — orchestrator (this process)

| ID | Piece | Owner | Status | Verdict |
|---|---|---|---|---|
| P00 | Docs (ARCHITECTURE, DESIGN, ORCHESTRATION) | orchestrator | done | contract locked |
| P01 | Scaffold + boot + first deploy | orchestrator | done | live 60fps skirmish |
| P02 | Critic harness | orchestrator | done | `npm run critic` → Playwright + palette + probe |

### Wave 1 — core

Independently judgeable. P10 ∥ P11 after P01/P02. P12 after P11. P13/P14 after P10. P15 last.

| ID | Piece | Depends | Status | Latest critic |
|---|---|---|---|---|
| P10 | Sim kernel: Ent SoA, commands, spawn/kill, step stub orders | P01 | done | pending P15 |
| P11 | Pixel pipeline: atlas, InstancedMesh layers, iso camera snap, team-key shader | P01 | iterate | blobs — P11b |
| P12 | Camera + touch/pointer + box select + hit test | P11 | done | pending P15 |
| P13 | Pathfinding A* + steering + separation | P10 | done | pending P15 |
| P14 | Map gen + tiles + resource nodes + two bases | P10 | done | pending P15 |
| P15 | Wave 1 integrator: wire loop, opening tableau, move a squad | P10–P14 | critic | in flight |

Wave 1 wow bar: a critic watching the live canvas sees a pixel-crisp isometric battlefield, can select and move units, they path around rocks, 60 fps, palette coherent. Not full civs yet — but it must already look like a game, not a grid demo.

### Wave 2 — gameplay (live numbering after Wave 1 visual pass P27–P41)

Opening tableau is locked (P41). P20–P26 in the original plan were largely absorbed into the vertical slice. Live Wave 2 pieces:

| ID | Piece | Depends | Status | Latest critic |
|---|---|---|---|---|
| P42 | Integrator: play the skirmish, name the gap | P41 | done | no playable match arc; pop 22/20 blocks train |
| P43 | Unblock training: pop < cap, home habitats, corpse pop, hall pick | P42 | done | **PASS** `73cb5dc` live 22/30 train Worker |
| P44 | Epochs / AgeUp in sim + HUD (Orbit unlock) | P43 | done | **PASS** `5b3467d` live 0.3.1-wave2 |
| P45 | Win/lose: destroy Nexus, banners | P43 | done | **PASS** `9091679` live 0.3.2-wave2 |
| P46 | Enemy marshal threatens player Nexus during macro | P43 | done | **PASS** `2d055e1` live 0.3.3-wave2 (scout raid) |
| P47 | Wave 2 critic: match arc vs AoE2:DE | P44–P46 | critic | |

| ID | Piece | Depends | Status | Latest critic |
|---|---|---|---|---|
| P20 | Content tables (stats, costs, civ bonuses) wired | P15 | done (in slice) | |
| P21 | Economy: gather, return, pop, epoch research | P20 | iterate — pop/epochs | |
| P22 | Buildings: place, construct, train, rally | P21 | iterate — train blocked | |
| P23 | Combat + battle clarity (HP, bolts, death, bonuses) | P20 | done (Wave 1) | |
| P24 | Fog of war | P14 | done (in slice) | |
| P25 | Unique units/buildings + AI marshal | P22 P23 | iterate — AI delayed | |
| P26 | Wave 2 integrator | P20–P25 | done as P42 | |

### Wave 3 — feel

| ID | Piece | Depends | Status | Latest critic |
|---|---|---|---|---|
| P30 | HUD command bar + portraits + idle-villager | P26 | queued | |
| P31 | Minimap | P24 P30 | queued | |
| P32 | VFX: muzzle, beams, ice burst, spore, selection ellipse | P23 | queued | |
| P33 | Audio (optional if time; do not fake wow with silence if VFX carry) | P32 | queued | |
| P34 | Empire presence: banners, bob, vents glow, nebula | P11 | queued | |
| P35 | Wave 3 integrator | P30–P34 | queued | |

### Wave 4 — performance / hardening

| ID | Piece | Status | Latest critic |
|---|---|---|---|
| P40 | 60fps under load: pools, culling, instance caps | queued | |
| P41 | iPad landscape QA (touch targets, safe area) | queued | |
| P42 | Bug sweep | queued | |

### Wave 5 — coherence

| ID | Piece | Status | Latest critic |
|---|---|---|---|
| P50 | Integrator plays full 1v1 vs AoE2:DE bar | queued | |

---

## Parallelism cap

Max **two** Composer builders at once (orchestrator must read every diff). Critics are serial per piece so verdicts stay clean. Integrators are serial.

---

## Current biggest gap (live)

**P46 PASS.** Next: **P47** Wave 2 match-arc critic vs AoE2:DE.
