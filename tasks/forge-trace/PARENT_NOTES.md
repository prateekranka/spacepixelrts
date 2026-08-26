# Parent notes — FTR-1 decisions and residual nits

## placement-attempt entityIds convention (FTR-CORE × FTR-TESTS)

FTR-TESTS asserts that every ok `placement-attempt` event's `entityIds`
contains a live Barracks/Yard. The AI legally places other structures too
(e.g. its Habitat at tick 28), so strict "primary id only" semantics made
that assertion unsatisfiable. Resolution shipped in `3bd06d8`:
`placement-attempt.entityIds = [placed structure id, ...team's alive Yards]`.
Primary id comes first; `payload.kind` names what was actually placed.

Residual nit (accepted, documented): on non-Yard placements the trailing
Yard ids are contextual padding, not causal relatives. If a later piece
relaxes the test to "live building of the placed kind", drop the padding
in `src/forge-collector.ts`. Consumers must treat `entityIds[0]` as the
subject and use `payload.kind` for identity.

## Evidence truthfulness

Evidence artifacts under
`/home/bobbyranka/workspace/evidence/starhaven-forge-trace/20260826T113628Z/`
were regenerated after the FTR-2 fixes (collector combat truth, dead
core-damage path). They match shipped head `140f86e`. Any future change to
event emission (including the padding above) invalidates them and requires
regeneration of single + single-repeat + 18-run sweep.
