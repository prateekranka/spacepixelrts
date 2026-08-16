# P52 — Critic verdict (death dissolve + corpse stain, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §5.4 #6 — death is 2-frame dissolve → corpse stain ~1.5s → gone, not pop-out · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p52-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Death probe:** Playwright on live — force-kill living Helion Fighter via `__STARHOLD_WORLD__.kill()`, sample `dissolveT` / `corpseT` / atlas frame over ~2s, screenshot `critic/out/p52-death.png` (gitignored).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~120) · `critic/out/p52-death.png` (post-kill stain)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P52 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.4.0-wave3` | **Pass** — `0.4.1-wave3` |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank on central yellow gem; Kryos wreck blocks on the right; bottom-left worker + crates apart from the belt |
| Force-kill living unit via `__STARHOLD_WORLD__` | **Pass** — Helion Fighter id 323 at (36.7, 37.3); not a pre-placed wreck |
| 2-frame dissolve (not instant vanish) | **Pass** — `dissolveT` 0.1 → 0.05 → 0; atlas frames **5 → 6** over ~100 ms |
| Corpse stain ~1.5s then gone | **Pass** — `corpseT` 1.5 → 0; frame **4** stain holds ~1.5s; `alive: false` at ~1.95s |
| Harness p99 < 22 ms | **Pass** — opening p99 **3.1 ms**; post-death probe p99 **18.6 ms**; 0 frames worse than 45 fps |

Forced kill on live deploy walks the full §5.4 #6 pipeline — dissolve frames 5 and 6, then a readable dark corpse stain on the dust, then slot freed — no pop-out.

---

## Single biggest gap

**The dissolve window is only ~100 ms (two sim ticks), so a single paused screenshot almost always lands on the stain, not the dissolve frames.** The sequence is correct and measurable in harness, but harder to *see* than AoE2:DE's longer death read without stepping frames.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs (opening) | **3.1** |
| p99FrameMs (post-death probe) | **18.6** |
| avgFrameMs | 1.44 |
| fps | 697 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.1-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 120 |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Death probe (force-kill)

| Phase | dissolveT | corpseT | Frame | alive |
|---|---:|---:|---:|---|
| t0 immediate | 0.10 | 1.50 | **5** | yes |
| t2 ~50 ms | 0.05 | 1.50 | **6** | yes |
| t3 ~150 ms | 0.00 | 1.45 | **4** (stain) | yes |
| t5 ~1950 ms | 0.00 | ~0 | — | **no** |

Victim: team-0 Fighter, `hp` 71.6 → 0 via `world.kill()`; entity remained visible through dissolve + stain, then freed.

---

## What passed

- **Version gate:** deploy ships `0.4.1-wave3`, past the `0.4.0-wave3` stall.
- **Dissolve (§5.4 #6):** two atlas dissolve frames (5 then 6) before stain; no instant despawn.
- **Corpse stain:** frame 4 dark smudge persists ~1.5s on live screenshot and in `corpseT` countdown.
- **Cleanup:** slot freed (`alive: false`) after stain duration — not a permanent clutter pile.
- **Tableau preserved:** P41 grammar intact — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket.
- **Performance (§9 #5):** p99 under 22 ms on opening and post-death probes.
