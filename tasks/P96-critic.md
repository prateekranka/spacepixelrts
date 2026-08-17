# P96 — Critic verdict (procedural terrain elevation)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE / Starhaven — terraced height, cliff faces, ramps, valleys; mountains are **geometry**, not a darker paint job on a pancake · **Judged:** 2026-08-17 · **Build:** 0.9.3-iso (orchestrator live frames)

**Screenshots reviewed (running GPU frames from `http://localhost:5173`, not the builder report):**
- `critic/out/p96-live.png` — opening clash valley, 1180×820 (pad MAY be flat)
- `critic/out/p96-ridge-live.png` — panned to a height-3 tile, 1180×820 (**this is the elevation evidence**)

**Scope:** elevation only. MAG lamps (P95), 8-dir unit art (Wave B), and isometric projection (P94) are not scored.

---

## P96 — **PASS**

A naive player looking at the ridge pan would call this **3D isometric ground**: mauve terrace tops sitting above ink cliff walls, jagged peaks, cut valleys, and angled ramps. The opening clash is still a **readable flat valley** with two fighter ranks on the dirt — not a crater, not buried under cliffs.

| Criterion | Result |
|---|---|
| 1. Ridge shot reads as 3D ground (mountains / valleys / cliff walls / ramps), not a pancake | **Pass** — `p96-ridge-live.png` is a faceted height mesh, not a two-tone paint job. Raised dust tops catch light; steep drops show darker charcoal/black **cliff faces** (vertical / near-vertical facets under the mauve lip). Jagged peaks and deep cuts occupy most of the playfield. Angled mauve slopes read as **ramps** between terrace and valley. A gray pad with four discs sits on a **raised** terrace in the upper-left — the pad is a flat slab *on* height, not the whole map flattened. |
| 2. Opening clash stays a readable flat valley with fighters visible | **Pass** — `p96-live.png` keeps a large mauve valley floor through the middle. Helion green rank (right, muzzle sparks) and the opposite cyan/white cluster (left) sit on that floor with clear silhouettes. Two light-grey pads with four circular insets sit on the **back of the valley**, still at grade. Mountains hug the **corners** (bottom-left crag, top-right peaks) instead of stacking over the fight. |
| 3. Naive-player read: mountains are geometry | **Pass** — ridge lighting is per-facet (lit mauve top vs shaded rock wall vs ink void). That is displaced ground in isometric 3/4, not a darker stamp on a flat plane. Opening camera still names a valley you could walk; the ridge pan names a mountain you could cliff. |

---

## Single biggest gap

**None blocking P96.** The height-3 pan is the tell, and it holds.

**Marginal (not scored here):** the default opening camera is still mostly a quiet mauve floor — mountains live in the corners, so a player who never pans could miss the terrace language. That is the intended pad-flat valley, not a pancake fail. Cliff walls are low-poly ink facets rather than AoE2’s painted rock strip; they still read as walls because the **top is offset in screen-Y** from the valley, not because the dirt got darker. MAG lamps, 8-dir art, and projection are out of scope.

---

## Frame notes (vision)

### `p96-live.png` — opening clash valley

- Playfield core: one continuous dark-lavender / mauve plane. Combat sits on it, not in a hole.
- Pads: two pale-grey diamonds with four circular insets, rear of the valley, coplanar with the fight (pad-flat allowed).
- Elevation at this camera: **rim only** — jagged charcoal facets bottom-left (near camera), pointed ridge mass top-right. Interior stays walkable-looking.
- Units: Helion rifle rank with yellow-white muzzle sparks on the right; squat cyan/white + blue-trim cluster on the left. Both fully visible. Not occluded by cliff lips.
- Minimap: valley blob with a yellow view-rect — camera is on the clash, not the ridge.

### `p96-ridge-live.png` — height-3 pan (elevation evidence)

- Playfield is **broken into terraces**. Mauve tops, charcoal cliff faces, ink voids between ridges. Peaks and cuts fill the frame; this is not the opening pancake with a tint.
- Cliff language: hard-edged facets drop from a lit top to a dark wall — a lip you could stand on, a face you could not walk through.
- Ramps: several mauve planes sit at an angle between high top and low valley (not only 90° crater walls).
- Raised pad: grey four-disc platform in the upper-left, clearly **above** neighboring valleys — height carrying a slab, not a painted blob.
- Minimap: view-rect has moved onto an irregular dark mass (the ridge), matching the pan.

FAIL conditions that did **not** fire: the ridge is not still a pancake; the opening clash is not buried under cliffs.
