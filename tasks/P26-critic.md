# P26 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p25-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Git context (log only):** latest ship commit `757000b` — *P25: put both wings on the camera depth plane*

**Preview URL:** not measured — live matches current ship.

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Both armies visible in the same shot | **Partial** — green and blue pixels share one central cluster; no separated wings framing the fight |
| Mixing / fighting | **Partial** — team colors interleave in the pile, but no sustained bolts, impacts, or readable contact line |
| Fills the playfield | **Fail** — one ~15–20% overlap blob mid-map; void grid and fog diamonds dominate margins |
| Readable silhouettes at fight scale | **Fail** — stacked bodies collapse into a single dark mass; individual fighters and uniques are not countable |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker pulse, minimap, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.6 ms** (avg 1.94 ms, 516 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. P25’s depth-plane fix keeps both colors in frame, but the opening tableau still reads as a tiny central pile on an empty void — not a mid-map brawl that fills the camera and reads in silhouette.

---

## Single biggest gap

The opening clash still does not read as **two armies fighting across a filled playfield with readable silhouettes** — both wings collapsed into one overlap stack while orphan HP bars float in empty space to the east.

**Three proofs:**

1. **DESIGN §6 tableau:** spec calls for **8 vs 8 Fighter clumps already AttackMoving through each other, plus one unique each**; the screenshot shows **one dense green/blue blob (~10–12 overlapping sprites)** and **six red HP bars floating right of the pile with no bodies underneath** — you cannot verify 16 fighters + 2 uniques on screen, and the wings are not spread across mid-map as a crossing brawl.
2. **Palette / fill:** `#444466` (54.8%) + `#111122` (22.4%) = **77.2%** near-void pixels; combat occupies roughly the central **~20%** band while top/bottom/side margins stay bare grid and resource orbs — the playfield is not filled.
3. **DESIGN §9.1:** you cannot tell **who is winning the mid fight in one second** — it reads as an unreadable stack with disconnected damage chrome, not an active exchange with visible pressure, casualties, or a clear victor.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.6** |
| avgFrameMs | 1.94 |
| fps | 516 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 50 |
| Probe tick | 123 |
| Teams pop | 15 / 15 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 60 |
| nonBlackPixelShare | 94.97% |
| distinctQuantizedColors | 363 |

---

## What passed

- **Both colors in frame:** green humanoid mass and blue diamond accents share the same depth plane — improvement over P24’s lone far-wing diamond.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap with blips, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as an RTS command deck, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — overlap blob + orphan HP bars, not a readable brawl |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | Partial — probe lists two civs; on screen only two silhouettes in one pile |
| 4 | World looks like a place | **Fail** — purple void grid dominates; fight does not frame bases, vents, or economy |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — not an impressive opening shot; still a tech-demo tableau |
