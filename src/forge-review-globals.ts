/** Ambient Window hooks installed by src/dev/review-control under forge=1 (dev only). */
export {};

declare global {
  interface Window {
    __STARHAVEN_FORGE_RAF_TICK__?: (now: number) => void;
  }
}
