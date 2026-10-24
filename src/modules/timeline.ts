import careerData from '../data/career.json';
import segmentsData from '../data/segments.json';
import type { Milestone, Segment } from '../types/content';
import { h, svg } from '../lib/dom';
import { onReducedMotionChange, prefersReducedMotion } from '../lib/motion';

const milestones: Milestone[] = careerData;
const segments: Segment[] = segmentsData;

const AUTO_MS = 5000; // time each card stays at the front while auto-rotating
const SWIPE_PX = 40; // minimum horizontal drag that counts as a swipe
const GAP_PX = 32; // extra space between neighbouring cards on the ring

/**
 * Career timeline as a 3D cylinder: cards sit around a ring, the front one is readable,
 * the rest turn away and dim. Rotates slowly on its own (pausable) or with buttons,
 * year chips, arrow keys and swipes. Follows the WAI-ARIA carousel pattern.
 */
export function initTimeline(host: HTMLElement): void {
  const items = milestones.slice().sort((a, b) => a.start - b.start); // stable: JSON order breaks ties
  const count = items.length;
  const step = 360 / count;
  const segmentTitle = (id: string): string => segments.find((s) => s.id === id)?.title ?? id;

  let position = 0; // unbounded, so the ring always turns the short way round
  let playing = !prefersReducedMotion();
  let hovered = false;
  let focused = false;
  let inView = false;
  let timer = 0;

  // ---- Markup ----
  const cards = items.map((m, i) =>
    h(
      'div',
      {
        class: 'milestone',
        role: 'group',
        'aria-roledescription': 'slide',
        'aria-label': `${i + 1} of ${count}: ${m.role}`,
      },
      h('p', { class: 'milestone-year' }, m.period),
      h('h3', { class: 'milestone-role' }, m.role),
      h('p', { class: 'milestone-org' }, m.org),
      h('ul', { class: 'milestone-points' }, ...m.highlights.map((text) => h('li', {}, text))),
      m.segment
        ? h(
            'a',
            { class: 'milestone-segment', href: '#stack', 'data-segment': m.segment },
            segmentTitle(m.segment),
          )
        : null,
    ),
  );
  cards.forEach((card, i) => card.style.setProperty('--angle', `${i * step}deg`));

  const ring = h('div', { class: 'carousel-ring' }, ...cards);
  const stage = h('div', { class: 'carousel-stage' }, ring);

  const arrow = (d: string): SVGSVGElement =>
    svg('svg', { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, svg('path', { d }));
  const prev = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': 'Previous milestone' },
    arrow('M15 6l-6 6 6 6'),
  );
  const next = h(
    'button',
    { class: 'icon-btn', type: 'button', 'aria-label': 'Next milestone' },
    arrow('M9 6l6 6-6 6'),
  );
  const toggle = h('button', { class: 'carousel-toggle', type: 'button' });
  const status = h('p', { class: 'carousel-status', 'aria-live': 'off', 'aria-atomic': 'true' });

  // The accessible name starts with the visible text (WCAG 2.5.3 "label in name").
  const years = items.map((m) => {
    const label = m.chip ?? String(m.start);
    return h(
      'button',
      { class: 'carousel-year', type: 'button', 'aria-label': `${label}: ${m.role}, ${m.period}` },
      label,
    );
  });

  const carousel = h(
    'div',
    {
      class: 'carousel',
      role: 'region',
      'aria-roledescription': 'carousel',
      'aria-label': 'Career milestones',
    },
    // The rotation control comes first in tab order, as the carousel pattern requires.
    h(
      'div',
      { class: 'carousel-controls' },
      toggle,
      status,
      h('span', { class: 'carousel-arrows' }, prev, next),
    ),
    stage,
    h('div', { class: 'carousel-years' }, ...years),
  );
  host.replaceChildren(carousel);

  // ---- Geometry: radius from card width and count; ring height from the tallest card ----
  const layout = (): void => {
    const width = cards[0]?.offsetWidth ?? 320;
    const radius = Math.round(width / 2 / Math.tan(Math.PI / count)) + GAP_PX;
    carousel.style.setProperty('--card-h', 'auto');
    const height = Math.max(...cards.map((card) => card.offsetHeight));
    carousel.style.setProperty('--radius', `${radius}px`);
    carousel.style.setProperty('--card-h', `${height}px`);
  };

  // ---- State ----
  const active = (): number => ((position % count) + count) % count;

  const render = (): void => {
    const current = active();
    ring.style.setProperty('--rotation', `${-position * step}deg`);
    cards.forEach((card, i) => {
      const raw = Math.abs(i - current);
      const distance = Math.min(raw, count - raw);
      const front = distance === 0;
      card.style.setProperty('--dist', String(distance));
      card.classList.toggle('is-front', front);
      card.setAttribute('aria-hidden', String(!front));
      card.querySelectorAll('a').forEach((link) => (link.tabIndex = front ? 0 : -1));
    });
    years.forEach((button, i) => {
      if (i === current) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    const m = items[current];
    status.textContent = m ? `${current + 1} / ${count} · ${m.period} · ${m.role}` : '';
    toggle.textContent = playing ? 'Pause' : 'Play';
    toggle.setAttribute(
      'aria-label',
      playing ? 'Pause automatic rotation' : 'Start automatic rotation',
    );
  };

  /** Turn to card `target`. `byUser` announces the change; auto-rotation stays silent. */
  function go(target: number, byUser: boolean): void {
    let delta = (((target - active()) % count) + count) % count;
    if (delta > count / 2) delta -= count;
    position += delta;
    status.setAttribute('aria-live', byUser ? 'polite' : 'off');
    render();
    schedule();
  }

  // ---- Auto-rotation: pauses on hover, focus, off screen, hidden tab, or when stopped ----
  function schedule(): void {
    window.clearTimeout(timer);
    if (playing && !hovered && !focused && inView && !document.hidden) {
      timer = window.setTimeout(() => go(active() + 1, false), AUTO_MS);
    }
  }

  // ---- Wiring ----
  prev.addEventListener('click', () => go(active() - 1, true));
  next.addEventListener('click', () => go(active() + 1, true));
  years.forEach((button, i) => button.addEventListener('click', () => go(i, true)));
  toggle.addEventListener('click', () => {
    playing = !playing;
    render();
    schedule();
  });

  // Clicking a side card brings it to the front; a segment chip opens that Stack layer.
  ring.addEventListener('click', (event) => {
    if (swiped) {
      swiped = false; // the click a mouse drag fires on release is not a real click
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const index = cards.findIndex((card) => target && card.contains(target));
    if (index !== -1 && index !== active()) {
      event.preventDefault();
      go(index, true);
      return;
    }
    const chip = target?.closest<HTMLElement>('[data-segment]');
    if (chip?.dataset.segment) {
      document.dispatchEvent(new CustomEvent('stack:select', { detail: chip.dataset.segment }));
    }
  });

  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') go(active() - 1, true);
    else if (event.key === 'ArrowRight') go(active() + 1, true);
    else return;
    event.preventDefault();
  });

  // Swipe (touch, pen or mouse drag) on the stage.
  let startX: number | null = null;
  let swiped = false;
  stage.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
    swiped = false;
  });
  stage.addEventListener('pointerup', (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    swiped = true;
    go(active() + (dx < 0 ? 1 : -1), true);
  });

  carousel.addEventListener('pointerenter', () => {
    hovered = true;
    schedule();
  });
  carousel.addEventListener('pointerleave', () => {
    hovered = false;
    schedule();
  });
  carousel.addEventListener('focusin', () => {
    focused = true;
    schedule();
  });
  carousel.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && carousel.contains(event.relatedTarget)) return;
    focused = false;
    schedule();
  });

  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? false;
    schedule();
  }).observe(carousel);
  document.addEventListener('visibilitychange', schedule);
  onReducedMotionChange((reduced) => {
    if (reduced) playing = false;
    render();
    schedule();
  });
  new ResizeObserver(layout).observe(stage);

  layout();
  render();
}
