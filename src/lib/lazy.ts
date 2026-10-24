/**
 * Load a section's code only when it's about to scroll into view.
 * Below-the-fold modules (and GSAP with them) stay out of the first load,
 * which keeps the main thread free while the hero paints.
 */
const sections: (() => Promise<void>)[] = [];
let rendered = 0; // sections whose code has loaded *and* rendered

export function whenNear(
  el: HTMLElement,
  load: () => Promise<(host: HTMLElement) => void>,
  { eager = false, margin = '800px 0px' } = {},
): void {
  let started: Promise<void> | null = null;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) void start();
    },
    { rootMargin: margin },
  );

  const start = (): Promise<void> => {
    if (started) return started;
    observer.disconnect();
    started = load()
      .then((init) => init(el))
      .catch((error: unknown) => console.error('Section failed to load', error))
      .finally(() => (rendered += 1));
    return started;
  };

  sections.push(start);
  if (eager) void start();
  else observer.observe(el);
}

/** Render every section that hasn't loaded yet (used before jumping to an anchor). */
export function loadAllSections(): Promise<void> {
  return Promise.all(sections.map((start) => start())).then(() => undefined);
}

export const allSectionsLoaded = (): boolean => rendered === sections.length;

/** Run non-urgent work after the browser has painted and gone idle. */
export function afterPaint(work: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(work, { timeout: 1200 });
  else setTimeout(work, 200);
}
