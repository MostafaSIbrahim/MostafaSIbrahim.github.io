import type { Project } from '../types/content';
import { h, svg } from '../lib/dom';

interface MediaItem {
  kind: 'video' | 'image';
  label: string;
  render: () => HTMLElement;
}

export interface ProjectDialog {
  open: (project: Project) => void;
  close: () => void;
  element: HTMLDialogElement;
}

/**
 * Project case-study viewer on a native <dialog>: focus is trapped and Escape closes it
 * for free. Media viewer (motion preview + screenshots), case study, demo credentials.
 */
export function createProjectDialog(onClose?: () => void): ProjectDialog {
  const content = h('div', { class: 'dialog-content' });
  const closeButton = h(
    'button',
    { class: 'icon-btn dialog-close', type: 'button', 'aria-label': 'Close project details' },
    svg(
      'svg',
      { class: 'icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
      svg('path', { d: 'M6 6l12 12M18 6L6 18' }),
    ),
  );
  const dialog = h(
    'dialog',
    { class: 'project-dialog', 'aria-labelledby': 'dialog-title' },
    closeButton,
    content,
  );
  document.body.append(dialog);

  closeButton.addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the <dialog> itself, outside its inner box.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.querySelectorAll('video').forEach((v) => v.pause());
    onClose?.();
  });

  const open = (project: Project): void => {
    content.replaceChildren(...renderContent(project));
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    closeButton.focus();
  };

  return { open, close: () => dialog.close(), element: dialog };
}

function renderContent(p: Project): HTMLElement[] {
  const header = h(
    'header',
    { class: 'dialog-header' },
    h('p', { class: 'project-meta' }, [p.year, ...p.tags].filter(Boolean).join(' · ')),
    h('h2', { id: 'dialog-title' }, p.title),
    h('p', { class: 'dialog-tagline' }, p.tagline),
  );

  const caseStudy = h(
    'div',
    { class: 'case-study' },
    ...(
      [
        ['The challenge', p.challenge],
        ['The solution', p.solution],
        ['The result', p.result],
      ] as const
    ).map(([title, text]) => h('section', {}, h('h3', {}, title), h('p', {}, text))),
  );

  const facts = h(
    'dl',
    { class: 'dialog-facts' },
    h('div', {}, h('dt', {}, 'My role'), h('dd', {}, p.role.join(', '))),
    h(
      'div',
      {},
      h('dt', {}, 'Stack'),
      h('dd', {}, h('ul', { class: 'chip-list' }, ...p.stack.map((s) => h('li', {}, s)))),
    ),
  );

  const links = h(
    'div',
    { class: 'dialog-actions' },
    p.demoUrl
      ? h(
          'a',
          {
            class: 'btn btn-primary',
            href: p.demoUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          'Open live demo',
          h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
          h('span', { 'aria-hidden': 'true' }, ' ↗'),
        )
      : null,
    p.sourceUrl
      ? h(
          'a',
          {
            class: 'btn btn-ghost',
            href: p.sourceUrl,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          'View source',
          h('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
          h('span', { 'aria-hidden': 'true' }, ' ↗'),
        )
      : null,
  );

  return [
    header,
    renderViewer(p),
    h(
      'div',
      { class: 'dialog-columns' },
      caseStudy,
      h('div', {}, facts, renderCredentials(p), links),
    ),
  ];
}

/** Main media area + thumbnail strip; arrow keys move between items. */
function renderViewer(p: Project): HTMLElement {
  const items: MediaItem[] = [];
  const { media } = p;

  if (media.previewMp4 || media.previewWebm) {
    items.push({
      kind: 'video',
      label: 'Motion preview',
      render: () => {
        const video = h(
          'video',
          {
            controls: true,
            muted: true,
            loop: true,
            playsinline: true,
            autoplay: !matchMedia('(prefers-reduced-motion: reduce)').matches,
            poster: media.poster,
            'aria-label': `${p.title} motion preview`,
          },
          media.previewWebm ? h('source', { src: media.previewWebm, type: 'video/webm' }) : null,
          media.previewMp4 ? h('source', { src: media.previewMp4, type: 'video/mp4' }) : null,
        );
        video.muted = true; // property, not attribute: required for autoplay
        return video;
      },
    });
  }
  for (const shot of media.screenshots) {
    items.push({
      kind: 'image',
      label: shot.caption,
      render: () =>
        h(
          'figure',
          {},
          h('img', { src: shot.src, alt: shot.alt, decoding: 'async' }),
          h('figcaption', {}, shot.caption),
        ),
    });
  }
  if (items.length === 0) {
    items.push({
      kind: 'image',
      label: p.title,
      render: () => h('img', { src: media.poster, alt: '' }),
    });
  }

  const stage = h('div', { class: 'viewer-stage' });
  const status = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const thumbs = items.map((item, i) =>
    h(
      'button',
      {
        class: 'viewer-thumb',
        type: 'button',
        'aria-label': `${item.kind === 'video' ? 'Play' : 'Show'}: ${item.label}`,
      },
      item.kind === 'video'
        ? h('span', { class: 'viewer-thumb-video', 'aria-hidden': 'true' }, '▶')
        : h('img', {
            src: media.screenshots[i - (items[0]?.kind === 'video' ? 1 : 0)]?.src ?? '',
            alt: '',
          }),
    ),
  );

  let current = 0;
  const show = (index: number): void => {
    current = (index + items.length) % items.length;
    stage.replaceChildren(items[current]?.render() ?? '');
    thumbs.forEach((t, i) => t.setAttribute('aria-pressed', String(i === current)));
    status.textContent = `${current + 1} of ${items.length}: ${items[current]?.label ?? ''}`;
  };
  thumbs.forEach((t, i) => t.addEventListener('click', () => show(i)));

  const viewer = h(
    'div',
    { class: 'viewer', role: 'group', 'aria-label': `${p.title} media` },
    stage,
    items.length > 1 ? h('div', { class: 'viewer-thumbs' }, ...thumbs) : null,
    status,
  );
  viewer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') show(current + 1);
    else if (event.key === 'ArrowLeft') show(current - 1);
    else return;
    event.preventDefault();
    thumbs[current]?.focus();
  });

  show(0);
  return viewer;
}

function renderCredentials(p: Project): HTMLElement | null {
  const c = p.credentials;
  if (!c) return null;

  const row = (label: string, value: string): HTMLElement => {
    const copy = h(
      'button',
      { class: 'copy-btn', type: 'button', 'aria-label': `Copy ${label.toLowerCase()}` },
      'Copy',
    );
    copy.addEventListener('click', () => {
      void navigator.clipboard
        .writeText(value)
        .then(() => (copy.textContent = 'Copied'))
        .catch(() => (copy.textContent = 'Select & copy'))
        .finally(() => setTimeout(() => (copy.textContent = 'Copy'), 1800));
    });
    return h(
      'div',
      { class: 'cred-row' },
      h('dt', {}, label),
      h('dd', {}, h('code', {}, value), copy),
    );
  };

  return h(
    'div',
    { class: 'credentials' },
    h('h3', {}, 'Try it yourself'),
    h('dl', {}, row('Username', c.username), row('Password', c.password)),
    h('p', { class: 'cred-note' }, c.note),
  );
}
