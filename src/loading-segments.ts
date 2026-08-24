/** The loading command strip is deliberately small, discrete, and inspectable. */
export const LOADING_SEGMENT_COUNT = 16;

export type LoadingStage = 1 | 2 | 3;
export type LoadingSegmentState = 'complete' | 'active' | 'future';

const SEGMENTS_BY_STAGE: Readonly<Record<LoadingStage, number>> = {
  1: 4,
  2: 10,
  3: LOADING_SEGMENT_COUNT,
};

export function loadingSegmentCount(stage: LoadingStage): number {
  return SEGMENTS_BY_STAGE[stage];
}

export function loadingSegmentState(stage: LoadingStage, index: number): LoadingSegmentState {
  const completeCount = loadingSegmentCount(stage);
  if (!Number.isInteger(index) || index < 0 || index >= LOADING_SEGMENT_COUNT) return 'future';
  if (index >= completeCount) return 'future';
  return index === completeCount - 1 && completeCount < LOADING_SEGMENT_COUNT ? 'active' : 'complete';
}

/** Pure markup helper used by the loading screen and its source-level QA contract. */
export function createLoadingSegmentMarkup(): string {
  return Array.from({ length: LOADING_SEGMENT_COUNT }, (_, index) =>
    `<span class="front-loading-segment" data-segment="${index + 1}" data-state="future" aria-hidden="true"></span>`,
  ).join('');
}
