# P94 — Critic verdict (isometric 3/4 projection)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE isometric 3/4 (~2:1) · **Judged:** 2026-08-17

**Screenshots reviewed (running 0.9.0-iso GPU frames, not the builder report):**
- `critic/out/p94.png` — default opening camera, 1180×820
- `critic/out/p94-hall.png` — zoomed on the player Helion hall, 1180×820
- `critic/out/p94-units.png` — zoomed on the Helion fighter rank, 1180×820

**Scope:** projection only. Missing mountains (P96), MAG banners (P95), and 8-dir unit art (Wave B) are not scored.

---

## P94 — **PASS**

A naive player looking at these three frames would call this an isometric battlefield, not a helicopter top-down square map. Close-zoom floor slabs are wide diamonds (pointy top, fat middle, pointy bottom). Halls and houses are boxes: a 2:1 lime/forest roof sitting on a lit left wall and a shaded right wall. Fighters stand upright on the dirt, overlapping back-to-front along a diagonal rank.

| Criterion | Result |
|---|---|
| 1. Ground reads diamond / oblique, not a screen-aligned square | **Pass** — hall zoom playfield: three `#2b2537` slabs at grade are diamonds, not squares. Largest: bbox **158×66** (w/h **2.39**), row widths **7 → 149 → 18** (top / max / bottom). Same profile on the two neighbor slabs (max **149** px on **65–66** px of height, w/h **~2.26**). That is 2:1 dimetric, not a 45°-rotated square (those bboxes are 1:1). Opening camera keeps the dirt quiet (P91), but the same tableau’s hall roof is already a **34×16** lime diamond (w/h **2.12**, 3 px at the peak → 34 px at the equator). |
| 2. Buildings are boxes: two visible walls + a roof | **Pass** — hall zoom, player hall. Lit roof `#64ca1e` is a diamond **98×38** (4 px at y=220 → **98** px at y=250–253). Shade roof `#07320b` continues under it to **150** px wide. Left wall `#55495f` is a parallelogram **40×45** (4 px under the eave → 40 px at grade). Right wall `#16111b` is a second face **88×93**, with ice windows `#a4c6ff` on **both** walls (left x≈525 and right x≈616 on the same scanlines). Houses repeat the box at **58×28** lime (w/h **2.07**, bbox occupancy **0.51** — a filled diamond). Opening camera still carries wall-lit `#55495f` (**169** px) plus the 2:1 hall roof; they are small, not absent. |
| 3. Units stand upright on the ground | **Pass** — units zoom: Helion fighter bodies are taller than wide (**50×86** to **50×113**, h/w **1.7–2.3**), feet on the mauve, oval shadows under them, muzzle sparks at the rifles. They recede up-screen along a diagonal rank and occlude the fighters behind. They are billboard people on an iso floor, not top-down tokens. |
| 4. Naive-player read: isometric place, not a square map from a helicopter | **Pass** — hall zoom is the tell: diamond floor + gable boxes with a corner between two walls. Opening shot is the same place at RTS scale (wide green roofs, upright rank, not a square grid of stickers). Units zoom keeps the people vertical on that floor. |

---

## Single biggest gap

**None blocking P94.** Projection reads 2:1 isometric 3/4.

**Marginal (not scored here):** at default opening zoom the dirt is still a quiet mauve fill, so the diamond grid is inferred from roofs and pads until you zoom (hall zoom is the tile check). The mid gem stays a ~1:1 face-on diamond (**48×46** opening, **95×93** units) — a billboarded resource node, not a ground tile. MAG banners, mountains, and 8-dir unit art are later pieces.

---

## Pixel notes

Playfield sample: x 180–1160, y 70–640 (980×570).

### Hall zoom — roof diamond (player hall)

| y | `#64ca1e` span |
|---|---|
| 220 | 4 |
| 224 | 18 |
| 232 | 32 |
| 240 | 54 |
| 248 | 84 |
| 250–253 | **98** (equator) |

House lime (561,336): 6 px at the peak → **58** px at y=358–363. w/h **2.07**.

### Hall zoom — two walls

| Plane | Hex | Bbox | Read |
|---|---|---|---|
| Roof lit | `#64ca1e` | 98×38 | 2:1 diamond |
| Roof shade | `#07320b` | 150×22 under the lime | gable shade face |
| Left wall | `#55495f` | 40×45 | lit south parallelogram |
| Right wall | `#16111b` | 88×93 | shaded east face |
| Windows | `#a4c6ff` | 11×11 slots on both walls | 1 446 px in playfield |
| Door / mint bar | `#3dc76b` | 21×11 | 1 072 px |

Hall-full crop (200×310 around the player hall): **16** unique colors — dust, two roof greens, two wall tones, ice, mint, ink. No leftover front-elevation slab.

### Hall zoom — ground diamonds (`#2b2537`)

| Bbox | Size | w/h | top / max / bot row width | Diamond? |
|---|---|---|---|---|
| (511,469)–(668,534) | 158×66 | 2.39 | 7 / **149** / 18 | yes |
| (856,409)–(1013,473) | 158×65 | 2.43 | 4 / **149** / 5 | yes |
| (180,402)–(314,475) | 135×74 | 1.82 | 25 / **135** / 8 | yes |

### Units zoom — upright rank

| Fighter body (lime+forest+underside) | Bbox | h/w |
|---|---|---|
| (719,92) | 50×113 | 2.26 |
| (629,133) | 50×102 | 2.04 |
| (561,264) | 50×86 | 1.72 |
| (448,213) | 50×87 | 1.74 |

### Opening camera — still iso at RTS scale

| Signature | Count / shape |
|---|---|
| Hall lime diamond | **34×16** (w/h **2.12**), 3 px peak → 34 px equator |
| Lime / forest | 2 278 / 3 164 px |
| Wall lit `#55495f` | **169** px (present, sub-house scale) |
| Dust | `#64566a` / `#63566a` / `#635569` ~66% of playfield |
