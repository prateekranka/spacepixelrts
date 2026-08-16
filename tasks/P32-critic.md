# P32 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p32-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Fail** — green hood rank (~6) and blue diamond rank (~7) face across center, but **no bolts, beams, muzzle flashes, or impact VFX** span the gap |
| Hold-fire ranks (not one stack) | **Partial** — wings sit on opposite sides of mid-map with a visible gap; counts fall short of §6’s 8v8+unique and green blobs overlap |
| Silhouettes readable at fight scale | **Partial** — blue diamonds read; green hood figures smear together at combat scale |
| Playfield feels like a place | **Fail** — repeating purple/tan/cyan glyph stripes fill the frustum; no dust, rock, or vent belt |
| Camp / workers / gems beside wing between HUD bars | **Partial** — bottom-left brown houses + ~3 blue workers sit apart from center; top-right dark mass + orange gems hug the Helion wing without a clean separated camp read |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.85 ms, 542 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Wing separation is real progress, but frame one still does not sell a mid-map duel exchanging fire on terrain I would inhabit — I would not keep playing this skirmish.

---

## Single biggest gap

The §6 opening tableau still fails to show two wings **exchanging fire** — green and blue ranks face off in center, but no readable projectiles or hit VFX cross the gap, so the wow shot is a frozen standoff on glyph flooring rather than the hold-Attack bolt duel AoE2 sells in frame one.

**Three proofs:**

1. **Screenshot combat:** between HUD bars, **~6 green hood figures** and **~7 blue diamonds** (red HP bars on blue) hold a mid gap, yet **zero bolt streaks, beams, muzzle pixels, or impact flashes** bridge the space — §6’s “exchange bolts across a gap” is absent.
2. **Screenshot camp vs wing:** bottom-left shows **two brown houses + ~3 blue worker diamonds** separated from center by open tiles (camp progress), but the **top-right Helion scrap** is a **dark orange/yellow smear** pressed against the green wing with no countable gather loop; §6’s same-frustum camp does not read as house + workers + gems apart from the fight.
3. **Metrics / palette:** `p99FrameMs` **4.1** passes the fps bar, but `probe.ents` **59**, palette top `#111122` at **19.7%**, and **avgLuminance 76** confirm the world is still void-and-glyph filler — not the varied dust/rock/vent belt §9.4 and §9.6 require to keep playing.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.85 |
| fps | 542 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.7-wave1` |
| Probe ents | 59 |
| Probe tick | 127 |
| Teams pop | 17 / 20 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 76 |
| nonBlackPixelShare | 95.34% |
| distinctQuantizedColors | 466 |

---

## What passed

- **Wing separation:** green and blue combat clusters occupy opposite sides of center with a visible gap — no longer a single overlap pile.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.
- **Bottom-left camp pocket:** brown structures and blue worker diamonds sit apart from the center fight, showing partial §6 camp placement.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — ranks face off but no exchange fire or readable hit feedback |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — glyph floor; camps do not sell dust-belt terrain |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — standoff on abstract tiles without combat VFX, not a skirmish I would stay in |
