# PTC-RP2 — Reference Pack Correction

## Proven defects

1. `10_buttress_tower_detail_2048` uses the banner/sigil source panel.
2. `11_banner_and_sigil_detail_2048` uses the defensive-trim source panel.
3. The background flood threshold erodes ivory architecture in detail crops, producing gray/black holes.
4. `12_materials_2048` alpha provenance says `alphaHasTransparency: false` although the generated alpha file is transparent outside the swatches.

## Required correction

- Use the defensive-trim/buttress panel for file 10. The admitted source region is around `x=467..628`, `y=718..900`; choose a crop that excludes its label and neighboring panels.
- Use the banner/sigil panel for file 11. The admitted source region is around `x=324..467`, `y=718..900`; choose a crop that excludes its label and neighboring panels.
- Replace the permissive background mask with a conservative border flood. Pale ivory and gold pixels must not be removed. Prefer a threshold around 32–45 plus a bright, low-chroma background test. Minor source-paper remnants are better than missing architecture.
- Rebuild all base, neutral, alpha, contact-sheet, provenance, and QA outputs deterministically.
- Mark file 04 as mirrored/inferred exactly as before.
- Mark the material alpha variant as transparent in provenance.
- Add a verification field that records opaque target retention or nontransparent coverage for each alpha image. Do not accept a detail alpha image with less than 20% or more than 95% nontransparent coverage unless its role explicitly warrants it.
- Keep canonical images free of labels and panel borders. Contact-sheet filename labels are allowed.

## Frozen RP2 coordinates and mask rule

- File 10 exact crop: `(478, 730, 618, 878)` — defensive-trim/buttress panel only.
- File 11 exact crop: `(333, 730, 458, 878)` — banner/sigil panel only.
- The alpha mask is a 4-connected border flood. A pixel is floodable only when its Euclidean RGB distance from the sampled border median is `<= 40`, its mean channel value is `>= 225`, and its channel chroma (`max - min`) is `<= 22`. The rule is conservative. It retains pale ivory and gold architecture.
- Nontransparent coverage is measured as alpha values greater than 8. Each alpha output must remain within `0.20..0.95`, inclusive. The QA report records each value and the observed pack range.
- Commit the frozen `00_spec.json`, pack `README.md`, and `docs/SUNWEAVER_TOWN_CENTER_REBUILD_SPEC.md` with this corrected pack.

## Definition of done

- Visual contact-sheet audit shows the correct detail roles.
- No eroded stone holes in 08, 09, 10, or 11.
- Every required dimension, opacity, filename, source hash, and mirrored-status check passes.
- Candidate renders remain outside the reference directory.
- No clay rebuild begins in this piece.
