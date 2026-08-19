# Sunweaver Town Center Reference v01

This directory contains approved target references only.

- Do not place candidate renders here.
- Do not use prior procedural renders as visual references.
- `00_spec.json` is the structural authority.
- `*_neutral.png` uses a flat neutral background for vision review.
- `*_alpha.png` isolates the approved target for silhouette work.
- The original infographic remains provenance only; builders use the isolated files.
- RP2 detail crops are file 10 `(478, 730, 618, 878)` and file 11 `(333, 730, 458, 878)` in source-sheet pixels.
- Alpha extraction uses a conservative border flood: RGB distance `<= 40`, mean channel `>= 225`, and chroma `<= 22`. Ivory architecture is retained.
- QA measures nontransparent coverage at alpha `> 8`. The accepted range is `20%..95%` for every alpha output.

Candidate output belongs under `critic/out/town-center-structural-v01/`.
QA reports belong under `critic/out/town-center-structural-v01/qa/`.
