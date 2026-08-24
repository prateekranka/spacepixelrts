export type AppState =
  | 'Boot'
  | 'MainMenu'
  | 'MatchSetup'
  | 'Loading'
  | 'Playing'
  | 'TacticalPause'
  | 'Victory'
  | 'Defeat'
  | 'Results';

export type AppEvent =
  | 'BOOT_READY'
  | 'OPEN_SETUP'
  | 'BACK'
  | 'START_MATCH'
  | 'LOAD_READY'
  | 'LOAD_FAILED'
  | 'TOGGLE_PAUSE'
  | 'MATCH_WON'
  | 'MATCH_LOST'
  | 'CONTINUE'
  | 'REMATCH'
  | 'MAIN_MENU';

export interface TransitionResult {
  readonly accepted: boolean;
  readonly event: AppEvent;
  readonly from: AppState;
  readonly to: AppState;
  readonly reason?: string;
}

export interface AppFlowOptions {
  onTransition?: (result: TransitionResult) => void;
  logger?: (message: string) => void;
}

type TransitionMap = Readonly<
  Record<AppState, Readonly<Partial<Record<AppEvent, AppState>>>>
>;

const TRANSITIONS: TransitionMap = {
  Boot: { BOOT_READY: 'MainMenu' },
  MainMenu: { OPEN_SETUP: 'MatchSetup' },
  MatchSetup: { BACK: 'MainMenu', START_MATCH: 'Loading' },
  Loading: { LOAD_READY: 'Playing', LOAD_FAILED: 'MatchSetup' },
  Playing: {
    TOGGLE_PAUSE: 'TacticalPause',
    MATCH_WON: 'Victory',
    MATCH_LOST: 'Defeat',
  },
  TacticalPause: { TOGGLE_PAUSE: 'Playing' },
  Victory: { CONTINUE: 'Results' },
  Defeat: { CONTINUE: 'Results' },
  Results: { REMATCH: 'MatchSetup', MAIN_MENU: 'MainMenu' },
};

export class AppFlow {
  private currentState: AppState;
  private readonly onTransition: ((result: TransitionResult) => void) | undefined;
  private readonly logger: (message: string) => void;

  constructor(options: AppFlowOptions = {}) {
    this.currentState = 'Boot';
    this.onTransition = options.onTransition;
    this.logger = options.logger ?? ((message: string): void => console.error(message));
  }

  public get state(): AppState {
    return this.currentState;
  }

  public get canAdvanceSimulation(): boolean {
    return this.currentState === 'Playing';
  }

  public dispatch(event: AppEvent): TransitionResult {
    const from: AppState = this.currentState;
    const to: AppState | undefined = TRANSITIONS[from][event];

    if (to === undefined) {
      this.logger(`AppFlow: rejected ${event} while in state ${from}`);
      return { accepted: false, event, from, to: from, reason: `No ${event} transition from ${from}` };
    }

    const result: TransitionResult = { accepted: true, event, from, to };
    this.currentState = to;
    this.onTransition?.(result);
    return result;
  }
}
