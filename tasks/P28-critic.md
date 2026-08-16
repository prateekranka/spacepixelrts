# P28 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p28-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Pass** — blue diamond rank (~9) faces green hooded rank (~7–8) across a gap; yellow muzzle flashes between the lines |
| Hold-fire ranks (not one stack) | **Pass** — wings on opposing screen halves with a clear gap; no central overlap pile |
| Silhouettes readable at fight scale | **Partial** — civ shapes differ (green mass vs blue diamond), but combatants stay small on a flat mat |
| Playfield feels like a place | **Fail** — repeating purple floor tile fills the frustum; almost no dust/rock variation, only two lone gems, no workers gathering in view |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.2 ms** (avg 1.89 ms, 528 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. The hold-fire tableau finally reads as two armies trading shots, but the camera still frames a sterile purple plate — not a mid-map belt with economy and terrain I would rule or keep playing.

---

## Single biggest gap

The opening frustum still does not read as an **inhabited skirmish place** — a uniform purple tile mat and two isolated gems frame the fight without visible workers, varied dust/rock, or camp economy in the belt I am meant to command.

**Three proofs:**

1. **DESIGN §6 tableau:** spec requires varied dust/rock, readable gems, and a scrap of camp (house + workers gathering) filling the frustum; the screenshot shows **one repeating purple metal texture** edge-to-edge with only **two yellow gems** (center-left and far-right) — no ore patches, rock breaks, cleared pads, or gatherers on screen.
2. **Screenshot economy:** probe reports **17/20 pop** and ore **220**, but the main view shows **only combat lines and two hero silhouettes** — no idle-worker pulse in action, no villager silhouettes at nodes, no Nexus footprint or production pad anchoring either flank; the empire lives off-screen or in the minimap, not in the opening shot.
3. **Palette / metrics:** top quantized colors remain void purples (`#111122` 22.6%, `#554466` 20.9%, `#444455` 9.5%) with **avg luminance 71** — the frustum is still ~43% undifferentiated dark floor, not the readable terrain belt AoE2 sells in frame one.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.2** |
| avgFrameMs | 1.89 |
| fps | 528 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.3-wave1` |
| Probe ents | 59 |
| Probe tick | 123 |
| Teams pop | 17 / 16 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 71 |
| nonBlackPixelShare | 93.71% |
| distinctQuantizedColors | 316 |

---

## What passed

- **Hold-fire ranks:** two separated wings with visible exchange fire — meets §6’s “not one overlap pile” and “hold `Ord.Attack` in place” intent.
- **Silhouettes:** blue diamond fighters vs green hooded fighters are distinguishable at fight scale; each rank member is countable.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and HP bars readable; no clear casualty pressure or front-line collapse yet |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — two distinct silhouettes on screen; third civ not shown |
| 4 | World looks like a place | **Fail** — textured floor is uniform; terrain variation and economy absent from main view |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — readable skirmish, not a world I would stay in |
