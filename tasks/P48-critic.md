# P48 — Critic verdict (enemy fighter wave, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 — inbound pressure must feel like an **army**, not a scout timer · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p48-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/latest.png` (harness opening, tick ~117 — base camp framing; mid tableau verified via Playwright entity probes)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P48 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.3.3-wave2` | **Pass** — `0.3.4-wave2` |
| Fresh early: P41 tableau, no peel | **Pass** — tick **48**: Helion **8** living fighters, Kryos **2** living + **5** wrecks, **6** mid-map workers on gem; **0** enemy military `AttackMove`/`Attack` with `tid` = player Hall **359** |
| Tick ≥ 400: ≥ 6 enemy military committed on player Nexus, ≥ 4 Fighters | **Pass** — tick **400**: **9** living team-1 military `AttackMove` → Hall **359** — **4** Fighters + **5** Scouts, staggered from NE ~(39–60, 41–60) |
| Opening still Helion vs Kryos wrecks + mid gem | **Pass** — entity probes match P41 grammar at fresh load; harness HUD/resources unchanged |
| Harness p99 < 22 ms | **Pass** — p99 **6.4 ms**, 0 frames worse than 45 fps in 3 s probe |

By tick 400 the marshal peel has graduated from three lone Scouts to a nine-unit inbound column with four Fighters in the vanguard — enough mass on the Nexus to force defense, age timing, and counter-building. Opening tableau and zero early peel are preserved.

---

## Single biggest gap

**Inbound blob is still scout-heavy (#6 vs AoE2:DE).** Five of nine committed units are Scouts; only four are Fighters, with no siege or composition swing. Army pressure is real now, but it reads as a fast probe swarm with fighters attached, not yet the mixed arms stack that makes AoE2:DE defense interesting.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.4** |
| avgFrameMs | 1.66 |
| fps | 603 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.4-wave2` |
| Probe ents | 66 |
| Probe tick (opening harness) | 117 |
| Probe winner (opening) | **-1** |
| Teams pop (player) | **22/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright probes (live)

| Probe | Tick | Helion living | Kryos living | Kryos wrecks | Mid workers | Peel on Hall (mil) | Fighters peel |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fresh early | 48 | 8 | 2 | 5 | 6 | **0** | 0 |
| Settled | 120 | 8 | 0 | 0 | 6 | **0** | 0 |
| Threat (≥ 400) | 400 | 8 | 4 | 0 | 0 | **9** | **4** |

Late committed units (tick 400, all `AttackMove`, `tid=359`):

| id | kind | position | hp |
|---:|---|---|---:|
| 322 | Scout | (53.1, 56.0) | 32 |
| 324 | Scout | (42.8, 40.8) | 32 |
| 326 | Fighter | (60.5, 57.5) | 78 |
| 328 | Fighter | (58.4, 60.4) | 78 |
| 330 | Scout | (55.4, 52.7) | 32 |
| 332 | Fighter | (59.1, 56.1) | 78 |
| 334 | Fighter | (57.0, 59.0) | 78 |
| 336 | Scout | (41.0, 45.0) | 32 |
| 338 | Scout | (39.0, 43.0) | 24 |

---

## What passed

- **Army inbound (§6):** tick 400 delivers **9** living enemy military committed on the player Nexus, including **4** Fighters — clears the P47 “scout timer only” failure.
- **Opening tableau preserved:** fresh tick still reads Helion intact rank vs Kryos wreck belt with mid gem workers; **zero** marshal peel before the clash window.
- **Performance (§9 #5):** p99 well under 22 ms with fight entities live.
- **Version gate:** deploy ships `0.3.4-wave2`, past the `0.3.3-wave2` stall.
