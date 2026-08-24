# FPE-0 Baseline — Pixel Front-End Shell

Date: 2026-08-25
Branch: `hermes/starhaven-pixel-ui-shell`
Worktree: `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell`

## Branch reconciliation

- Fetched `origin/chatgptpro2008` and `origin/hermes/starhaven-aaa-front-end`.
- Authored source commit: `9020475dd89a53ead0b3f2c0c01c189664879745`.
- Integration commit: `b406cb6c23fc562865963d31df1f4cb70e1d40a8`.
- Merge base: `b406cb6c23fc562865963d31df1f4cb70e1d40a8`.
- Ahead/behind (`authored...integration`): `10 / 0`.
- `chatgptpro2008` has no commits newer than the authored branch base. No gameplay or functional-menu commit needed to be merged.
- The new branch starts from the remote authored branch. The shared original checkout was not edited.

## Authored asset proof

- Sunweaver pack: 22 files; 12 menu files; 9 loading files; one manifest.
- Gravemark pack: 21 files; 11 menu files; 9 loading files; one manifest.
- Sunweaver manifest SHA-256: `2c2bef314e7248cb1f21709c2ac9c74d151d5d3cc1a04318c532181039cc5f13`.
- Gravemark manifest SHA-256: `b9cdbc6ae85460e2271e3123bcdb2b5205d3f4dceaaa1abfd9d9e19f7bbb50c1`.
- The hashes differ. The packs have different asset names and compositions.
- `tests/front-end-scene.test.ts` forbids `hue-rotate` and the old theme runtime.
- Production presentation uses the authored layered compositor in `src/front-end-scene.ts`.

Protected baseline hashes:

- `src/sim.ts`: `fb0f3d7b3e8d8a1ef97afebb7c23b3a7ad4e9bb04dc5ff6ac98437be6694dd0a`
- `src/engine.ts`: `182830c08fb36041da67254890ba640c7fc50c251cb720bac27fd0174795c8e8`

## Baseline gates

- `npm ci`: PASS; 0 vulnerabilities.
- `npm run test:m0`: PASS.
- `npm run test:aaa`: PASS.
- `npm run build`: PASS. Main bundle: `dist/assets/main-DvbvV5Yq.js`.
- `npm run qa:aaa`: PASS. Four 1920 × 1080 composited captures; 0 console errors.

## Baseline evidence

Folder: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/baseline/`

| Frame | Sampled colors | SHA-256 |
| --- | ---: | --- |
| Sunweaver menu | 5,249 | `a6c8c6ea0da5217066772009a3279cd2619bcfa3497b75901d9e21f61d103614` |
| Gravemark menu | 4,736 | `97bdefcfa587f9fb9880ebbd885d0ef77f0032e61b0a286e7251e84c76293093` |
| Sunweaver loading | 4,793 | `a64a47c7454fbadcfdb173f8563d8b4aba631d5a244aec451b71626918eee2f6` |
| Gravemark loading | 4,484 | `26cb8610b442b46dd9572d3dd763f063bf6bb4070db1aebb81c99cfc98064445` |

`manifest.json` records dimensions, byte counts, hashes, source commit, branch relation, and QA result.

## Baseline diagnosis

The accepted scenes are detailed authored pixel compositions. The current DOM shell is a smooth high-resolution web-dashboard layer. It uses smooth web fonts, translucent cards, fine lines, soft treatment, Unicode utility glyphs, and a continuous loading bar. The single largest gap is the non-pixel DOM shell. The civilization scene packs remain protected.
