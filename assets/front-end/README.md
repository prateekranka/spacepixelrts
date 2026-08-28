# AAA front-end asset provenance

## What shipped

- `public/front-end/civilizations/<civ>/<mode>/` — final layered assets (1920x1080
  master coordinate space; manifest rects in 960x540 logical units).
- `assets/front-end/masters/` — the four selected 1920x1080 key-art masters.
- `scripts/aaa-front-end-produce.py` — the build pipeline (chroma keying, black-key
  additive layers, celestial body placement, 1920x1080 crop, manifest emission).
- `scripts/aaa-front-end-compose.py` — local composite preview generator (verification
  of pack assembly before runtime integration).

## Source chain

1. Concept masters: generated image art (1024x576) — two menu candidates per
   civilization were reviewed blind; one refined master per civilization was selected;
   loading masters were generated to match.
2. Layer art: per-layer generated images (sky, celestial body, far terrain,
   settlement/quarry-city/fortress, foreground, atmosphere, sprite sheets, animation
   strips) guided by the masters' anchor geometry.
3. Processing (scripts/aaa-front-end-produce.py):
   - nearest 2x upscale, center-crop to exact 1920x1080,
   - chroma-green keying + spill suppression for opaque sprites/scenery,
   - black-background luminance-key (additive) for glow layers,
   - celestial body repositioned to the locked anchor (sun 0.28/0.26 r=0.21H;
     moon 0.26/0.22 r=0.17H) with a programmatic soft halo,
   - webp q95 output for scenic layers, PNG for sheets/masks,
   - lights-mask extracted from the settlement/city bright pixels,
   - frame rectangles sliced from strip sheets and stored in manifest.json.

## Re-generation policy

Re-run the pipeline only from the durable artifacts inside this repository.
The generator outputs themselves are not stored in git (except via the exported
packs and masters); adjust `scripts/aaa-front-end-produce.py` in place for future
crops or composition changes.
