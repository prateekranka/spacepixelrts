# P22 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p21-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Git context (log only):** latest ship commit `f3312ab` — *P21: two battle lines exchanging fire on the opening shot*

**Preview URL:** not measured — live matches current ship.

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Dense two-army clash fills the playfield | **Fail** — two small clumps in a mostly empty void; ~63% near-void pixels |
| Readable silhouettes at fight scale | **Pass** — green humanoid wing vs blue diamond wing are distinguishable |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, minimap, command tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **6.4 ms** (avg 2.52 ms, 397 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. P21 fixes the invisible-enemy regression from P20 — you can now see two opposing lines — but the opening tableau still reads as a sparse standoff across empty grid, not a packed mid-map brawl exchanging fire.

---

## Single biggest gap

The opening frame still does not read as **two armies exchanging fire that fill the playfield** — two undersized clumps (~6 vs ~5) stand off across a mostly bare void with only a couple of projectiles visible, not the dense 8v8 crossing fight DESIGN §6 promises.

**Three proofs:**

1. **DESIGN §6 tableau:** spec calls for **8 vs 8 Fighter clumps already AttackMoving through each other, plus one unique each**; the screenshot shows **~6 green humanoids left and ~5 blue diamonds right** with wide gaps between wings — units are not interpenetrating or crowding mid-map.
2. **Palette:** `#443355` (42.2%) + `#111122` (21.1%) = **63.3%** near-void pixels; combat occupies roughly the central **~25%** of the playfield while margins stay bare grid and fog diamonds.
3. **DESIGN §9.1:** you cannot tell **who is winning the mid fight in one second** — it reads as a cautious standoff with two stray green bolts, not an active exchange with visible casualties, pressure, or a clear victor.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.4** |
| avgFrameMs | 2.52 |
| fps | 397 (uncapped probe — not a fail) |
| framesWorseThan45fps | 1 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 52 |
| Probe tick | 121 |
| Teams pop | 14 / 16 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 56 |
| nonBlackPixelShare | 90.88% |
| distinctQuantizedColors | 353 |

---

## What passed

- **Two visible armies:** green humanoid silhouettes vs blue diamond craft — a clear improvement over P20's merged blob and HP-bar-only enemies.
- **Performance:** p99 well under 22 ms; one frame worse than 45 fps threshold in the 3 s probe (not a Wave 1 fail).
- **HUD:** resource strip, minimap with unit blips, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as an RTS command deck, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — standoff, not a readable brawl |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | Partial — two teams in probe; silhouettes differ but only two wings on screen |
| 4 | World looks like a place | **Fail** — purple void grid dominates; fight does not frame bases or economy |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — better battle lines, still not an impressive opening shot |
