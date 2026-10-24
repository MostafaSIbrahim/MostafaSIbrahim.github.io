import type { Project } from '../types/content';
import { h } from '../lib/dom';
import { LIMITS, checkVideo, prepareImage, slugify, stamp } from './media';
import { validateProject, type FieldError } from './validate';

export interface EditorContext {
  isNew: boolean;
  takenSlugs: string[];
  /** Site path (/assets/...) -> a URL the browser can show (blob or raw GitHub). */
  resolve: (sitePath: string) => string;
  /** Queue a file for the next publish; returns its site path. */
  addFile: (sitePath: string, blob: Blob) => string;
  onChange: (draft: Project) => void;
  onSave: (draft: Project) => void;
  onCancel: () => void;
}

const list = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** The project form. Works on a copy; nothing changes until "Save to draft". */
export function renderEditor(initial: Project, ctx: EditorContext): HTMLElement {
  const draft: Project = structuredClone(initial);
  const folder = (): string => `/assets/projects/${draft.slug || 'new-project'}`;
  const changed = (): void => ctx.onChange(structuredClone(draft));

  // ---- small field builders ----
  const field = (
    id: string,
    label: string,
    input: HTMLInputElement | HTMLTextAreaElement,
    hint?: string,
  ): HTMLElement => {
    input.id = id;
    if (hint) input.setAttribute('aria-describedby', `${id}-hint`);
    return h(
      'div',
      { class: 'field' },
      h('label', { for: id }, label),
      input,
      hint ? h('p', { class: 'hint', id: `${id}-hint` }, hint) : null,
    );
  };
  const text = (
    value: string,
    onInput: (v: string) => void,
    attrs: Record<string, string> = {},
  ): HTMLInputElement => {
    const input = h('input', { type: 'text', value, ...attrs });
    input.addEventListener('input', () => {
      onInput(input.value);
      changed();
    });
    return input;
  };
  const area = (value: string, onInput: (v: string) => void, rows = 3): HTMLTextAreaElement => {
    const input = h('textarea', { rows });
    input.value = value;
    input.addEventListener('input', () => {
      onInput(input.value);
      changed();
    });
    return input;
  };

  // ---- basics ----
  const slugInput = text(draft.slug, (v) => (draft.slug = v.trim()), {
    pattern: '[a-z0-9-]+',
    ...(ctx.isNew ? {} : { readonly: '' }),
  });
  const titleInput = text(draft.title, (v) => {
    draft.title = v;
    if (ctx.isNew && !slugInput.dataset.touched) {
      draft.slug = slugify(v);
      slugInput.value = draft.slug;
    }
  });
  slugInput.addEventListener('input', () => (slugInput.dataset.touched = '1'));

  const basics = h(
    'fieldset',
    {},
    h('legend', {}, 'Basics'),
    field('f-title', 'Title', titleInput),
    field(
      'f-slug',
      'Slug',
      slugInput,
      ctx.isNew
        ? 'Used in the URL: #work/<slug>. Created from the title.'
        : 'Fixed after publishing, so links keep working.',
    ),
    field(
      'f-year',
      'Year',
      text(draft.year ?? '', (v) => (draft.year = v.trim() || undefined)),
    ),
    field(
      'f-tagline',
      'Tagline',
      area(draft.tagline, (v) => (draft.tagline = v), 2),
      'One sentence, up to 160 characters.',
    ),
    field(
      'f-role',
      'My role',
      text(draft.role.join(', '), (v) => (draft.role = list(v))),
      'Comma-separated.',
    ),
    field(
      'f-stack',
      'Technology stack',
      text(draft.stack.join(', '), (v) => (draft.stack = list(v))),
      'Comma-separated. The card shows the first five.',
    ),
    field(
      'f-tags',
      'Filter tags',
      text(draft.tags.join(', '), (v) => (draft.tags = list(v))),
      'Comma-separated, e.g. .NET, Full-stack, Healthcare.',
    ),
  );

  const story = h(
    'fieldset',
    {},
    h('legend', {}, 'Case study'),
    field(
      'f-challenge',
      'The challenge',
      area(draft.challenge, (v) => (draft.challenge = v)),
    ),
    field(
      'f-solution',
      'The solution',
      area(draft.solution, (v) => (draft.solution = v)),
    ),
    field(
      'f-result',
      'The result',
      area(draft.result, (v) => (draft.result = v)),
    ),
  );

  // ---- links + demo login ----
  const credBox = h('div', { class: 'cred-fields' });
  const renderCred = (): void => {
    const c = draft.credentials;
    credBox.hidden = !c;
    if (!c) return credBox.replaceChildren();
    credBox.replaceChildren(
      field(
        'f-cred-user',
        'Username',
        text(c.username, (v) => (c.username = v)),
      ),
      field(
        'f-cred-pass',
        'Password',
        text(c.password, (v) => (c.password = v)),
      ),
      field(
        'f-cred-note',
        'Note for visitors',
        text(c.note, (v) => (c.note = v)),
      ),
    );
  };
  const hasCred = h('input', {
    type: 'checkbox',
    id: 'f-has-cred',
    checked: Boolean(draft.credentials),
  });
  hasCred.addEventListener('change', () => {
    draft.credentials = hasCred.checked
      ? { username: '', password: '', note: 'Public read-only demo account with sample data.' }
      : undefined;
    renderCred();
    changed();
  });
  renderCred();

  const links = h(
    'fieldset',
    {},
    h('legend', {}, 'Links'),
    field(
      'f-demo',
      'Live demo URL',
      text(draft.demoUrl ?? '', (v) => (draft.demoUrl = v.trim() || undefined), {
        type: 'url',
        placeholder: 'https://',
      }),
    ),
    field(
      'f-source',
      'Source code URL',
      text(draft.sourceUrl ?? '', (v) => (draft.sourceUrl = v.trim() || undefined), {
        type: 'url',
        placeholder: 'https://github.com/…',
      }),
    ),
    h(
      'div',
      { class: 'check' },
      hasCred,
      h('label', { for: 'f-has-cred' }, 'This demo has a public login'),
    ),
    credBox,
  );

  // ---- media ----
  const status = h('p', { class: 'media-status', role: 'status' });
  const busy = (message: string): void => {
    status.textContent = message;
  };

  const posterThumb = h('img', { class: 'thumb', alt: '' });
  const showPoster = (): void => {
    posterThumb.hidden = !draft.media.poster;
    if (draft.media.poster) posterThumb.src = ctx.resolve(draft.media.poster);
  };
  const posterInput = h('input', { type: 'file', accept: 'image/*', id: 'f-poster' });
  posterInput.addEventListener('change', async () => {
    const file = posterInput.files?.[0];
    if (!file) return;
    try {
      busy('Optimizing cover image…');
      const img = await prepareImage(file);
      draft.media.poster = ctx.addFile(`${folder()}/cover-${stamp()}.${img.ext}`, img.blob);
      busy(`Cover ready: ${img.width}×${img.height}, ${(img.blob.size / 1024).toFixed(0)} KB.`);
      showPoster();
      changed();
    } catch (error) {
      busy(error instanceof Error ? error.message : String(error));
    }
    posterInput.value = '';
  });
  showPoster();

  const videoRow = (kind: 'mp4' | 'webm'): HTMLElement => {
    const key = kind === 'mp4' ? 'previewMp4' : 'previewWebm';
    const label = h('span', { class: 'file-name' });
    const remove = h('button', { type: 'button', class: 'link-btn' }, 'Remove');
    const input = h('input', { type: 'file', accept: `video/${kind}`, id: `f-video-${kind}` });
    const refresh = (): void => {
      const path = draft.media[key];
      label.textContent = path ? (path.split('/').pop() ?? '') : 'none';
      remove.hidden = !path;
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const problem = checkVideo(file, kind);
      if (problem) {
        busy(problem);
      } else {
        draft.media[key] = ctx.addFile(`${folder()}/preview-${stamp()}.${kind}`, file);
        busy(`${kind.toUpperCase()} added (${(file.size / 1048576).toFixed(1)} MB).`);
        changed();
      }
      input.value = '';
      refresh();
    });
    remove.addEventListener('click', () => {
      draft.media[key] = undefined;
      refresh();
      changed();
    });
    refresh();
    return h(
      'div',
      { class: 'video-row' },
      field(`f-video-${kind}`, `Motion preview (.${kind})`, input),
      label,
      remove,
    );
  };

  const shotsList = h('ol', { class: 'shots' });
  const renderShots = (): void => {
    shotsList.replaceChildren(
      ...draft.media.screenshots.map((shot, i) => {
        const move = (delta: number): void => {
          const shots = draft.media.screenshots;
          const j = i + delta;
          if (j < 0 || j >= shots.length) return;
          const [item] = shots.splice(i, 1);
          if (item) shots.splice(j, 0, item);
          renderShots();
          changed();
        };
        const tool = (label: string, action: () => void, disabled = false): HTMLButtonElement => {
          const b = h('button', { type: 'button', class: 'link-btn', disabled }, label);
          b.addEventListener('click', action);
          return b;
        };
        return h(
          'li',
          { class: 'shot' },
          h('img', { class: 'thumb', src: ctx.resolve(shot.src), alt: '' }),
          h(
            'div',
            { class: 'shot-fields' },
            field(
              `f-shot-alt-${i}`,
              'Alt text (what it shows)',
              text(shot.alt, (v) => (shot.alt = v)),
            ),
            field(
              `f-shot-cap-${i}`,
              'Caption (shown to everyone)',
              text(shot.caption, (v) => (shot.caption = v)),
            ),
            h(
              'div',
              { class: 'shot-tools' },
              tool('↑ Up', () => move(-1), i === 0),
              tool('↓ Down', () => move(1), i === draft.media.screenshots.length - 1),
              tool('Remove', () => {
                draft.media.screenshots.splice(i, 1);
                renderShots();
                changed();
              }),
            ),
          ),
        );
      }),
    );
  };
  const shotsInput = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'f-shots' });
  shotsInput.addEventListener('change', async () => {
    const files = [...(shotsInput.files ?? [])];
    for (const [n, file] of files.entries()) {
      try {
        busy(`Optimizing screenshot ${n + 1} of ${files.length}…`);
        const img = await prepareImage(file);
        const src = ctx.addFile(`${folder()}/shot-${stamp()}-${n}.${img.ext}`, img.blob);
        draft.media.screenshots.push({ src, alt: '', caption: '' });
      } catch (error) {
        busy(error instanceof Error ? error.message : String(error));
      }
    }
    busy(files.length ? 'Screenshots added. Write alt text and a caption for each.' : '');
    shotsInput.value = '';
    renderShots();
    changed();
  });
  renderShots();

  const media = h(
    'fieldset',
    {},
    h('legend', {}, 'Media'),
    h(
      'div',
      { class: 'poster-row' },
      field(
        'f-poster',
        'Cover image',
        posterInput,
        `Converted to WebP, ${LIMITS.maxImageWidth} px wide.`,
      ),
      posterThumb,
    ),
    videoRow('webm'),
    videoRow('mp4'),
    h(
      'p',
      { class: 'hint' },
      `Videos: 8–15 s, no audio, under ${LIMITS.videoMB} MB. WebM is smaller; MP4 plays everywhere. Either one is enough.`,
    ),
    field('f-shots', 'Add screenshots', shotsInput, 'You can pick several at once.'),
    shotsList,
    status,
  );

  // ---- save / cancel ----
  const errorBox = h('div', { class: 'error-summary', role: 'alert', tabindex: -1, hidden: true });
  const showErrors = (errors: FieldError[]): void => {
    errorBox.hidden = errors.length === 0;
    errorBox.replaceChildren(
      h(
        'p',
        {},
        `Fix ${errors.length} ${errors.length === 1 ? 'problem' : 'problems'} before saving:`,
      ),
      h(
        'ul',
        {},
        ...errors.map((e) => {
          const link = h('a', { href: `#${e.field}` }, e.message);
          link.addEventListener('click', (event) => {
            event.preventDefault();
            document.getElementById(e.field)?.focus();
          });
          return h('li', {}, link);
        }),
      ),
    );
    if (errors.length) errorBox.focus();
  };

  const save = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Save to draft');
  const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancel');
  cancel.addEventListener('click', ctx.onCancel);

  const form = h(
    'form',
    {
      class: 'editor',
      novalidate: true,
      'aria-label': ctx.isNew ? 'New project' : `Edit ${initial.title}`,
    },
    errorBox,
    basics,
    story,
    links,
    media,
    h('div', { class: 'editor-actions' }, save, cancel),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const errors = validateProject(draft, ctx.takenSlugs);
    showErrors(errors);
    if (errors.length === 0) ctx.onSave(structuredClone(draft));
  });
  return form;
}

export const emptyProject = (): Project => ({
  slug: '',
  title: '',
  year: String(new Date().getFullYear()),
  tagline: '',
  role: [],
  stack: [],
  tags: [],
  challenge: '',
  solution: '',
  result: '',
  media: { poster: '', screenshots: [] },
});
