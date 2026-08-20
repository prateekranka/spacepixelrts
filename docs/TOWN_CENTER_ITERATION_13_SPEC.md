# Sunweaver Town Center — Iteration 13 Reference Detail Density

Scope: raise only the failed reference-form-detail gate. Preserve the passed silhouette, palette, crystal, banners, plan, stages, camera, runtime, and stair.

## Hero front scale

- Increase the complete `front-approach` scale from 0.90 to approximately 1.03–1.05.
- Preserve its attachment and footprint.
- The large cyan almond, deep layered arch, heavy pauldron lips, and side weave must remain unobstructed.

## Four-wing meso detail

Each of the four radial gallery wings must receive the same visible architectural kit:

- two vertical gold pilasters on the outer facade;
- at least one additional small pointed side arch or recessed panel per side;
- one or two horizontal gold bands integrated into the wing shell;
- two small cyan energy nodes or almond insets;
- cream stone remains the dominant wing material.

Use shared geometry and materials. Keep the added draw-call cost bounded; prefer a compact repeated module or instancing where practical.

## Detail hierarchy

- Keep the four wings readable as large masses first.
- Add meso arches/pilasters/bands second.
- Add cyan nodes and trim last.
- Do not add new tall peaks, new banners, or new construction-stage parts.
- Do not obscure the front almond or broad stair.

## Performance

- Keep p99 frame time below 8 ms in the existing headless probe.
- Keep browser errors at zero.

Run typecheck, build, canonical screenshots, performance, strict spec, part coverage, multi-angle, and turntable. Nous `openai/gpt-5.6-luna` provides the visual review.
