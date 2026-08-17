You are the Composer 2.5 builder for Starhold RTS piece **P93: full character roster** (GAP 3).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read first: `DIRECTIVE.md` GAP 3, `src/art-reference.ts` (technique), `src/sprites.ts` (every `draw*Pix`).

Do **not** spawn agents. Do **not** retune terrain. Do **not** redo building architecture (P92) unless a unit blit shares a broken helper. Do **not** change HUD/VFX/sim/`render.ts` camera.

## The gap (verified by Grok-vision on the REAL build)

Some units still render as **"tiny orbs"** and **"floating gold diamonds" (no weapon)**. Not every role got the connected-character treatment. A naive player must name ROLE + FACING + WEAPON from silhouette, like an AoE2 Longbowman.

## Do this

Audit `src/sprites.ts`. **Every living unit role × all 3 civs** must be a CONNECTED character (or vehicle) with a dominant weapon/tool and facing:

| Role | Must read as |
|---|---|
| Worker | hunched body, crate or drill overlapping the torso/thighs, two hands on the load |
| Scout | low hull + oversized sensor dish + exhaust, one connected vehicle (not a floating dish-orb) |
| Fighter | helmet→torso→legs + rifle with stock/receiver/barrel/muzzle, skin grip on the barrel |
| Siege | tread/base + raised cannon (not a gold diamond) |
| Ravager | body + scythe claws, feet on ground |
| Prism | floating crystal **with a focus lens + beam** as the weapon — not a tiny orb or unmarked diamond |
| Shade | cloak + one glowing eye + dagger, connected feet |

Rules (from the validated reference):
1. Dark INK silhouette of the **whole** form first (nothing floats).
2. Top-left 3-tone fill (Hi / Mid / Dk).
3. ONE dominant weapon/tool, held (skin-tone grip pixels touching it where there are hands).
4. Fill most of the 32px cell — tiny 8px glyphs become orbs at opening zoom. Do **not** solve this by editing `render.ts` scale; solve it by occupying the sprite.
5. **No `circ()`-only living units.** Corpses may stay downed, but living frames must not collapse to a glow-dot.
6. Civ motif is palette/trim only; role silhouette stays readable.

Bump `VERSION` in `src/main.ts` to `0.8.2-art`.

## Verify

- `npx tsc --noEmit`; `npm run build`.
- Screenshot `http://localhost:5173` → `critic/out/p93.png`. Opening Helion rank must read as rifle infantry, not marbles. If scouts/prisms appear in the shot, they must not be orbs/diamonds.
- Optionally screenshot `http://localhost:5173/reference.html` only as a technique check — the **game** shot is what counts.

## Commit + report

```
git add src/sprites.ts src/main.ts tasks/P93.md
git commit -m "P93: full roster connected characters — no orbs, no unarmed diamonds"
```

Do **not** commit `notes.md` or huge PNGs. Write `tasks/P93.md` naming any role you are least sure reads at opening zoom. Stay in this gap.
