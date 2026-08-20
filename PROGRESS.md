# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.

## Now

**Sunweaver Town Center — neutral-clay structural rebuild in progress** (asset `SunweaverTownCenter_Structural_v01`). Loop: Sol orchestrates, Luna Max A implements via local Codex (`codex exec -m gpt-5.6-luna`), Luna B is the blind visual critic. Bar: structural fidelity >= 0.70 with every gate passing vs the approved reference pack.

- PTC-CLAY-02 wings: ACCEPTED (radial lobes, no pagoda roofs).
- PTC-CLAY-03 crown (broad faceted mandorla + front spine + collar): ACCEPTED (gate a PASS).
- PTC-CLAY-06 diagonal bent-talon cage: **all five structural gates PASS** for the first time (interlocking four-talon cage reads in front ortho — the 4-round crown interlock fight is closed). Committed `cd66387`.
- PTC-CLAY-07 re-proportion + central energy-vault (`59f7a88`): lower mass rebuilt to the reference profile (total ~11.7 tall on 7-unit footprint; two-tier plinth; tall vaulted front). Proportions layer fixed 0.5→0.7. Gates (b)(c)(d)(e) PASS.
- Round 7 critic: overall 0.60; gate (a) regressed — mandorla reads as hollow portal (needs solid faceted vault + dominant spine), side towers approach crown height. Round 8 (PTC-CLAY-08) in flight.
- PTC-CLAY-08 (`94453a2`): mandorla base 0.95, spine 0.22×0.18, towers lowered to top ~8.2. Proportions hold at 0.7; gates (b)(c)(d)(e) PASS.
- PTC-CLAY-09 (`5e57a47`): mandorla rebuilt as convex faceted shell + dominant ridge; luminance gate proves mandorla is bright-centered. PTC-CLAY-10 (`741246b`): mandorla fills the talon cage (max half-width 1.15), talons hug it.
- PTC-CLAY-11 (`3e1d9dc`): energy-vault dark recess replaced with a solid convex faceted jewel + small base doorway; vault-luminance gate PASS. Gates (b)(c)(e) underlying geometry accepted.
- ROOT CAUSE of the persistent gate-(a) "hollow/portal/void" (all 7 rounds of it): an independent critic's pixel probe on the REAL capture shows the crown center at luma 89 vs background 133 — DARKER than the void. The isolated luminance gate (which hides the talon cage) measured the same center at 143 (bright). The talon cage's front panels + shadows OCCLUDE and darken the mandorla center in the real image — that is the "dark inner void" every critic saw. Old gate measured the wrong (cage-hidden) view.
- Round 12 (PTC-CLAY-12 `a186e39` + `7fc816c`): central column UNIFIED (vault -> collar -> crown as one continuous convex faceted form, no collar ledge — no-shelf gate PASS) + front-biased key light so the column reads lit. Objective: real-capture crown center luma rose 88-124 -> 106-174 (above the 133 background in most bands); vault band still ~88-117 (one residual dark spot). p99 3ms, errors 0.
- Reviewer noise remains high on gate (a) after 13 rounds (descriptions have hallucinated "pyramid towers / squat gabled core" that contradict verified geometry). Best recent overall 0.6 with (b)(c)(e) PASS. Checkpoint for user eyes on the crown before further gate-(a) rounds.
- **Gate (a) BREAKTHROUGH (round 12 post-light review):** overall 0.59 — gate (a) PASS (unified solid jewel-column reads, no hollow/portal), (b) PASS, (e) PASS. The front-biased key + column unification were the answer to the 13-round combat.
- Round 13 (PTC-CLAY-13) in flight: south stair/plinth legibility — the grounded gap is "blank two-tier conical plinth; lacks broad stepped stair and entrance-collar hierarchy" (4 reviewers flagged the stair). Target: gates (a)(b)(c)(d)(e) all pass and overall >= 0.70.
- Objective gates hold throughout: p99 ~3 ms (< 8), console errors 0, gameplay captures distinct, no rear stair, footprint 7.0.

## Tracker

| Wave | Status |
|---|---|
| 0 docs/harness/deploy | done |
| 1–6 + art gaps | **PASS** |
| Wave A P94 iso projection | **PASS** |
| Wave A P95 emissive team color | **PASS** |
| Wave A P96 terrain elevation | **PASS** `tasks/P96-critic.md` |
