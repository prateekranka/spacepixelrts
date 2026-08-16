You are the Composer 2.5 builder for Spacepixel RTS piece P32: separate the Helion combat wing from the worker camp on Z.

Repo: /Users/prateekranka/Cowork/spacepixelrts
Read: tasks/P31-critic.md, src/sim.ts spawnScenario (colPitch + camp coords).

P31 critic FAIL. Workers are now in frame — but they sit on the same Z as Helion’s outer column (`cz-4.1` vs workers `cz-4.75`), so the critic sees **one green corner blob** and **only the blue wedge** fighting.

Do **not** spawn agents. Keep freeze-fire and Ord.Attack. Do not zoom out.

## Single biggest gap (verbatim)

The §6 opening tableau no longer shows two facing ranks exchanging bolts — only a blue fighter wedge occupies center while green units appear solely as a corner worker blob.

## Root cause

Helion 4-col `colPitch=1.55` spans `cz-4.13` to `cz+0.53`. Camp workers at `cz-4.75` overlap that span. Tighten the **combat** formation; park camp further out with a **visible gap**.

## Exact numbers

Combat (both civs):
```
colPitch = 1.12   // still > fighter scale 1.08
rowPitch = 1.40
gap      = 3.60   // rank-center to rank-center
zHelion  = cz - gap/2
zKryos   = cz + gap/2
```
Helion Z span becomes ~`cz-3.48` to `cz-0.12`.

Camp (Helion −Z, Kryos +Z):
- Workers i=0..2: `(cx - 1.0 + i*0.75, cz ∓ 5.35)`  // 5.35 − 3.48 = 1.87 tile gulf
- Gem beside them: `(cx + 1.1, cz ∓ 5.35)`
- House behind workers: `(cx, cz ∓ 6.45)`
- Keep no-return / no-separate for opening workers tick<240
- `openingFlankCampEnt` band `|z-cz|` **5.0–6.8**
- Worker scale 1.55, house 1.75, fighters 1.08

## Verify then ship

1. `npm run build`
2. Preview free port. `node scripts/measure.mjs --url http://127.0.0.1:PORT --screenshot critic/out/p32.png --wait 3 --fps-seconds 3`
3. Open PNG. **Pass only if you can see: (a) green fighter rank AND blue fighter rank exchanging bolts in the center, AND (b) a separate worker+house group with empty tiles between camp and Helion wing.** If green fighters are missing or glued to workers, fix before commit.
4. Deploy `npx wrangler pages deploy dist --project-name=spacepixelrts`
5. Commit `P32: separate Helion wing from worker camp`
6. `tasks/P32.md`. Probe `0.2.7-wave1`.

Do not commit `notes.md` or PNGs.
