# P92 — Critic verdict (real buildings)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE — buildings are PLACES (roof, wall, door) · **Judged:** 2026-08-17

**Screenshots reviewed:** `critic/out/p92-hall-crop2x.png` (player base, close zoom — **architecture check**, 1440×1120 = 2× of a 720×560 crop) · `critic/out/p92-orch.png` (default opening camera, 1180×820). Buildings only; ground was P91 PASS and is out of scope.

---

## P92 — **PASS**

The player's hall and the houses in the close crop are places, not black slabs or gold stickers. A lime gable sits on a forest-green shade face with a near-black overhang; under that is a charcoal wall plane; at grade a dark door; in the wall, ice-blue window slots. Empty UV garbage would not produce that stack.

| Criterion | Result |
|---|---|
| 1. Pitched/domed roof distinct from a wall plane | **Pass** — hall roof scan (crop y≈200) is a three-face gable: lit lime **`#64ca1e`** (48 px) / forest **`#07320b`** (100 px) / underside **`#020b04`** (48 px). Wall under it is a different plane: lit **`#55495f`** vs shade **`#16111b`**. Same lime/forest split repeats on the house above, the house below, and the house on the right edge. **0** gold-sticker pixels in the crop. |
| 2. Dark door on the ground | **Pass** — hall ground floor (crop y≈380): shade wall 77 px, then a centered ink door **`#020103`** 62 px, then shade wall 77 px. The black is a hole in the wall at grade, not a missing texture. |
| 3. Lit window slots | **Pass** — ice-blue slots **`#a4c6ff`** / **`#d6e7ff`** (2 640 px in the 1× crop, 0.65%). They sit in the wall band, not on the roof: paired 14 px windows on the upper house, plus a mint bar **`#3dc76b`** on the hall wall. |
| 4. Not black slabs / gold stickers / empty UV | **Pass** — crop unique colors **51** (quant16 **16**), all architectural: mauve dust, two-tone green roof, charcoal wall, ice windows, ink door. Opening camera still carries the same lime/forest roof signatures on the player cluster (playfield **`#64ca1e` 2 251** px, **`#07320b` 3 865** px); hall-roof bboxes there are ~60% green and **0% gold**. |

---

## Single biggest gap

**None blocking P92.** Hall and visible houses read as roof / wall / door / window.

**Marginal (not scored here):** at default opening zoom the door and windows go sub-pixel (ice-blue **48** px in the whole playfield). The opening frame still contains large gold discs/diamonds (mid gem, plus an orange disc in the player-base neighborhood). Those are not the hall roof — hall/house roofs in that frame are green — but they keep a sticker silhouette in the same tableau.

---

## Pixel notes (architecture crop, 720×560 source of crop2x)

| Metric | Value |
|---|---|
| Ground | **`#423955` / `#423855`** (luma **62.9 / 62.3**), **65%** of crop |
| Roof lit / shade / underside | **`#64ca1e`** luma **152** · **`#07320b`** luma **33** · **`#020b04`** luma **7.5** — together **~8%** |
| Wall lit / mid / shade | **`#55495f`** · **`#2b2537`** · **`#16111b`** |
| Door / ink | **`#020103`** luma **1.5**, **2.70%** of crop; 62 px centered run at hall grade |
| Window | **`#a4c6ff`** luma **194**, **0.44%**; brighter **`#d6e7ff`** |
| Gold-sticker pixels | **0** |
| Green-roof-ish fraction | **7.10%** |
