import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { qs } from './lib/dom';
import { afterPaint, allSectionsLoaded, loadAllSections, whenNear } from './lib/lazy';
import { prefersReducedMotion } from './lib/motion';
import { initTheme } from './modules/theme';
import { initNav } from './modules/nav';
import { initTypewriter } from './modules/typewriter';
import { initCounters } from './modules/counters';
import { initStack } from './modules/stack';

// ---- First screen: needed immediately, all small ----
initTheme(qs<HTMLButtonElement>('#theme-toggle'));
initNav();
initTypewriter(qs('[data-typewriter]'));
initCounters();
initStack(qs('[data-stack]'));
qs('[data-year]').textContent = String(new Date().getFullYear());

// ---- The hero canvas starts once the page has painted ----
afterPaint(() => {
  void import('./modules/hero-canvas').then(({ initHeroCanvas }) =>
    initHeroCanvas(qs<HTMLCanvasElement>('.hero-canvas')),
  );
});

// ---- Below the fold: each section loads its code (and GSAP) on approach ----
whenNear(qs('[data-timeline]'), async () => (await import('./modules/timeline')).initTimeline);
whenNear(qs('[data-skills]'), async () => (await import('./modules/skills')).initSkills);
whenNear(qs('[data-code-panel]'), async () => (await import('./modules/code-panel')).initCodePanel);
whenNear(qs('[data-gallery]'), async () => (await import('./modules/gallery')).initGallery, {
  eager: location.hash.startsWith('#work/'), // deep link: open the project straight away
});

// ---- First interaction: render the remaining sections in the background ----
// By the time anyone has scrolled far, everything below is ready and nothing shifts.
const warmUp = (): void => {
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
    window.removeEventListener(type, warmUp);
  }
  void loadAllSections();
};
for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
  window.addEventListener(type, warmUp, { once: true, passive: true });
}

// ---- Anchor jumps (nav links, /#contact URLs): render every section first ----
// Otherwise sections loading on the way would grow and push the target down the page.
const jumpTo = (id: string, smooth: boolean): void => {
  const target = document.getElementById(id);
  if (!target) return;
  void loadAllSections().then(() =>
    requestAnimationFrame(() =>
      target.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' }),
    ),
  );
};

document.addEventListener('click', (event) => {
  if (allSectionsLoaded() || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
  const id = link?.getAttribute('href')?.slice(1);
  if (!id || id === 'main' || id.startsWith('work/') || !document.getElementById(id)) return;
  event.preventDefault();
  history.pushState(null, '', `#${id}`);
  jumpTo(id, true);
});

const initialHash = location.hash.slice(1);
if (initialHash && !initialHash.startsWith('work/') && initialHash !== 'main') {
  jumpTo(initialHash, false);
}
