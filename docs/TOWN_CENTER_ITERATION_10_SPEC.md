# Sunweaver Town Center — Iteration 10 Stair Nosing Fix

Scope: remove only the faulty lateral stair-nosings from `createStair`.

## Proven defect

The side-nosing loop creates a mesh with `width + 0.04` for each side, then positions that full-width mesh at `±width/2`. This produces long dark-gold bars extending far outside the staircase. Blind critics read them as scaffold poles and extra stair modules.

## Required correction

- Delete the side-nosing loop after the main step loop.
- Keep the one centered step mesh and its centered front nosing for each tread.
- Do not change stair dimensions, facade, turrets, banners, stages, viewer, or camera.
- Regenerate canonical captures and verify no horizontal bar extends beyond the stair width.

Run typecheck, build, screenshots, performance, and browser error check. Fresh Grok decides acceptance.
