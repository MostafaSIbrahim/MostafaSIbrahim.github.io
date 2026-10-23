// Vite's ?raw import: the real source of this site's typewriter module, as a string.
import typewriterSource from './typewriter.ts?raw';
import { qs } from '../lib/dom';
import { gsap } from '../lib/gsap';
import { highlight } from '../lib/highlight';
import { prefersReducedMotion } from '../lib/motion';

/** Shows real source code from this site, highlighted, with lines that type in on first view. */
export function initCodePanel(host: HTMLElement): void {
  const code = qs('code', host);
  const lines = highlight(typewriterSource.trimEnd());
  code.replaceChildren(...lines.flatMap((line, i) => (i === 0 ? [line] : ['\n', line])));

  if (prefersReducedMotion()) return;
  gsap.from(lines, {
    opacity: 0,
    x: -8,
    duration: 0.3,
    ease: 'power2.out',
    stagger: 0.03,
    scrollTrigger: { trigger: host, start: 'top 75%', once: true },
  });
}
