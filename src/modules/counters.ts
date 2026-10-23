import { qsa } from '../lib/dom';
import { prefersReducedMotion } from '../lib/motion';

const DURATION_MS = 1600;

/** Counts each [data-count] element up from 0 the first time it scrolls into view. */
export function initCounters(scope: ParentNode = document): void {
  const counters = qsa('[data-count]', scope);
  if (prefersReducedMotion() || counters.length === 0) return; // final values stay as written

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (entry.target instanceof HTMLElement) countUp(entry.target);
      }
    },
    { threshold: 0.6 },
  );

  for (const el of counters) {
    el.textContent = format(0, el);
    observer.observe(el);
  }
}

function countUp(el: HTMLElement): void {
  const target = Number(el.dataset.count) || 0;
  const start = performance.now();

  const frame = (now: number): void => {
    const t = Math.min(1, (now - start) / DURATION_MS);
    const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t); // expo.out
    el.textContent = format(Math.round(target * eased), el);
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function format(value: number, el: HTMLElement): string {
  return `${value}${el.dataset.suffix ?? ''}`;
}
