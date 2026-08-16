# P18 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `node scripts/measure.mjs --url https://spacepixelrts.pages.dev --screenshot critic/out/p17-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; direct invocation above is the authoritative capture.)

**Screenshot reviewed:** `critic/out/p17-live.png` (live)

**Git context (log only):** latest ship commit `64906cf` — *P17: pack the opening clash so the first frame is a battle*

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Dense two-army clash fills the playfield | **Fail** — central blob + two giant black panels; >55% void grid |
| Readable silhouettes at fight scale | **Pass** — green vertical fighters vs blue diamond chevrons distinguishable when not merged |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, minimap, command tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **6.4 ms** (avg 2.35 ms, 425 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Performance and HUD are fine; the opening tableau still does not sell a packed mid-map brawl in frame one.

---

## Single biggest gap

Giant black ore-node panels and empty void grid still own the opening frame more than the armies, so it reads as a sparse grid demo with UI overlays—not AoE2:DE’s screen-filling first-shot battle.

**Three proofs:**

1. **Palette:** `#332244` (33.5%) + `#111122` (22.3%) = **55.8%** near-void pixels; combat sprites occupy roughly the central **~25%** of the playfield while margins stay bare grid (DESIGN §6 wants mid-map 8v8 clumps already crossing).
2. **Two oversized black squares** (~15% viewport width each) float over the fight with a single gem icon inside—visual weight exceeds the fighter clusters and breaks “world as place” (DESIGN §9.4).
3. **Probe reports 51 entities** but the screenshot shows **2–3 merged blobs** plus scattered singles—you cannot count eight-fighter wings or tell who is winning the mid fight in one second (DESIGN §9.1).

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.4** |
| avgFrameMs | 2.35 |
| fps | 425 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 51 |
| Probe tick | 122 |
| Teams pop | 10 / 12 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 48 |
| nonBlackPixelShare | 90.59% |
| distinctQuantizedColors | 260 |

---

## What passed

- **Silhouette:** green block fighters vs blue diamond fighters read as different shapes without relying on hue alone.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps threshold in the 3 s probe.
- **HUD:** resource strip, 160×160 minimap with viewport rect, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as an RTS command deck, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — merged blobs, no readable wing mass |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | Partial — two teams visible; not three civ roster |
| 4 | World looks like a place | **Fail** — grid + fog shadow; black panels break immersion |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — impressive frame budget, not an impressive battle shot |
