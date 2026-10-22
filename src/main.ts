import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/main.css';

import { qs } from './lib/dom';
import { initTheme } from './modules/theme';
import { initNav } from './modules/nav';

initTheme(qs<HTMLButtonElement>('#theme-toggle'));
initNav();

qs('[data-year]').textContent = String(new Date().getFullYear());
