# Sunweaver Town Center — Iteration 2 Implementation Spec

Scope: standalone procedural Three.js town-center viewer only. Do not alter the live game simulation or Hall.

## Front focal system

- Make the facade solar heart the primary front focal system.
- Use a deep, layered pointed-arch recess, a larger almond shell/core, heavier curved gold pauldron lips, and denser gold framing.
- Keep the roof crystal as the crown. Reduce its shell/core visual mass without removing the four-prong crown identity.

## Banner and roof contract

- There are exactly four cloth banners in one four-fold ring.
- All four use the same deep-blue, gold-sunburst, cyan-core texture.
- The same four banner objects remain present from Stage 1 through Stage 4.
- Roof wedges are rigid cream/gold structural solids. They must not use cloth-like blue surfaces.

## Additive stage contract

- The circular footprint and one front stair are present at Stage 1 and remain present.
- Later stages add height and detail only.
- Stage 3 uses a coherent, closed version of the same four-prong cage language. It must not look like an open scaffold that Stage 4 replaces.
- Rear stays distinct and has no stair.

Verification: `npx tsc --noEmit`, `npm run build`, then `node scripts/town-center-shots.mjs` with zero browser errors. Regenerate comparison and evidence outputs if the existing project scripts provide them.
