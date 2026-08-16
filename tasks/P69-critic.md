# P69 — Critic verdict (civ picker / Nihiline on canvas, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §2 §9 #3 — three civs are different peoples, not recolors; default boot must still be the locked Helion vs Kryos opening (P41) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p69-default.png --fps-seconds 3 --wait 3`

**Probes (live):** `node scripts/p68-probe.mjs --url https://spacepixelrts.pages.dev` — gitignored JSON under `critic/out/p69-probe.json`.

**Screenshots reviewed:** `critic/out/p69-default.png` (default boot, tick ~71) · `critic/out/p69-voidmarked.png` (`?civ=voidmarked`, tick ~71)

**Preview URL:** `https://spacepixelrts.pages.dev` (`0.6.0-wave5`)

---

## P69 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.6.0-wave5` | **Pass** — `0.6.0-wave5` on all probes |
| Default boot — `civ` vespari vs aurion | **Pass** — `["vespari","aurion"]` |
| Default boot — P41 opening intact (Helion rank vs Kryos wrecks + mid gem) | **Pass** — **8** team-0 Fighters alive, **5** team-1 Fighters alive; screenshot: green Helion rank center-right on golden mid gem, dark Kryos wreck belt screen-right, worker pocket bottom-left |
| Default boot — harness p99 < 22 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps |
| `?civ=voidmarked` — probe `civ` includes `voidmarked` | **Pass** — `["voidmarked","aurion"]` |
| `?civ=voidmarked` — ≥1 living `Kind.Shade` (id **6**) | **Pass** — **1** Shade alive |
| `?civ=voidmarked` — p99 < 22 ms | **Pass** — p99 **3.2 ms** |
| Nihiline silhouettes — third people, not Helion recolor | **Pass** — opening cluster reads asymmetric dark bodies with **purple spore tendrils** and green eye cores; no hex sails or tall lance geometry; palette is bruise/viridian, not corona gold |
| HUD civ picker — three tiles, non-blocking | **Pass** — **3** `#civpick .civ-tile` (Helion Compact / Kryos Conclave / Nihiline); left rail below topbar; clash and mid gem remain fully visible |
| Picker click Nihiline (default boot) | **Pass** — after `#civpick button[data-civ="voidmarked"]`: `civ` includes **voidmarked**, **1** Shade alive |

Default P41 tableau holds on bare URL. Nihiline is playable via URL probe and HUD picker, with `Kind.Shade` in the clash and silhouettes that read as void mycelium — a third people, not a hue swap.

---

## Single biggest gap

**None blocking P69** — civ picker, URL probe, Shade spawn, and Nihiline silhouette language all meet bar on `0.6.0-wave5`.

**Marginal (not scored here):** the Spore Rider unique is small in the opening cluster next to eight Fighters; Kryos clash line still reads partly as wreck scatter vs a full living rank (P41 marginal); master palette quantization still loose (~364 distinct quantized colors on voidmarked harness).

---

## Harness — default boot

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.4 |
| fps | 715 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.6.0-wave5` |
| Probe ents | 66 |
| Probe tick | 120 |
| Probe `rendererInfo.drawn` | **32** |
| Probe hitSfx | **52** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## P68 probe — opening entity counts

| Probe | Civ | Helion Fighters (t0) | Kryos Fighters (t1) | Shade alive | Civ tiles | p99 ms | Pass |
|---|---|---:|---:|---:|---:|---:|---|
| Default boot | vespari · aurion | **8** | **5** | **0** | **3** | **3.1** | ✓ |
| `?civ=voidmarked` | voidmarked · aurion | **8** | **5** | **1** | **3** | **3.2** | ✓ |
| Picker → Nihiline | voidmarked · aurion | **8** | **7** | **1** | **3** | — | ✓ |

---

## What passed

- **Version gate:** deploy ships `0.6.0-wave5`.
- **P41 lock:** bare URL still opens Helion vs Kryos with rank/gem/wrecks tableau and sub-22 ms p99.
- **§9 #3:** Nihiline on canvas via `?civ=voidmarked` and HUD picker — tendril/spore silhouettes and bruise/viridian palette read as a different people from Helion geometry and Kryos crystal facets.
- **Civ picker UX:** three large HUD tiles; no blocking splash; opening clash stays the wow shot.
- **Shade in clash:** `Kind.Shade` (engine id **6**) alive in voidmarked probes; URL param applies player civ before first reset.
