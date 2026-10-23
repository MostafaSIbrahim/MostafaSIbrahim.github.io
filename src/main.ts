import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { qs } from './lib/dom';
import { initTheme } from './modules/theme';
import { initNav } from './modules/nav';
import { initHeroCanvas } from './modules/hero-canvas';
import { initTypewriter } from './modules/typewriter';
import { initCounters } from './modules/counters';
import { initStack } from './modules/stack';

initTheme(qs<HTMLButtonElement>('#theme-toggle'));
initNav();
initHeroCanvas(qs<HTMLCanvasElement>('.hero-canvas'));
initTypewriter(qs('[data-typewriter]'));
initCounters();
initStack(qs('[data-stack]'));

qs('[data-year]').textContent = String(new Date().getFullYear());
