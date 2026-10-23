import projectsData from '../data/projects.json';
import type { Project } from '../types/content';
import { h } from '../lib/dom';
import { Flip, gsap } from '../lib/gsap';
import { prefersReducedMotion } from '../lib/motion';
import { enhanceProjectCard, renderProjectCard } from './project-card';
import { createProjectDialog } from './project-dialog';

export const projects: Project[] = projectsData;

const HASH_PREFIX = '#work/';

/**
 * Portfolio gallery: tag filters, animated cards, and a case-study dialog.
 * Each project has its own URL (#work/<slug>), so a link can open it directly.
 */
export function initGallery(host: HTMLElement): void {
  const tags = [...new Set(projects.flatMap((p) => p.tags))];
  const filters = ['All', ...tags].map((tag) =>
    h(
      'button',
      {
        class: 'filter',
        type: 'button',
        'data-filter': tag,
        'aria-pressed': String(tag === 'All'),
      },
      tag,
    ),
  );
  const cards = projects.map(renderProjectCard);
  const status = h('p', { class: 'skills-status', role: 'status' });
  host.replaceChildren(
    h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter projects' }, ...filters),
    status,
    h('ul', { class: 'project-grid' }, ...cards),
  );
  cards.forEach(enhanceProjectCard);

  // ---- Filters ----
  const apply = (tag: string, animate: boolean): void => {
    const state = Flip.getState(cards);
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === tag)));
    cards.forEach((card) => {
      card.hidden = tag !== 'All' && !(card.dataset.tags ?? '').split('|').includes(tag);
    });
    const shown = cards.filter((c) => !c.hidden).length;
    status.textContent = `Showing ${shown} of ${cards.length} projects`;
    if (!animate || prefersReducedMotion()) return;
    Flip.from(state, {
      duration: 0.5,
      ease: 'expo.out',
      absolute: true,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.2 }),
    });
  };
  filters.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter ?? 'All', true)));
  apply('All', false);

  // ---- Case-study dialog + deep links ----
  let opener: HTMLElement | null = null;
  const dialog = createProjectDialog(() => {
    if (location.hash.startsWith(HASH_PREFIX)) history.replaceState(null, '', '#work');
    opener?.focus(); // return focus to the card that opened it
  });

  const openBySlug = (slug: string, trigger: HTMLElement | null): void => {
    const project = projects.find((p) => p.slug === slug);
    if (!project) return;
    opener = trigger;
    history.replaceState(null, '', `${HASH_PREFIX}${slug}`);
    dialog.open(project);
  };

  host.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('a')) return; // the Live demo link keeps its own behaviour
    const card = target.closest<HTMLElement>('.project-card');
    const slug = card?.dataset.slug;
    if (slug) openBySlug(slug, card.querySelector('.project-open'));
  });

  const fromHash = (): void => {
    if (!location.hash.startsWith(HASH_PREFIX)) return;
    const slug = decodeURIComponent(location.hash.slice(HASH_PREFIX.length));
    document.getElementById('work')?.scrollIntoView();
    openBySlug(slug, host.querySelector(`[data-open="${CSS.escape(slug)}"]`));
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}
