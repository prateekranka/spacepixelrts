# FAL-HANDOFF builder brief

Work in `/home/bobbyranka/workspace/spacepixelrts-forge-art-lab` on branch `hermes/forge-art-lab`.

Read first:

1. `docs/FORGE_ART_LAB_PROOF_HANDOFF_FIX.md` — binding defect contract.
2. `docs/FORGE_ART_LAB.md` sections 12–17.
3. `package.json` Forge Art scripts.
4. `scripts/forge-art-proof.mjs` in full.
5. `scripts/forge-art-accept.mjs` in full.
6. `scripts/qa-forge-art.mjs` in full.
7. `tools/forge-art/src/metrics.ts`, `thresholds.ts`, `registry.ts`, and the objective-gate implementation in `workbench.ts`.
8. Existing Forge Art tests.

Current reproduced defects:

- `npm run forge:art:proof -- --asset=sunweaver-lumen-guard --out=/tmp/fal-public-proof-check` exits 1 with `ERR_MODULE_NOT_FOUND` because package scripts use plain Node for scripts that import TypeScript modules.
- A proof generated through the private QA `tsx` shortcut lacks the acceptance schema fields and cannot be consumed by `forge:art:accept`.
- QA verifies proof generation and synthetic acceptance fixtures separately, not the real proof-to-accept handoff.

Implementation ownership is limited to:

- `package.json`
- `scripts/forge-art-proof.mjs`
- `scripts/forge-art-accept.mjs`
- `scripts/qa-forge-art.mjs`
- focused Forge Art test files if needed

Do not edit:

- `docs/FORGE_ART_LAB_PROOF_HANDOFF_FIX.md`
- `PROGRESS.md`
- `src/sim.ts`
- `src/engine.ts`
- any accepted baseline PNG, manifest, or registry file
- runtime art source or renderer files

Requirements:

- Follow strict RED-GREEN-REFACTOR. Add a focused regression that fails for the current public command/schema handoff before repair.
- Public proof, baseline, and accept package scripts must use installed `tsx` and run without wrappers.
- A generated single-asset proof manifest must be directly consumable by the real dry-run acceptance command.
- Preserve current proof fields while adding the binding acceptance fields.
- Compute a non-empty boolean gate map from real proof integrity plus all applicable proven objective metrics. Share existing metrics and thresholds; do not invent thresholds or mark advisory checks as hard failures.
- Acceptance must normalize the generated manifest's metric shape safely and refuse missing/empty gates, failed proven gates, partial frames, stale source, hash mismatch, and unrelated drift.
- Extend browser QA to call the public npm proof command and then the public/generated proof through real dry-run acceptance. Prove accepted files are unchanged.
- Retain all current refusal tests and browser checks.
- Run the exact gates from the defect contract.
- Kill any Vite/Chromium/helper processes you start.
- Review your own diff for scope.
- Commit only your owned implementation/test files with message prefix `FAL-HANDOFF:`. Do not include the lead-owned uncommitted spec.

Final report must give the commit SHA, files changed, RED evidence, exact commands/exits, proof output path, dry-run output, and any limitation. Do not claim done if the public proof-to-dry-run sequence was not executed successfully.
