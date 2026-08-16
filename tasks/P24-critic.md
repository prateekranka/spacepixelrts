# P24 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p23-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Git context (log only):** latest ship commit `6a14006` — *P23: packed crossing brawl on the opening shot*

**Preview URL:** not measured — live matches current ship.

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Dense two-army clash fills the playfield | **Fail** — ~5 green sprites stacked on the left, one blue diamond on the right, floating HP bars in empty mid-map; void grid dominates |
| Mixing colors in combat | **Fail** — purple void + one green wing + one blue unit; almost no interleaved team colors mid-map |
| Lots of fire | **Fail** — one yellow impact bolt; no sustained muzzle flashes, beams, or splash across the contact line |
| Readable silhouettes at fight scale | **Partial** — green humanoid vs blue diamond read when visible, but bodies do not match the HP-bar count and wings never cross |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker pulse, minimap, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **5.8 ms** (avg 2.01 ms, 498 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Performance and HUD are fine; the opening tableau still reads as a sparse standoff across empty grid, not a packed mid-map brawl exchanging fire.

---

## Single biggest gap

The opening frame still does not read as **two armies exchanging fire that fill the playfield** — a short green stack and a lone blue diamond face each other across mostly bare void with disconnected HP bars and a single projectile, not the dense 8v8 crossing fight DESIGN §6 promises.

**Three proofs:**

1. **DESIGN §6 tableau:** spec calls for **8 vs 8 Fighter clumps already AttackMoving through each other, plus one unique each**; the screenshot shows **~5 overlapping green humanoids upper-left, one blue diamond lower-right**, and **six orange HP bars floating in mid-map with no bodies underneath** — wings are not interpenetrating and entity count on screen does not match the probe’s 47 ents.
2. **Palette:** `#444466` (49.5%) + `#111122` (22.2%) = **71.7%** near-void pixels; combat occupies roughly the central **~20%** band while margins stay bare grid and fog diamonds — the playfield is not “filled.”
3. **DESIGN §9.1:** you cannot tell **who is winning the mid fight in one second** — it reads as a cautious standoff with orphan HP bars and one stray bolt, not an active exchange with visible casualties, pressure, or a clear victor.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **5.8** |
| avgFrameMs | 2.01 |
| fps | 498 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 47 |
| Probe tick | 123 |
| Teams pop | 12 / 14 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 62 |
| nonBlackPixelShare | 95.84% |
| distinctQuantizedColors | 329 |

---

## What passed

- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap with blips, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as an RTS command deck, not a debug overlay.
- **Silhouette language (when visible):** green humanoid wing vs blue diamond craft are distinguishable at a glance.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — standoff with orphan HP bars, not a readable brawl |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | Partial — two teams in probe; only two silhouettes on screen |
| 4 | World looks like a place | **Fail** — purple void grid dominates; fight does not frame bases, vents, or economy |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — not an impressive opening shot; still a tech-demo tableau |
