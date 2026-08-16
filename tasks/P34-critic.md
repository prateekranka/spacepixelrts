# P34 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p34-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with visible orange/cyan bolts in a real gap | **Fail** — ~7 blue diamonds (bottom-left) and ~5–6 green hoods (upper-center) face across open tiles, but mid-gap orange/cyan rectangles are the **same shape and palette as HP bars**, not readable projectile streaks |
| Silhouettes not eaten by HP chrome | **Fail** — every fighter wears a full-width orange HP bar nearly as wide as the hull; wings are not countable at a glance |
| Some camp scrap | **Partial** — top-right dark structure + orange gem cluster; bottom-left brown pads with blue worker diamonds apart from center |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.88 ms, 532 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Wing separation and gap geometry improved, but frame one still does not sell a hold-Attack bolt duel on terrain I would inhabit — I would not keep playing this skirmish.

---

## Single biggest gap

The §6 opening tableau still fails to show two wings **exchanging readable fire** — mid-gap orange/cyan bars are visually identical to fighter HP chrome, so the wow shot reads as floating UI debris between ranks, not bolts bridging a gap.

**Three proofs:**

1. **Screenshot combat:** between HUD bars, one cyan vertical bar and several orange horizontal bars float in the gap (~x 430–510), yet they match the **same 1×N orange/cyan bar grammar** as the HP strips above every unit — no muzzle pixel, streak motion, or impact flash that AoE2 sells in frame one.
2. **Screenshot silhouettes / chrome:** each blue diamond and green hood is capped by an **orange HP bar ~as wide as the sprite**, so individual fighters are not countable and silhouettes are eaten by chrome — not §5.4 “readable at zoom 2 without chrome.”
3. **Metrics / world read:** `p99FrameMs` **4.1** passes the fps bar, but palette top `#111122` at **19.9%** and repeating purple/tan/cyan starburst flooring confirm the frustum is still abstract glyph fill — `probe.ents` **58** at tick **123** with wings short of §6’s 8v8+unique and no mid-fight VFX layer the harness can distinguish from UI.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.88 |
| fps | 532 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.9-wave1` |
| Probe ents | 58 |
| Probe tick | 123 |
| Teams pop | 16 / 20 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 75 |
| nonBlackPixelShare | 95% |
| distinctQuantizedColors | 428 |

---

## What passed

- **Wing separation:** blue and green combat clusters occupy opposite sides of center with a visible gap — no longer a single overlap pile.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.
- **Camp hints:** top-right scrap/gem cluster and bottom-left worker pocket give partial §6 camp read away from the center duel.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — ranks face off but gap “bolts” read as HP-bar clones; no exchange-fire or hit feedback |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — starburst glyph floor; terrain does not sell a dust-belt skirmish |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — abstract tiles + ambiguous gap VFX; not a skirmish I would stay in |
