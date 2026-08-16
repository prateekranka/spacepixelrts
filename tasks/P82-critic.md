# P82 — Critic verdict (SDF unit/building quads — live)

**Critic:** fresh blind run · **Bar:** `docs/PROCEDURAL.md` §2c — units/buildings are true GLSL SDF (no sprite-atlas `texture2D` for people/halls); three civs still distinct; opening still wows; p99 < 8 ms; P80 VFX + P81 terrain carry over · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p82-default.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Probes (live):** Playwright tick sweep (250 ms steps, 0–3.5 s) sampling `__STARHOLD__.rendererInfo.vfx` + fighter counts (`kind === 2`) during opening exchange.

**Screenshots reviewed:** `critic/out/p82-default.png` (harness window, tick ~127) · `critic/out/p82-midclash.png` (tick ~29, peak VFX) · `critic/out/p82-voidmarked.png` (`?civ=voidmarked`, tick ~127)

**Preview URL:** `https://spacepixelrts.pages.dev` (`0.7.2-proc`)

---

## P82 — **Pass (locked)**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.7.2-proc` | **Pass** — `0.7.2-proc` on harness + sweep |
| Opening — Helion rank vs Kryos wrecks + mid gem | **Pass** — **8** Helion Fighters alive throughout sweep; green Helion sail/hex rank upper-right on banded field; golden mid gem center-left; cyan/orange Kryos crystal wreck scatter bottom-left; gem and rank legible, not drowned by terrain |
| Civ silhouettes — Helion hex/sail vs Kryos crystal | **Pass** — mid-clash: crisp yellow Helion diamonds/circle gem vs teal Kryos crystal shards vs green organic accents; two peoples, not identical SDF blobs |
| `?civ=voidmarked` — tendril/spore, not Helion recolor | **Pass** — player Nihiline: purple hulls with white spore caps and tendril arcs; enemy Kryos crystal wrecks bottom-left; silhouette distinct from Helion solar geometry |
| Units/buildings — SDF quads, not atlas soup | **Pass** — thick-ink geometric primitives (diamonds, circles, crystal fins, spore domes) with nearest-neighbor crisp edges; clash readable, not mush |
| P81 terrain still present | **Pass** — horizontal dune banding + value-weather grain on mauve dust on all captures |
| P80 VFX still present during clash | **Pass** — `hitSfx` **9 → 50** over sweep; `rendererInfo.vfx` peak **104** (tick ~29); sustained **28–104** mid-clash; white/yellow additive sparks visible on `p82-midclash.png` |
| Harness p99 < 8 ms | **Pass** — default p99 **3.1 ms**, voidmarked p99 **3.0 ms**; 0 frames worse than 45 fps |
| Screenshot — clash readable | **Pass** — rank, gem, wreck belt, and per-civ silhouettes legible through sparks and banded ground |

SDF unit/building quads ship on live: GLSL primitives replace atlas sampling for people/halls, three civs stay visually distinct, the P41 opening tableau holds with P80 GPU VFX and P81 procedural terrain, and the frame budget stays intact.

---

## Single biggest gap

**None blocking P82** — version gate, SDF sprite look, civ silhouette separation, voidmarked identity, opening clash readability, P80/P81 carry-over, and p99 budget all meet bar on `0.7.2-proc`.

**Marginal (not scored here):** end-of-harness `vfx: 0` at tick ~127 can misread as “no GPU VFX” unless probed during the clash window; fighter-count probe stayed **8/8** over sweep while wreck scatter is visible post-clash (wrecks are not `kind === 2`); `npm run critic` with two `--screenshot` flags only writes the last path — use `scripts/screenshot.mjs` for paired captures.

---

## Harness — default boot

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.39 |
| fps | 722 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.7.2-proc` |
| Probe ents | 66 |
| Probe tick | 127 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.vfx` | **0** (post-clash fade; see sweep) |
| Probe hitSfx | **52** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari (Helion) vs aurion (Kryos) |
| Palette distinct colors | 397 |
| Top ground tones | `#665566` (29.8%), `#554466` (18.5%) — banded dust, not flat fill |
| Console issues | none |

---

## Harness — `?civ=voidmarked`

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev/?civ=voidmarked` |
| p99FrameMs | **3.0** |
| avgFrameMs | 1.4 |
| fps | 713 (uncapped probe) |
| Probe version | `0.7.2-proc` |
| Probe tick | 127 |
| Civ | voidmarked (Nihiline) vs aurion (Kryos) |
| Teams pop | **21/30** · **9/30** |
| Probe hitSfx | **55** |

---

## Playwright sweep (live, opening window)

| Tick (approx) | `vfx` | `drawn` | hitSfx | Helion F | Kryos F |
|---:|---:|---:|---:|---:|---:|
| 9 | **60** | 40 | 9 | 8 | 8 |
| 19 | **40** | 40 | 16 | 8 | 8 |
| 29 (peak) | **104** | 40 | 26 | 8 | 8 |
| 44 | **36** | 39 | 36 | 8 | 8 |
| 59 | **28** | 38 | 43 | 8 | 8 |
| 69 | **16** | 37 | 50 | 8 | 8 |
| 127 (harness) | **0** | 32 | 52 | 8 | 8 |

---

## What passed

- **Version gate:** deploy ships `0.7.2-proc`.
- **SDF sprites:** units and halls read as procedural GLSL primitives — crisp ink outlines, civ-specific geometry (Helion solar diamonds, Kryos crystal fins, Nihiline spore/tendril caps).
- **Civ identity:** Helion vs Kryos vs Nihiline distinguishable at RTS zoom; voidmarked is not a Helion palette swap.
- **Opening wow:** rank + mid gem + wreck scatter tableau intact; sparks during clash.
- **Procedural stack lock:** P81 banded ground + P80 GPU sparks still present.
- **Budget:** p99 **3.1 ms** — under the **8 ms** procedural migration ceiling.
