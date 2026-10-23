import skillsData from '../data/skills.json';
import type { Skill, SkillGroup } from '../types/content';
import { h } from '../lib/dom';
import { Flip, gsap } from '../lib/gsap';
import { prefersReducedMotion } from '../lib/motion';

const GROUPS: Record<SkillGroup, string> = {
  languages: 'Languages',
  backend: 'Backend',
  frontend: 'Frontend',
  data: 'Data',
  devops: 'DevOps & Cloud',
  tools: 'Tools',
};

// Until projects.json is filled in Sprint 4.
const PROJECT_NAMES: Record<string, string> = {
  safyaclinic: 'SafyaClinic',
  'student-management': 'Student Management',
  portal: 'This portal',
};

type Filter = SkillGroup | 'all';

// JSON strings are just `string` to TypeScript, so check each group at load time instead of casting.
const isGroup = (value: string): value is SkillGroup => value in GROUPS;
const skills: Skill[] = skillsData.map((skill) => {
  if (!isGroup(skill.group)) throw new Error(`skills.json: unknown group "${skill.group}"`);
  return { ...skill, group: skill.group };
});

/** Filterable technology matrix; cards re-flow with GSAP Flip when the filter changes. */
export function initSkills(host: HTMLElement): void {
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ...(Object.entries(GROUPS) as [SkillGroup, string][]),
  ];

  const buttons = filters.map(([value, label]) =>
    h(
      'button',
      { class: 'filter', type: 'button', 'data-filter': value, 'aria-pressed': 'false' },
      label,
    ),
  );

  const cards = skills.map((skill) =>
    h(
      'li',
      { class: 'skill-card', 'data-group': skill.group },
      h('span', { class: 'skill-group' }, GROUPS[skill.group]),
      h('span', { class: 'skill-name' }, skill.name),
      skill.years ? h('span', { class: 'skill-years' }, `${skill.years}+ yrs`) : null,
      skill.projects.length > 0
        ? h(
            'span',
            { class: 'skill-projects' },
            skill.projects.map((slug) => PROJECT_NAMES[slug] ?? slug).join(' · '),
          )
        : null,
    ),
  );

  const status = h('p', { class: 'skills-status', role: 'status' });
  const grid = h('ul', { class: 'skill-grid' }, ...cards);

  host.replaceChildren(
    h('div', { class: 'filters', role: 'group', 'aria-label': 'Filter technologies' }, ...buttons),
    status,
    grid,
  );

  const apply = (filter: Filter, animate: boolean): void => {
    const state = Flip.getState(cards);

    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    cards.forEach((card) => (card.hidden = filter !== 'all' && card.dataset.group !== filter));

    const shown = cards.filter((c) => !c.hidden).length;
    status.textContent = `Showing ${shown} of ${cards.length} technologies`;

    if (!animate || prefersReducedMotion()) return;
    Flip.from(state, {
      duration: 0.5,
      ease: 'expo.out',
      absolute: true,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.25 }),
    });
  };

  buttons.forEach((button) =>
    button.addEventListener('click', () => apply(button.dataset.filter as Filter, true)),
  );
  apply('all', false);
}
