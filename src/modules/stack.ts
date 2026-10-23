import segmentsData from '../data/segments.json';
import type { Segment } from '../types/content';
import { h, svg } from '../lib/dom';

// Assigning to Segment[] makes the compiler check the JSON against the content contract.
const segments: Segment[] = segmentsData;

const DEFAULT_SEGMENT = 'development';

/**
 * "The Stack of a Career": IT domains drawn as stacked layers (bottom = datacenters).
 * Implements the WAI-ARIA tabs pattern: roving tabindex, arrow keys, Home/End.
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

  const select = (index: number, moveFocus: boolean): void => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = panels[i];
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tabs[index]?.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index, false));
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
      select(next, true);
    });
  });

  const start = segments.findIndex((s) => s.id === DEFAULT_SEGMENT);
  select(start === -1 ? 0 : start, false);
  host.replaceChildren(tablist, panelArea);
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
