import type { Project } from '../types/content';
import { h } from '../lib/dom';
import { prefersReducedMotion } from '../lib/motion';

const MAX_STACK_CHIPS = 5;
const MAX_TILT_DEG = 6;

/**
 * One portfolio card. Pure rendering (no global state), so the admin page can reuse it
 * for its live preview. The title is a button stretched over the whole card.
 */
export function renderProjectCard(project: Project): HTMLLIElement {
  const { media } = project;
  const hasVideo = Boolean(media.previewMp4 || media.previewWebm);

  const video = hasVideo
    ? h(
        'video',
        {
          class: 'project-video',
          muted: true,
          loop: true,
          playsinline: true,
          preload: 'none',
          poster: media.poster,
          'aria-hidden': 'true',
          tabindex: -1,
        },
        media.previewWebm ? h('source', { src: media.previewWebm, type: 'video/webm' }) : null,
        media.previewMp4 ? h('source', { src: media.previewMp4, type: 'video/mp4' }) : null,
      )
    : null;

  // Autoplay rules check the `muted` property; an attribute set from script doesn't set it.
  if (video) video.muted = true;

  const extra = project.stack.length - MAX_STACK_CHIPS;

  return h(
    'li',
    { class: 'project-card', 'data-slug': project.slug, 'data-tags': project.tags.join('|') },
    h(
      'article',
      { class: 'project-inner' },
      h(
        'div',
        { class: 'project-media' },
        h('img', {
          src: media.poster,
          alt: '',
          loading: 'lazy',
          decoding: 'async',
        }),
        video,
        project.demoUrl ? h('span', { class: 'project-live' }, 'Live demo') : null,
        hasVideo ? h('span', { class: 'project-motion', 'aria-hidden': 'true' }, '▶ motion') : null,
      ),
      h(
        'div',
        { class: 'project-body' },
        h(
          'p',
          { class: 'project-meta' },
          [project.year, ...project.tags].filter(Boolean).join(' · '),
        ),
        h(
          'h3',
          { class: 'project-title' },
          h(
            'button',
            { class: 'project-open', type: 'button', 'data-open': project.slug },
            project.title,
          ),
        ),
        h('p', { class: 'project-tagline' }, project.tagline),
        h(
          'ul',
          { class: 'chip-list project-stack', 'aria-label': 'Technology stack' },
          ...project.stack.slice(0, MAX_STACK_CHIPS).map((s) => h('li', {}, s)),
          extra > 0 ? h('li', { class: 'chip-more' }, `+${extra}`) : null,
        ),
        h(
          'div',
          { class: 'project-actions' },
          h('span', { class: 'project-cta', 'aria-hidden': 'true' }, 'View case study →'),
          project.demoUrl
            ? h(
                'a',
                {
                  class: 'project-demo',
                  href: project.demoUrl,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                },
                'Live demo',
                h(
                  'span',
                  { class: 'visually-hidden' },
                  ` for ${project.title} (opens in a new tab)`,
                ),
                h('span', { 'aria-hidden': 'true' }, ' ↗'),
              )
            : null,
        ),
      ),
    ),
  );
}

/** Hover/focus effects: a gentle 3D tilt and the muted motion preview. */
export function enhanceProjectCard(card: HTMLElement): void {
  if (prefersReducedMotion()) return;
  const inner = card.querySelector<HTMLElement>('.project-inner');
  const video = card.querySelector<HTMLVideoElement>('video');
  let frame = 0;

  const start = (): void => {
    card.classList.add('is-hot');
    if (video) void video.play().catch(() => undefined); // autoplay may be refused; the poster stays
  };
  const stop = (): void => {
    card.classList.remove('is-hot');
    inner?.style.removeProperty('--rx');
    inner?.style.removeProperty('--ry');
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
  };

  card.addEventListener('pointerenter', start);
  card.addEventListener('pointerleave', stop);
  card.addEventListener('focusin', start);
  card.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) stop();
  });

  card.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !inner || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - 0.5;
      const y = (event.clientY - r.top) / r.height - 0.5;
      inner.style.setProperty('--rx', `${(-y * MAX_TILT_DEG).toFixed(2)}deg`);
      inner.style.setProperty('--ry', `${(x * MAX_TILT_DEG).toFixed(2)}deg`);
    });
  });
}
