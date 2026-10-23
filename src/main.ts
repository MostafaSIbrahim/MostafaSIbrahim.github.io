import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { qs } from './lib/dom';
import { ScrollTrigger } from './lib/gsap';
import { initTheme } from './modules/theme';
import { initNav } from './modules/nav';
import { initHeroCanvas } from './modules/hero-canvas';
import { initTypewriter } from './modules/typewriter';
import { initCounters } from './modules/counters';
import { initStack } from './modules/stack';
import { initTimeline } from './modules/timeline';
import { initSkills } from './modules/skills';
import { initCodePanel } from './modules/code-panel';

initTheme(qs<HTMLButtonElement>('#theme-toggle'));
initNav();
initHeroCanvas(qs<HTMLCanvasElement>('.hero-canvas'));
initTypewriter(qs('[data-typewriter]'));
initCounters();
initStack(qs('[data-stack]'));
initTimeline(qs('[data-timeline]'));
initSkills(qs('[data-skills]'));
initCodePanel(qs('[data-code-panel]'));

qs('[data-year]').textContent = String(new Date().getFullYear());

// Web fonts change text widths; re-measure scroll-driven animations once they're in.
void document.fonts.ready.then(() => ScrollTrigger.refresh());
