const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Every animated module checks this before animating. */
export const prefersReducedMotion = (): boolean => reducedMotion.matches;

export function onReducedMotionChange(callback: (reduced: boolean) => void): void {
  reducedMotion.addEventListener('change', (event) => callback(event.matches));
}
