/**
 * Dev-only Forge Review bootstrap. Loaded exclusively through a guarded dynamic
 * import from main.ts so production bundles and source maps stay clean.
 */
import type { AppState } from '../app-flow';
import type { Input } from '../input';
import type { MatchConfig } from '../match-config';
import type { GameRenderer } from '../render';
import type { Hud } from '../hud';
import type { World } from '../sim';
import { drawOverlays } from './review-overlays';
import { installForgeReviewControl } from './review-control';

export interface ForgeBootDeps {
  getWorld(): World | null;
  getInput(): Input | null;
  getView(): GameRenderer | null;
  getState(): AppState;
  getConfig(): MatchConfig;
  getScenario(): string | null;
  getHud(): Hud | null;
  getFps(): number;
  getP99FrameMs(): number;
  setFreeze(frozen: boolean): void;
  reloadWithParams(mutate: (next: URLSearchParams) => void): void;
  registerRendererHook(register: () => void): void;
}

export async function bootForgeReview(deps: ForgeBootDeps): Promise<void> {
  const installed = installForgeReviewControl({
    getWorld: deps.getWorld,
    getInput: deps.getInput,
    getView: deps.getView,
    getState: deps.getState,
    getConfig: deps.getConfig,
    getScenario: deps.getScenario,
    getHud: deps.getHud,
    getFps: deps.getFps,
    getP99FrameMs: deps.getP99FrameMs,
    setFreeze: deps.setFreeze,
    reloadWithParams: deps.reloadWithParams,
  });
  if (installed === null) return;

  let hookRegistered = false;
  deps.registerRendererHook(() => {
    const view = deps.getView();
    if (hookRegistered || view === null) return;
    hookRegistered = true;
    view.reviewHooks.push((ctx, renderer) => {
      drawOverlays(
        ctx,
        deps.getWorld(),
        renderer,
        installed.overlaysState,
        installed.perspectiveState,
      );
    });
  });

  const panelSpecifier = `/${['tools', 'forge-review', 'panel.ts'].join('/')}`;
  await import(/* @vite-ignore */ panelSpecifier);
}
