# P49 — Critic verdict (mixed-arms inbound wave, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 — inbound pressure is a **mixed-arms army**, not a scout blob · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p49-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/latest.png` (harness opening, tick ~118 — base camp framing; mid tableau + late peel verified via Playwright entity probes)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P49 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.3.4-wave2` | **Pass** — `0.3.5-wave2` |
| Fresh early: P41 tableau, no peel | **Pass** — tick **48**: Helion **8** living fighters, Kryos **2** living + **5** wrecks, **9** mid-map workers on gem; **0** enemy military `AttackMove`/`Attack` with `tid` = player Hall **359** |
| Tick ≥ 420: ≥ 6 enemy military committed on player Nexus, ≥ 4 Fighters, ≥ 1 Siege | **Pass** — tick **420**: **13** living team-1 military `AttackMove` → Hall **359** — **8** Fighters + **2** Siege + **3** Scouts, staggered from NE ~(37–55, 41–57) |
| Opening still Helion vs Kryos wrecks + mid gem | **Pass** — entity probes match P41 grammar at fresh load; harness HUD/resources unchanged |
| Harness p99 < 22 ms | **Pass** — p99 **6.2 ms**, 0 frames worse than 45 fps in 3 s probe |

By tick 420 the marshal peel has graduated from zero early pressure to a thirteen-unit inbound column with eight Fighters and two Siege on the Nexus — mixed arms, not a scout timer. Opening tableau and zero early peel are preserved.

---

## Single biggest gap

**Three trailing Scouts still detach from the main body (#6 vs AoE2:DE).** The vanguard reads as a fighter–siege ball (8+2 committed on Hall 359), but Scouts at ~(37–40, 41–43) lag far behind and still feel like leftover probe noise rather than a coordinated combined-arms echelon.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.2** |
| avgFrameMs | 1.59 |
| fps | 627 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.5-wave2` |
| Probe ents | 66 |
| Probe tick (opening harness) | 118 |
| Probe winner (opening) | **-1** |
| Teams pop (player) | **22/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright probes (live)

| Probe | Tick | Helion living | Kryos living | Kryos wrecks | Mid workers | Peel on Hall (mil) | Fighters | Siege |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Fresh early | 48 | 8 | 2 | 5 | 9 | **0** | 0 | 0 |
| Settled | 120 | 8 | 0 | 0 | 9 | **0** | 0 | 0 |
| Threat (≥ 420) | 420 | 6 | 0 | 0 | 0 | **13** | **8** | **2** |

Late committed units (tick 420, all `AttackMove`, `tid=359`):

| id | kind | position | hp |
|---:|---|---|---:|
| 306 | Fighter | (55.2, 57.2) | 78 |
| 307 | Fighter | (49.6, 52.6) | 78 |
| 308 | Fighter | (53.4, 56.2) | 78 |
| 309 | Fighter | (54.1, 55.8) | 78 |
| 322 | Fighter | (48.4, 51.7) | 78 |
| 324 | Scout | (40.5, 38.5) | 32 |
| 326 | Siege | (51.7, 53.8) | 55 |
| 328 | Fighter | (52.0, 55.0) | 78 |
| 330 | Siege | (53.6, 55.1) | 55 |
| 332 | Fighter | (49.2, 52.1) | 78 |
| 334 | Fighter | (50.6, 53.6) | 78 |
| 336 | Scout | (38.8, 42.8) | 32 |
| 338 | Scout | (37.0, 41.2) | 15 |

---

## What passed

- **Mixed-arms inbound (§6):** tick 420 delivers **13** living enemy military committed on the player Nexus, including **8** Fighters and **2** Siege — clears the P48 “scout-heavy swarm, no siege” failure.
- **Opening tableau preserved:** fresh tick still reads Helion intact rank vs Kryos wreck belt with mid gem workers; **zero** marshal peel before the clash window.
- **Performance (§9 #5):** p99 well under 22 ms with fight entities live.
- **Version gate:** deploy ships `0.3.5-wave2`, past the `0.3.4-wave2` stall.
