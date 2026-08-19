# PTC-RP3 — Final Crop Admission Fix

## Proven defects

- `07_rear_three_quarter_4096` retains a vertical source-panel separator at its right edge.
- `13_scale_and_dimensions_2048` uses the neighboring footprint diagram and retains diagram lines. It should use the clean in-game scale panel.

## Exact correction

- Set the rear three-quarter crop to approximately `(1087, 76, 1305, 365)`, or tighter if needed, so the building is intact and the right separator is absent.
- Set the scale crop to the clean in-game panel at approximately `(790, 730, 1080, 945)`. It must include the building and human scale figure, but exclude the panel title, borders, text, and neighboring footprint diagram.
- Change file 13 provenance role to `in-game scale reference`. Record that the human figure is directly observed.
- Regenerate all variants, contact sheet, provenance, and verification.
- Preserve the PTC-RP2 conservative mask and corrected detail roles.
- Do not edit candidate assets or begin the clay rebuild.

## Definition of done

A direct contact-sheet inspection shows no source labels, panel separators, or diagram lines inside files 07 or 13. All pack verification gates still pass.
