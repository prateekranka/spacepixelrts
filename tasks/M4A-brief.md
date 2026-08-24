# M4-A Builder Brief — sim core + content table

You are implementing M4-A of spacepixelrts. Read FIRST, in order:
1. docs/M4_TECH_PATHS.md  (the contract — implement exactly it, decisions are locked)
2. docs/CANONICAL_VOCABULARY.md
3. src/engine.ts, src/content.ts, src/sim.ts (current state)
4. tests/m3-boosts.test.ts (test style reference)

## Scope — touch ONLY these files
- src/engine.ts        (add techPath field to TeamEco)
- src/content.ts       (TechPathId, PATHS, PATH_EFFECTS tables, gate helpers)
- src/sim.ts           (tryCommitPath, gate rewrite, effect wiring, AI commit)
- tests/m4-tech-paths.test.ts  (new)
- package.json         (add "test:m4": "tsx tests/m4-tech-paths.test.ts")

Do NOT touch render, HUD (that is M4-B), art, terrain, or any other file.
Preserve the sim architecture. No new dependencies. TypeScript strict passes
(npm run build runs tsc --noEmit).

## Definition of done (all must hold)
1. TeamEco gains `techPath: TechPathId | null` initialized null; keep epoch/ageT
   storage as-is (ageT reused as commit channel timer).
2. content.ts exports: TechPathId type ('solar-ascendancy' | 'sky-dominion' |
   'iron-colossus' | 'rift-engineering'), TECH_PATHS metadata per civ+path
   (id, name, blurb), PATH_EFFECTS numeric table, isPathGated(kind),
   pathsForCiv(civ).
3. World.tryCommitPath(team, path): validates path ∈ pathsForCiv(team civ),
   epoch===0 && ageT===0 && techPath===null, Hall exists & completed &
   not training, funds ≥ 400 ore + 80 charge; deducts atomically; sets ageT=40;
   stores pending path; on channel end sets techPath=path and epoch=1 once.
   Returns false in every reject case with zero state change. Irreversible.
4. World.techPathOf(team), World.pathChannelT(team) accessors.
5. Training gates: gated kinds (Fighter, Siege, Ravager, Prism, Shade) require
   techPath !== null. minTrainEpoch/epoch>0 checks removed from decision points.
6. Effects wired exactly as docs/M4_TECH_PATHS.md decision 4 states.
7. Enemy marshal at tick 240: commit doctrine path (vespari→sky-dominion,
   aurion→iron-colossus) instantly (set techPath directly, ageT=0) instead of
   the old epoch=2 block; remove that epoch write.
8. Tests in tests/m4-tech-paths.test.ts cover every case in contract §M4-A list,
   style-matched to m3 tests (plain tsx asserts, PASS line at end).

## Verify before you finish (run all, paste tails into your summary)
npm run test:m4
npm run test:m2 && npm run test:m2-ai
npm run test:m3
npm run build

If an existing suite breaks because it relied on epoch semantics, fix the SIM
side, not the test intent — and note it in your summary. Commit nothing; leave
the tree dirty for review.

Report: files changed, test command outputs (tails), any deviations from spec.
