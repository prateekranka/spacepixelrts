# P61 — Critic verdict (viewport culling, live)

**Critic:** fresh blind run · **Bar:** `docs/ARCHITECTURE.md` §8 — off-screen units must not inflate instance uploads; opening tableau must still draw · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p61-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Cull probes:** `node scripts/p60-probe.mjs --url https://spacepixelrts.pages.dev` (gitignored JSON `critic/out/p60-probe.json`).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~119)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P61 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.5.1-wave4` | **Pass** — `0.5.1-wave4` |
| Opening tableau + sparks, no HP wallpaper | **Pass** — Helion rank on mid gem; Kryos wreck belt screen-right; bottom-left worker pocket; tick 48 opening rule **0** HP bars would show (12 damaged, all in-combat suppressed); **2** active sparks at probe sample |
| Harness p99 < 22 ms | **Pass** — p99 **4.6 ms**, 0 frames worse than 45 fps |
| `rendererInfo.drawn` > 20 (clash not culled empty) | **Pass** — harness **32**; probe opening **44** |
| Off-screen horde (≥180 Fighters @ `(4,4)`, camera on look-at) | **Pass** — opening `drawn` **44** → after horde **32** (Δ **−12**, within ~30 band); **180** spawned, **246** alive |
| On-screen horde (≥180 Fighters @ look-at) | **Pass** — opening `drawn` **46** → after horde **218** (Δ **+172**, ≥ 80) |
| Screenshot — opening clash readable | **Pass** — rank, gem, wrecks, and worker pocket all visible; no missing edge sprites in frame |

Viewport culling works: off-screen fighters do not inflate instance uploads, while on-screen spawns correctly raise `drawn`; the opening wow tableau still draws and performs well.

---

## Single biggest gap

**Off-screen hordes still inflate sim entity count and spatial-hash work (246 alive after NW spawn) — culling protects the §8 instance-upload slice, not tick cost from invisible armies.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.6** |
| avgFrameMs | 1.98 |
| fps | 506 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.5.1-wave4` |
| Probe ents | 66 |
| Probe tick (opening harness) | 119 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.calls` | 6 |
| Probe `rendererInfo.tris` | 452 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 69 |
| nonBlackPixelShare | 93.32% |
| distinctQuantizedColors | 352 |

---

## P60 cull probe

| Probe | opening `drawn` | after horde `drawn` | Δ | Pass |
|---|---:|---:|---:|---|
| Opening tableau | **44** | — | — | tableau + sparks + `drawn` > 20 |
| Off-screen @ `(4,4)` | **44** | **32** | **−12** | within ~30 |
| On-screen @ look-at `(36, 37.44)` | **46** | **218** | **+172** | ≥ 80 |

| Probe | p99FrameMs | framesWorseThan45fps |
|---|---:|---:|
| Opening | **4.6** | 0 |
| Off-screen + sim step | **4.6** | 0 |
| On-screen + sim step | **4.0** | 0 |

---

## What passed

- **Version gate:** deploy ships `0.5.1-wave4`.
- **Opening preserved:** Helion rank vs Kryos wrecks + mid gem; no HP wallpaper at opening tick; clash still reads as a live fight.
- **Cull off-screen:** 180 fighters at NW corner do not push `drawn` past opening band — instance uploads stay bounded.
- **Cull on-screen:** 180 fighters at camera look-at raise `drawn` by **+172** — visible units still upload.
- **Performance (§8):** p99 **4.6 ms** with HUD, sparks, and opening clash live; off-screen horde does not spike frame time.
- **Screenshot:** opening tableau readable; edge sprites in frame are present, not over-culled.
