# P33 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p33-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Fail** — blue-leaning left and green-leaning right hints exist, but combat mass sits in center with **no bolt streaks, muzzle pixels, or impact VFX** in the gap |
| Hold-fire ranks (not one stack) | **Fail** — center band is the densest unit pile (highest white + green share); ranks read as merged mid-fight, not two facing lines holding across a gap |
| Silhouettes readable at fight scale | **Fail** — white triangular hulls are drowned by same-size white HP/selection chrome; wings are not countable at a glance |
| Playfield feels like a place | **Fail** — repeating yellow/purple/cyan starburst tiles fill the frustum; no readable dust, rock, or vent belt |
| Camp / workers / gems beside wing between HUD bars | **Partial** — upper-right orange gem/scrap cluster reads; no clear house + worker gather loop separated from the center brawl |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.85 ms, 539 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Frame one is still a noisy glyph arena with a smeared center melee and zero readable opening bolt duel — I would not keep playing this skirmish.

---

## Single biggest gap

The §6 opening tableau still fails to show two wings **exchanging fire** — combatants overlap in center with no readable bolt or muzzle pixels bridging the gap, so P33’s “unmissable streaks” bar is unmet and the wow shot remains a chrome-heavy scrum on abstract flooring.

**Three proofs:**

1. **Screenshot combat:** between HUD bars, white/green unit pixels span the midline (≈x 410–530) as one continuous cluster; **no yellow/cyan streak, muzzle flash, or impact pixels** cross the space where §6 demands hold-Attack bolts.
2. **Screenshot silhouettes / chrome:** each fighter is a small white triangle capped by a **white HP bar nearly as wide as the hull**, so individual wings are not countable and silhouettes are eaten by UI chrome — not AoE2-readable ranks.
3. **Metrics / pixel scan:** `p99FrameMs` **4.1** passes the fps bar, but center-gap sampling finds **0 bolt-colored pixels** (all orange “streak” pixels sit top-right scrap, not mid-fight); `probe.ents` **58** at tick **123** with center-band green **17.4%** (highest of left/center/right) confirms factions interleaved in one pile, not separated duelists.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.85 |
| fps | 539 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.8-wave1` |
| Probe ents | 58 |
| Probe tick | 123 |
| Teams pop | 16 / 20 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 81 |
| nonBlackPixelShare | 94.85% |
| distinctQuantizedColors | 457 |

---

## What passed

- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.
- **Scrap hint:** upper-right orange/yellow gem cluster gives a partial camp/resource read away from the bottom HUD bars.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — merged center pile; no exchange fire or hit feedback |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue vs green tint reads; third civ not shown |
| 4 | World looks like a place | **Fail** — starburst glyph floor; terrain does not sell a dust-belt skirmish |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — abstract tiles + unreadable opening duel; not a skirmish I would stay in |
