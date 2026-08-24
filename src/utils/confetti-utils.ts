export interface ConfettiOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: {
    x?: number;
    y?: number;
  };
  colors?: string[];
  shapes?: string[];
  scalar?: number;
  zIndex?: number;
  disableForReducedMotion?: boolean;
}

/**
 * Dynamically loads canvas-confetti on demand to keep initial page bundle sizes light.
 */
export async function triggerConfetti(options?: ConfettiOptions): Promise<void> {
  try {
    const confettiModule = await import('canvas-confetti');
    const confetti = confettiModule.default || confettiModule;
    if (typeof confetti === 'function') {
      confetti(options);
    }
  } catch (error) {
    console.warn('[Confetti] Failed to load canvas-confetti:', error);
  }
}
