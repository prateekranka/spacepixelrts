# P20 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p19-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Git context (log only):** latest ship commit `c576b23` — *P19: draw resource nodes as gems, not black panels*

**Preview URL:** not measured — live matches current ship; giant black ore panels are gone.

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Dense two-army clash fills the playfield | **Fail** — one central green blob + invisible enemies; >60% void grid |
| No giant UI-like panels over units | **Pass** — P19 gem nodes fixed the black-square overlays |
| Readable silhouettes at fight scale | **Fail** — friendly mass merges into one shape; enemy units are HP bars only |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, minimap, command tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **8.7 ms** (avg 4.15 ms, 241 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. The gem-node fix clears a blocker from P18, but the opening tableau still does not sell a packed mid-map brawl in frame one.

---

## Single biggest gap

The opening frame still does not read as a dense, screen-filling clash between two armies — one merged friendly blob in a mostly empty void, with enemies reduced to floating HP bars instead of readable opposing silhouettes crossing mid-map.

**Three proofs:**

1. **DESIGN §6 tableau:** spec calls for **8 vs 8 Fighter clumps already AttackMoving through each other, plus one unique each**; the screenshot shows **one central green mass** and **~4 red HP bars** with no visible enemy wing — not two crossing armies.
2. **Palette:** `#332244` (41.5%) + `#111122` (23%) = **64.5%** near-void pixels; combat occupies roughly the central **~20%** of the playfield while margins stay bare grid and fog diamonds.
3. **DESIGN §9.1:** you cannot tell **who is winning the mid fight in one second** — the friendly cluster reads as a single amorphous blob and opposing units are indistinguishable from the void except for 1px health bars (P17 at least showed a blue diamond wing).

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **8.7** |
| avgFrameMs | 4.15 |
| fps | 241 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.0-wave1` |
| Probe ents | 47 |
| Probe tick | 121 |
| Teams pop | 11 / 13 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 47 |
| nonBlackPixelShare | 97.21% |
| distinctQuantizedColors | 258 |

---

## What passed

- **Gem nodes:** resource pickups render as small colored gems on the field — no giant black panels over the fight (P19 fix verified on live).
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps threshold in the 3 s probe.
- **HUD:** resource strip, 160×160 minimap with viewport rect, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as an RTS command deck, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — merged blob vs invisible enemies |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | Partial — two teams in probe; only one army visible on screen |
| 4 | World looks like a place | **Fail** — purple void grid dominates; fight does not frame bases or economy |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — cleaner nodes, still not an impressive battle shot |
