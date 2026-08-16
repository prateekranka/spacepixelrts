# P27 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p27-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Pass** — green hooded rank (~8) faces blue diamond rank (~9–10) across a gap; yellow muzzle flashes between lines |
| Hold-fire ranks (not one stack) | **Pass** — diagonal wings on opposing screen halves; no central overlap pile |
| Silhouettes readable at fight scale | **Partial** — civ shapes differ (green mass vs blue diamond), but units are small on a bare grid |
| Playfield feels like a place | **Fail** — dotted void grid dominates; no dust pads, rock, ore/gas/solar nodes, or bases in the frustum |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker pulse, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.91 ms, 524 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. The hold-fire tableau finally reads as two armies, but the camera still frames a sparse shader void — not a mid-map belt you would rule or keep playing.

---

## Single biggest gap

The opening tableau still does not read as a **place worth commanding** — dust, rock, resource nodes, and base pads do not fill the frustum around the ranks, so the fight floats on an empty grid instead of a inhabited skirmish map.

**Three proofs:**

1. **DESIGN §6 tableau:** spec requires dust/rock/gems to **fill the frustum** while two facing ranks exchange bolts; the screenshot is **~75% bare void** (`#665588` 51.7% + `#111122` 23.2% palette share) with only faint edge silhouettes — no readable ore patches, vents, cleared pads, or Nexus footprints framing the engagement.
2. **Screenshot geometry:** both wings occupy a **narrow central diagonal** (~25–30% of canvas); top, bottom, and side margins are uninterrupted dotted grid — the playfield is still a postage stamp, not a 64×64 belt that fills the camera.
3. **DESIGN §9.4 / §9.6:** you would not **keep playing** from this shot — minimap blips hint at a world off-screen, but the main view has no empire presence (no workers, structures, or economy in frame), so it still feels like a combat tech demo rather than AoE2’s “I am marshal of this map.”

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.91 |
| fps | 524 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.2-wave1` |
| Probe ents | 50 |
| Probe tick | 123 |
| Teams pop | 14 / 16 (cap 15) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 77 |
| nonBlackPixelShare | 95.11% |
| distinctQuantizedColors | 287 |

---

## What passed

- **Hold-fire ranks:** two separated wings with visible exchange fire — meets §6’s “not one overlap pile” and “hold `Ord.Attack` in place” intent.
- **Battle legibility vs P26:** individual sprites are countable in rank formation; blue team shows HP bars without the orphan-bar pile artifact.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker pulse) — reads as RTS command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and HP bars readable; no clear casualty pressure or front-line collapse yet |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — two distinct silhouettes on screen; third civ not shown |
| 4 | World looks like a place | **Fail** — void grid dominates; terrain and economy absent from main view |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — readable skirmish, not a world I would stay in |
