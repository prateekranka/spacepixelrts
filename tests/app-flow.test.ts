import assert from 'node:assert/strict';
import { AppFlow, type AppEvent, type AppState } from '../src/app-flow';
import {
  DEFAULT_MATCH_CONFIG,
  QA_MATCH_CONFIG,
  cloneMatchConfig,
  fromLegacyCiv,
  normalizeMatchConfig,
  toLegacyCiv,
  validateMatchConfig,
} from '../src/match-config';
import {
  QA_PRIMARY_ROUTES,
  QA_SCENARIOS,
  QA_SUPPLEMENTAL_ROUTES,
  getQaScenario,
  parseQaScenario,
} from '../src/qa-scenarios';

const paths: Record<AppState, readonly AppEvent[]> = {
  Boot: [],
  MainMenu: ['BOOT_READY'],
  MatchSetup: ['BOOT_READY', 'OPEN_SETUP'],
  Loading: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH'],
  Playing: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY'],
  TacticalPause: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY', 'TOGGLE_PAUSE'],
  Victory: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY', 'MATCH_WON'],
  Defeat: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY', 'MATCH_LOST'],
  Results: ['BOOT_READY', 'OPEN_SETUP', 'START_MATCH', 'LOAD_READY', 'MATCH_WON', 'CONTINUE'],
};

function flowAt(state: AppState): AppFlow {
  const flow = new AppFlow({ logger: () => undefined });
  for (const event of paths[state]) assert.equal(flow.dispatch(event).accepted, true, `${state}: ${event}`);
  assert.equal(flow.state, state);
  return flow;
}

const legal: ReadonlyArray<readonly [AppState, AppEvent, AppState]> = [
  ['Boot', 'BOOT_READY', 'MainMenu'],
  ['MainMenu', 'OPEN_SETUP', 'MatchSetup'],
  ['MatchSetup', 'BACK', 'MainMenu'],
  ['MatchSetup', 'START_MATCH', 'Loading'],
  ['Loading', 'LOAD_READY', 'Playing'],
  ['Loading', 'LOAD_FAILED', 'MatchSetup'],
  ['Playing', 'TOGGLE_PAUSE', 'TacticalPause'],
  ['TacticalPause', 'TOGGLE_PAUSE', 'Playing'],
  ['Playing', 'MATCH_WON', 'Victory'],
  ['Playing', 'MATCH_LOST', 'Defeat'],
  ['Victory', 'CONTINUE', 'Results'],
  ['Defeat', 'CONTINUE', 'Results'],
  ['Results', 'REMATCH', 'MatchSetup'],
  ['Results', 'MAIN_MENU', 'MainMenu'],
];

for (const [from, event, to] of legal) {
  const flow = flowAt(from);
  const result = flow.dispatch(event);
  assert.equal(result.accepted, true, `${from}/${event} accepted`);
  assert.equal(result.from, from);
  assert.equal(result.to, to);
  assert.equal(flow.state, to);
}

{
  const errors: string[] = [];
  const flow = new AppFlow({ logger: (message) => errors.push(message) });
  const result = flow.dispatch('START_MATCH');
  assert.equal(result.accepted, false);
  assert.equal(flow.state, 'Boot');
  assert.ok(result.reason?.includes('START_MATCH'));
  assert.equal(errors.length, 1);
}

for (const state of Object.keys(paths) as AppState[]) {
  assert.equal(flowAt(state).canAdvanceSimulation, state === 'Playing', `${state} sim gate`);
}

{
  const flow = flowAt('Playing');
  assert.equal(flow.dispatch('TOGGLE_PAUSE').to, 'TacticalPause');
  assert.equal(flow.canAdvanceSimulation, false);
  assert.equal(flow.dispatch('TOGGLE_PAUSE').to, 'Playing');
  assert.equal(flow.canAdvanceSimulation, true);
}

for (const terminal of ['Victory', 'Defeat'] as const) {
  const flow = flowAt(terminal);
  assert.equal(flow.dispatch('CONTINUE').to, 'Results');
}
assert.equal(flowAt('Results').dispatch('REMATCH').to, 'MatchSetup');
assert.equal(flowAt('Results').dispatch('MAIN_MENU').to, 'MainMenu');

assert.equal(validateMatchConfig(DEFAULT_MATCH_CONFIG).valid, true);
assert.equal(validateMatchConfig(QA_MATCH_CONFIG).valid, true);
assert.equal(QA_MATCH_CONFIG.seedMode, 'deterministic');
assert.equal(QA_MATCH_CONFIG.seed, 0x5eed);
assert.equal(toLegacyCiv('sunweaver'), 'vespari');
assert.equal(toLegacyCiv('gravemark'), 'aurion');
assert.equal(fromLegacyCiv('vespari'), 'sunweaver');
assert.equal(fromLegacyCiv('aurion'), 'gravemark');
assert.equal(fromLegacyCiv('voidmarked'), null);
assert.equal(
  validateMatchConfig({ ...cloneMatchConfig(DEFAULT_MATCH_CONFIG), aiFaction: 'sunweaver' }).valid,
  false,
);
assert.deepEqual(normalizeMatchConfig({ playerFaction: 'gravemark', aiFaction: 'sunweaver' }), {
  ...DEFAULT_MATCH_CONFIG,
  playerFaction: 'gravemark',
  aiFaction: 'sunweaver',
});

assert.equal(QA_PRIMARY_ROUTES.length, 9);
assert.equal(QA_SUPPLEMENTAL_ROUTES.length, 4);
assert.equal(QA_SCENARIOS.length, 13);
for (const scenario of QA_SCENARIOS) {
  const flow = new AppFlow({ logger: () => undefined });
  for (const event of scenario.eventSequence) {
    assert.equal(flow.dispatch(event).accepted, true, `${scenario.id}: ${event}`);
  }
  assert.equal(flow.state, scenario.expectedState, `${scenario.id} state`);
  assert.equal(scenario.config.seedMode, 'deterministic', `${scenario.id} seed mode`);
  assert.equal(scenario.config.seed, 0x5eed, `${scenario.id} seed`);
  assert.equal(getQaScenario(scenario.id)?.id, scenario.id);
}
assert.equal(parseQaScenario('?qa=opening')?.id, 'opening');
assert.equal(parseQaScenario('qa=midgame-gravemark')?.id, 'midgame-gravemark');
assert.equal(parseQaScenario('?qa=unknown'), undefined);

console.log('M0 app-flow tests: PASS');
