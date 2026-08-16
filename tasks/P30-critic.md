# P30 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p30-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Pass** — blue diamond rank (~8) trades bolts with green hooded rank (~8–9); muzzle flashes visible in the mid gap |
| Hold-fire ranks (not one stack) | **Pass** — wings on opposing screen halves with a clear gap; no central overlap pile |
| Silhouettes readable at fight scale | **Partial** — green mass vs blue diamond reads at a glance, but combatants stay small on glyph tiles |
| Playfield feels like a place | **Fail** — repeating star/wave/hatch purple floor still fills the frustum; one corner crag does not sell a dust-belt skirmish |
| Camp / workers / gems beside wing between HUD bars | **Fail** — orange house + yellow gems appear beside the green wing upper-right, but **no worker silhouettes** gather anywhere in the opening belt |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.3 ms** (avg 1.86 ms, 537 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. The beside-rank house and gems are a step forward, but I would not keep playing a skirmish that still frames a patterned duel plate with no visible gather loop in the belt I am meant to rule.

---

## Single biggest gap

The §6 beside-rank camp still has no readable workers gathering at gems in the opening frustum, so the wow shot remains a hold-fire exchange on abstract tiles rather than an inhabited skirmish place with economy beside the fight.

**Three proofs:**

1. **Screenshot economy:** probe pop is **17/20** and ore **220**, but the playfield between the resource strip and command deck shows **only two combat wedges** plus a corner house — **zero worker silhouettes** at yellow gems or vents anywhere in frame.
2. **Screenshot beside-rank camp:** the upper-right tableau beside the green wing shows an **orange diamond house** and **clustered yellow gems**, but no villager figures, carry animation, or Nexus-radius pad — §6’s “house + workers gathering” scrap is still half-missing.
3. **Metrics / palette:** `p99FrameMs` **4.3** passes the fps bar, but `probe.ents` **60** and palette top color `#111122` at **19.9%** with **avgLuminance 75** confirm the frustum is still void-and-glyph filler, not the varied dust/rock/vent belt AoE2 sells in frame one (§9.4, §9.6).

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.3** |
| avgFrameMs | 1.86 |
| fps | 537 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.5-wave1` |
| Probe ents | 60 |
| Probe tick | 123 |
| Teams pop | 17 / 18 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 75 |
| nonBlackPixelShare | 93.96% |
| distinctQuantizedColors | 387 |

---

## What passed

- **Hold-fire ranks:** two separated wings with visible exchange fire — meets §6’s “not one overlap pile” and “hold `Ord.Attack` in place” intent.
- **Silhouettes:** blue diamond fighters vs green hooded fighters are distinguishable; each rank member is roughly countable.
- **Beside-rank structure:** orange house and yellow gems now sit beside the green wing in the playfield — partial progress on §6 camp placement.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and HP bars readable; no clear casualty pressure or front-line collapse yet |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — two distinct silhouettes on screen; third civ not shown |
| 4 | World looks like a place | **Fail** — glyph floor and corner crag; gather loop still absent from main view |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — readable skirmish, not a world I would stay in |
