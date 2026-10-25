import segmentsData from '../data/segments.json';
import type { Segment } from '../types/content';
import { h, svg } from '../lib/dom';
import { onReducedMotionChange, prefersReducedMotion } from '../lib/motion';

// Assigning to Segment[] makes the compiler check the JSON against the content contract.
const segments: Segment[] = segmentsData;

const TOUR_MS = 4500; // time each layer stays selected during the tour

/**
 * "The Stack of a Career": IT domains drawn as stacked layers (bottom = datacenters).
 * Implements the WAI-ARIA tabs pattern: roving tabindex, arrow keys, Home/End.
 *
 * A tour climbs the layers bottom-up on its own, so no single layer reads as "where I am".
 * It pauses on hover, focus, off screen or in a hidden tab, has a visible Pause button
 * (WCAG 2.2.2), stops for good once the visitor picks a layer, and never runs with
 * reduced motion; then the top layer, the current role, is shown.
 */
export function initStack(host: HTMLElement): void {
  const tablist = h('div', {
    class: 'stack-layers',
    role: 'tablist',
    'aria-label': 'IT domains, from foundation to leadership',
    'aria-orientation': 'vertical',
  });
  const panelArea = h('div', { class: 'stack-panels' });
  const tabs: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];

  segments.forEach((segment, index) => {
    const tabId = `stack-tab-${segment.id}`;
    const panelId = `stack-panel-${segment.id}`;

    const tab = h(
      'button',
      {
        class: 'layer',
        type: 'button',
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        'aria-selected': 'false',
        tabindex: -1,
      },
      slab(),
      h(
        'span',
        { class: 'layer-text' },
        h('span', { class: 'layer-index' }, `L${index + 1}`),
        h('span', { class: 'layer-title' }, segment.title),
      ),
    );

    const panel = renderPanel(segment, panelId, tabId);
    tabs.push(tab);
    panels.push(panel);
    tablist.append(tab);
    panelArea.append(panel);
  });

  let current = 0;
  const select = (index: number, moveFocus: boolean): void => {
    current = index;
    tablist.style.setProperty('--tour-step', String(index));
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tabs[index]?.focus();
  };

  // ---- Tour ----
  const toggle = h('button', { class: 'stack-tour-toggle', type: 'button' });
  const progress = h('span', { class: 'stack-tour-progress', 'aria-hidden': 'true' });
  let touring = !prefersReducedMotion();
  let stopped = false; // the visitor took over: the tour never restarts on its own
  let hovered = false;
  let focused = false;
  let inView = false;
  let timer = 0;

  const renderToggle = (): void => {
    toggle.hidden = stopped;
    toggle.textContent = touring ? 'Pause tour' : 'Play tour';
    toggle.setAttribute(
      'aria-label',
      touring ? 'Pause the automatic tour of the layers' : 'Play the automatic tour of the layers',
    );
  };

  function schedule(): void {
    window.clearTimeout(timer);
    const running = touring && !stopped && !hovered && !focused && inView && !document.hidden;
    host.classList.toggle('is-touring', running);
    if (!running) return;
    // Restart the progress bar for this step.
    progress.classList.remove('is-running');
    void progress.offsetWidth;
    progress.classList.add('is-running');
    timer = window.setTimeout(() => {
      select((current + 1) % tabs.length, false);
      schedule();
    }, TOUR_MS);
  }

  const takeOver = (): void => {
    if (stopped) return;
    stopped = true;
    touring = false;
    renderToggle();
    schedule();
  };

  toggle.addEventListener('click', () => {
    touring = !touring;
    renderToggle();
    schedule();
  });
  // Reading pauses the tour: hovering the layers or the panel (not the Play button).
  for (const area of [tablist, panelArea]) {
    area.addEventListener('pointerenter', () => {
      hovered = true;
      schedule();
    });
    area.addEventListener('pointerleave', () => {
      hovered = false;
      schedule();
    });
  }
  // Focus on a layer or inside a panel pauses; focus on the toggle itself does not.
  host.addEventListener('focusin', (event) => {
    focused = event.target !== toggle;
    schedule();
  });
  host.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
    focused = false;
    schedule();
  });
  new IntersectionObserver(
    ([entry]) => {
      inView = entry?.isIntersecting ?? false;
      schedule();
    },
    { threshold: 0.35 },
  ).observe(host);
  document.addEventListener('visibilitychange', schedule);
  onReducedMotionChange((reduced) => {
    if (reduced) takeOver();
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      takeOver();
      select(index, false);
    });
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      // The stack is drawn bottom-up, so Up/Right climb to the next layer.
      const keyMap: Record<string, number> = {
        ArrowUp: index === last ? 0 : index + 1,
        ArrowRight: index === last ? 0 : index + 1,
        ArrowDown: index === 0 ? last : index - 1,
        ArrowLeft: index === 0 ? last : index - 1,
        Home: 0,
        End: last,
      };
      const next = keyMap[event.key];
      if (next === undefined) return;
      event.preventDefault();
      takeOver();
      select(next, true);
    });
  });

  // Other sections (e.g. the career timeline) can ask for a layer by id.
  document.addEventListener('stack:select', (event) => {
    const index = segments.findIndex((s) => s.id === event.detail);
    if (index === -1) return;
    takeOver();
    select(index, false);
  });

  // Touring starts at the foundation; without the tour, show the top layer (the current role).
  select(touring ? 0 : tabs.length - 1, false);
  if (!touring) stopped = true;
  renderToggle();
  host.replaceChildren(
    h('div', { class: 'stack-nav' }, h('div', { class: 'stack-tour' }, toggle, progress), tablist),
    panelArea,
  );
  schedule();
}

function renderPanel(segment: Segment, id: string, labelledBy: string): HTMLElement {
  const block = (title: string, items: string[], listClass: string): HTMLElement | null =>
    items.length === 0
      ? null
      : h(
          'div',
          { class: 'panel-block' },
          h('h4', {}, title),
          h('ul', { class: listClass }, ...items.map((item) => h('li', {}, item))),
        );

  return h(
    'div',
    {
      class: 'stack-panel',
      role: 'tabpanel',
      id,
      'aria-labelledby': labelledBy,
      tabindex: 0,
      hidden: true,
    },
    segment.years ? h('p', { class: 'panel-years' }, segment.years) : null,
    h('h3', {}, segment.title),
    h('p', { class: 'panel-summary' }, segment.summary),
    block('What I did', segment.responsibilities, 'panel-list'),
    block('Platforms & tools', segment.platforms, 'chip-list'),
    block('Results', segment.outcomes, 'panel-list'),
  );
}

/** An isometric slab: top face plus two visible sides. */
function slab(): SVGSVGElement {
  return svg(
    'svg',
    { class: 'layer-slab', viewBox: '0 0 120 52', 'aria-hidden': 'true', focusable: 'false' },
    svg('polygon', { class: 'slab-left', points: '0,20 60,40 60,52 0,32' }),
    svg('polygon', { class: 'slab-right', points: '60,40 120,20 120,32 60,52' }),
    svg('polygon', { class: 'slab-top', points: '0,20 60,0 120,20 60,40' }),
  );
}
