# P51 — Critic verdict (muzzle + impact VFX, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §5.4 #5–7 — mid fight reads from **muzzle and impact**, not HP chrome · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p51-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture. Copied locally to `critic/out/p51-critic.png` for review — gitignored.)

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~121)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P51 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.3.5-wave2` | **Pass** — `0.4.0-wave3` |
| Exchange-belt sparks (muzzle and/or impact) visible in opening frame | **Pass** — orange/yellow impact burst sits in the Helion–Kryos wreck belt; bright hit flash sells the clash without relying on HP bars |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank clustered on central yellow gem; dark Kryos wreck blocks on the right/below; bottom-left worker + crates apart from the belt |
| Mid fight readable from VFX, not HP chrome | **Pass** — HUD shows “Nothing selected”; no selection/damage HP bar clutter on the exchange; impact flash alone marks where fire is landing |
| Harness p99 < 22 ms | **Pass** — p99 **2.9 ms**, 0 frames worse than 45 fps in 3 s probe |

At tick ~121 the wreck-belt duel reads from a bright impact flash in the contact zone — AoE2-style “where are they hitting?” without leaning on HP chrome.

---

## Single biggest gap

**Projectile travel is still easy to miss in a single harness frame (#5 vs AoE2:DE).** The impact burst carries the exchange read, but 1–2 frame muzzle pixels and in-flight streaks are subtler than the flash — a paused screenshot sells hits more than sustained bolt rhythm.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **2.9** |
| avgFrameMs | 1.36 |
| fps | 738 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.0-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 121 |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## What passed

- **Impact flash (§5.4 #5):** bright orange/yellow burst visible in the exchange belt between Helion fighters and Kryos wreck line — hit location is obvious in frame one.
- **VFX over HP chrome (§5.4 #3/#7):** unselected mid-fight; combat legibility comes from the spark, not bar spam.
- **Tableau preserved:** P41 grammar intact — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket.
- **Performance (§9 #5):** p99 well under 22 ms with VFX live.
- **Version gate:** deploy ships `0.4.0-wave3`, past the `0.3.5-wave2` stall.
