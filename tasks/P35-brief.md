You are the Composer 2.5 builder for Spacepixel RTS piece P35: bolts are round sparks; hide opening HP chrome.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P34-critic.md, src/render.ts drawOverlay + bolt draw, src/atlas.ts drawBolt.

P34 critic FAIL. Wings are separated. Orange/cyan **bars in the gap look exactly like HP bars**. Do not spawn agents. Do not restack armies.

## Single biggest gap (verbatim)

The §6 opening tableau still fails to show two wings exchanging readable fire — mid-gap orange/cyan bars are visually identical to fighter HP chrome.

## Do

1. **Opening HP off:** if `world.tick < 240`, draw overlay HP **only for selected** ents. No bars on unselected fighters during the wow shot.
2. **Bolts are dots, not bars:** `drawBolt` = 7–9px **circle** (gold for sting, cyan for beam) with 2px white center. Billboard scale **0.95**. One instance. Opening spawn rate unchanged.
3. iFlash muzzle: small, not a white slab.

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p35.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if the gap shows round gold/cyan sparks AND fighters have no HP bars unless selected.** Two wings still countable.
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P35: round bolts, hide opening HP chrome`
6. `tasks/P35.md`. Probe `0.2.10-wave1`.

Do not commit `notes.md` or PNGs.
