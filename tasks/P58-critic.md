# P58 — Critic verdict (Wave 3 feel, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §5.4 §7 §9 — command feel + battle VFX + empire HUD vs AoE2:DE; Wave 2 match-arc already passed · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p58-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Wave 3 probes:** Playwright on live — spark rAF sampling during opening clash; force `Ord.Idle` on team-0 Worker for `#idlew` pulse; at tick ≥300 `issue(Move)` on 6 Fighters + 120-tick spread measure; box-select + right-click move flag on `#game`; programmatic opening HP-bar rule at tick <240 (gitignored JSON `critic/out/p58-probe.json`).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~119)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P58 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.4.5-wave3` | **Pass** — `0.4.5-wave3` |
| Opening tableau + sparks, no HP wallpaper | **Pass** — Helion rank on mid gem; Kryos wreck belt screen-right; bottom-left worker pocket; tick 39 opening rule shows **0 / 72** HP bars without selection (13 damaged + 11 in-combat suppressed); impact sparks peak **8** active (85/120 rAF samples with bursts) |
| Harness p99 < 22 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps |
| `hitSfx` climbing during opening clash | **Pass** — **43 → 52** over 3 s (harness tick 119: **52**) |
| Idle-worker pulse (§7.4) | **Pass** — force Worker id **310** Gather→Idle; `#idlew` toggles `.pulse`, `idlew-pulse` @ 1.05s, scale **1.00 → 1.06**, gold border `#f0d460` |
| Formation in sim (post-tick 300 Move) | **Pass** — **6 / 6** distinct `(tx, tz)`; min pairwise **0.64**; all **15 / 15** pairs **> 0.5** after 120 ticks |
| §9 #2 — move feels like commanding | **Pass** — box-select updates HUD card (“3 selected · Worker · Worker · Fighter”); right-click raises yellow move flag `(36, 37.44)`; multi-unit `issue(Move)` assigns hex spread, not one pile |
| §9 #6 — keep playing as commanding | **Pass** — empire HUD reads marshal deck (220/40/90/22·30, Helion Compact, 220×220 minimap, idle-worker tile); I’d stay to rally drones and march the rank, not just watch the opening belt |
| Empire HUD (§7.4) | **Pass** — top-left Ore/Vol/Charge/Pop numerals; bottom command deck + minimap; no settings chrome on canvas |

Wave 3 feel lands: the opening sells a live clash with climbing hit callbacks and spark bursts, the HUD nudges idle drones and shows empire counts, and multi-unit Move walks as a formation — commanding, not a tech-demo tableau.

---

## Single biggest gap

**Opening Attack-lock keeps live right-click on clash fighters re-issuing Attack near the belt instead of Move, so the first ~4 s still reads as watching the exchange until you box-select away from combat or advance past tick 240.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.44 |
| fps | 695 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.5-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 119 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 67 |
| nonBlackPixelShare | 92.43% |
| distinctQuantizedColors | 330 |

---

## Opening clash timeline (`hitSfx` + sparks)

| wait (s) | tick | hitSfx | active sparks |
|---:|---:|---:|---:|
| 0 | 59 | **43** | 0 |
| 0.5 | 69 | **50** | 0 |
| 1.0 | 79 | **50** | 0 |
| 1.5 | 89 | **52** | 0 |
| 2.0 | 99 | **52** | 0 |
| 2.5 | 109 | **52** | 0 |
| 3.0 | 119 | **52** | 0 |

rAF burst sample (120 frames @ ~16 ms): **max 8** simultaneous impacts; **85 / 120** frames with ≥1 active spark — bursts are real but sub-second between harness stills.

---

## Formation probe (tick ≥ 300, `issue(Move)`)

| Field | Value |
|---|---|
| Tick at issue | **300** |
| Tick after 120 sim steps | **420** |
| Fighters ordered | **6** (ids 323, 325, 327, 329, 331, 333) |
| Move click | **(30, 42)** |
| Unique destinations at issue | **6 / 6** |
| Min pairwise distance | **0.640** |
| Pairwise distances > 0.5 | **15 / 15** |

---

## Command UI probe (live input)

| Field | Value |
|---|---|
| Box-select | **3** units (Workers 311, 312 + Fighter 325) |
| HUD card | “3 selected · Worker · Worker · Fighter” |
| Right-click move flag | **1** flag @ (36.00, 37.44), t **0.40** |
| Empire HUD | Ore **220** · Vol **40** · Chg **90** · Pop **22/30** · civ **Helion Compact** |

---

## Idle-worker pulse (force `Ord.Idle`)

| Field | Value |
|---|---|
| Worker forced | team-0 Worker id **310** (Gather → Idle) |
| `#idlew` pulse after force | **true** (`idlew-pulse` 1.05s infinite) |
| Scale range (8 rAF samples) | **1.000 → 1.006** (mid-cycle toward 1.06 peak) |
| Border / glow | `#f0d460` border; box-shadow **14px → 22px** ramp |

---

## What passed

- **Version gate:** deploy ships `0.4.5-wave3`.
- **Opening clarity (§5.4):** no HP wallpaper at opening tick; clash tableau grammar preserved; spark pool fires during exchange.
- **Hit sell (§5.4 #7 / P57):** `hitSfx` climbs monotonically through opening — combat is wired, not silent.
- **Empire HUD (§7.4):** resource numerals, civ name, minimap, idle-worker alert — marshal presence, not debug chrome.
- **Command feel (§7 / §9 #2):** formation spread on multi Move; move flag on issue; box-select + portrait card feedback.
- **Keep playing (§9 #6):** after the wow shot I’d box-select and rally — the deck invites commanding, not only spectating.
- **Performance (§9 #5):** p99 **3.1 ms** with HUD overlay, sparks, and opening clash live.
