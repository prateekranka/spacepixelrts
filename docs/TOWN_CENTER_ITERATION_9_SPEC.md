# Sunweaver Town Center — Iteration 9 Review-Guide Cleanup

Scope: canonical viewer presentation only. Do not change Town Center model geometry, stages, materials, or camera.

## Proven defect

The canonical front and stage screenshots include the viewer's `stageRing` and `radialLines` debug guides. At the fitted low front camera these guides project as brown scaffold poles across the stair and southwest quadrant. Blind critics misread them as model parts, extra stairs, and Stage 1 poles.

## Required correction

- Keep `stageRing` and `radialLines` available in the interactive UI review mode.
- Hide both when `ui=0` so canonical screenshots contain only the model, neutral floor, and lighting.
- Do not hide model banners, poles, stairs, foliage, or construction-stage geometry.
- Regenerate all canonical orbit and Stage 1–4 screenshots.
- Verify Stage 1 shows foundation, one broad stair, and socket only.
- Verify no brown radial guide crosses the front stair.
- Verify the top view still shows four perimeter towers and one circular clamp.

Run typecheck, build, canonical screenshots, performance, multi-angle, and turntable. Fresh Grok decides acceptance.
