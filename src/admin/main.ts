import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../styles/admin.css';

import type { Project } from '../types/content';
import { h, qs } from '../lib/dom';
import { enhanceProjectCard, renderProjectCard } from '../modules/project-card';
import { createProjectDialog } from '../modules/project-dialog';
import { emptyProject, renderEditor } from './editor';
import { GitHub, GitHubError, blobToBase64, textToBase64, type FileChange } from './github';

const DEFAULTS = { owner: 'MostafaSIbrahim', repo: 'MostafaSIbrahim.github.io', branch: 'main' };
const DATA_PATH = 'src/data/projects.json';
const SETTINGS_KEY = 'admin-settings'; // owner/repo/branch only: never the token
const TOKEN_KEY = 'admin-token'; // sessionStorage, only if the user ticks "remember"

interface PendingFile {
  blob: Blob;
  url: string; // object URL for previews
}

const state = {
  gh: null as GitHub | null,
  baseSha: '',
  projects: [] as Project[],
  savedJson: '',
  pending: new Map<string, PendingFile>(), // site path (/assets/...) -> new file
  touched: new Set<string>(), // slugs whose media folders get tidied on publish
};

const app = qs('#admin');
const live = qs('#admin-live'); // polite announcements for screen readers
const announce = (message: string): void => {
  live.textContent = message;
};

// ---------- storage helpers (wrapped: storage can be blocked) ----------
const read = (store: Storage, key: string): string | null => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, value: string | null): void => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // ignore: the session still works without storage
  }
};

// ---------- derived values ----------
const dataJson = (): string => `${JSON.stringify(state.projects, null, 2)}\n`;
const isDirty = (): boolean => dataJson() !== state.savedJson || state.pending.size > 0;

/** Site path -> URL for previews: a queued blob, or the file as it is in the repo at the loaded commit. */
const resolve = (sitePath: string): string => {
  const pending = state.pending.get(sitePath);
  if (pending) return pending.url;
  if (!state.gh || !sitePath.startsWith('/')) return sitePath;
  const { owner, repo } = state.gh.ref;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${state.baseSha}/public${sitePath}`;
};

const withResolvedMedia = (p: Project): Project => ({
  ...p,
  media: {
    poster: resolve(p.media.poster),
    previewMp4: p.media.previewMp4 && resolve(p.media.previewMp4),
    previewWebm: p.media.previewWebm && resolve(p.media.previewWebm),
    screenshots: p.media.screenshots.map((s) => ({ ...s, src: resolve(s.src) })),
  },
});

const errorText = (error: unknown): string => {
  if (error instanceof GitHubError && error.status === 401) {
    return 'GitHub rejected the token (expired or mistyped).';
  }
  if (error instanceof GitHubError && error.status === 404) {
    return 'Not found: check the owner, repository and branch, and that the token has access to this repository.';
  }
  return error instanceof Error ? error.message : String(error);
};

// =====================================================================
// Sign in
// =====================================================================
function renderSignIn(message = ''): void {
  const saved = {
    ...DEFAULTS,
    ...(JSON.parse(read(localStorage, SETTINGS_KEY) ?? '{}') as Partial<typeof DEFAULTS>),
  };
  const input = (
    id: string,
    label: string,
    value: string,
    type = 'text',
  ): [HTMLElement, HTMLInputElement] => {
    const el = h('input', {
      id,
      type,
      value,
      required: true,
      autocomplete: type === 'password' ? 'off' : 'on',
      spellcheck: 'false',
    });
    return [h('div', { class: 'field' }, h('label', { for: id }, label), el), el];
  };
  const [ownerField, owner] = input('s-owner', 'Owner', saved.owner);
  const [repoField, repo] = input('s-repo', 'Repository', saved.repo);
  const [branchField, branch] = input('s-branch', 'Branch to publish to', saved.branch);
  const [tokenField, token] = input('s-token', 'GitHub token', '', 'password');
  const remember = h('input', { type: 'checkbox', id: 's-remember' });
  const error = h('p', { class: 'form-error', role: 'alert' }, message);
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Sign in');

  const form = h(
    'form',
    { class: 'signin' },
    h('p', { class: 'section-label' }, '// portfolio admin'),
    h('h1', {}, 'Sign in with a GitHub token'),
    h(
      'p',
      { class: 'lead' },
      'Saving here commits straight to the repository, and the site rebuilds itself. The token stays in this tab and is only ever sent to api.github.com.',
    ),
    h('div', { class: 'field-row' }, ownerField, repoField, branchField),
    tokenField,
    h(
      'div',
      { class: 'check' },
      remember,
      h('label', { for: 's-remember' }, 'Remember the token until this tab closes'),
    ),
    error,
    submit,
    h(
      'details',
      { class: 'help' },
      h('summary', {}, 'How to create a token (2 minutes)'),
      h(
        'ol',
        {},
        h(
          'li',
          {},
          'GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.',
        ),
        h('li', {}, 'Repository access: Only select repositories → this site’s repository.'),
        h(
          'li',
          {},
          'Permissions → Repository permissions → Contents: Read and write. Nothing else.',
        ),
        h('li', {}, 'Set an expiry (90 days is sensible), generate, and paste it here.'),
      ),
      h(
        'a',
        {
          href: 'https://github.com/settings/personal-access-tokens/new',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        'Open the token page ↗',
      ),
    ),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    error.textContent = 'Checking access…';
    const ref = { owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() };
    try {
      await connect(new GitHub(token.value.trim(), ref));
      write(localStorage, SETTINGS_KEY, JSON.stringify(ref));
      write(
        sessionStorage,
        TOKEN_KEY,
        remember.checked ? JSON.stringify({ token: token.value.trim(), ref }) : null,
      );
    } catch (e) {
      error.textContent = errorText(e);
      submit.disabled = false;
    }
  });

  app.replaceChildren(form);
  (message ? token : owner.value ? token : owner).focus();
}

async function connect(gh: GitHub): Promise<void> {
  await gh.verify();
  state.gh = gh;
  await load();
}

async function load(): Promise<void> {
  const gh = state.gh;
  if (!gh) return;
  announce('Loading projects…');
  state.baseSha = await gh.headSha();
  const text = await gh.readText(DATA_PATH, state.baseSha);
  state.projects = JSON.parse(text) as Project[];
  state.savedJson = dataJson();
  state.pending.forEach((p) => URL.revokeObjectURL(p.url));
  state.pending.clear();
  state.touched.clear();
  renderDashboard();
  announce(`Loaded ${state.projects.length} projects from ${gh.ref.branch}.`);
}

// =====================================================================
// Dashboard
// =====================================================================
const dialog = createProjectDialog();

function renderDashboard(editing: { index: number | null; isNew: boolean } | null = null): void {
  const gh = state.gh;
  if (!gh) return renderSignIn();

  // ---- top bar ----
  const changes = h(
    'span',
    { class: 'changes' },
    isDirty() ? '● Unpublished changes' : 'All changes published',
  );
  const publish = h(
    'button',
    { type: 'button', class: 'btn btn-primary', disabled: !isDirty() },
    'Publish…',
  );
  const reload = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Reload');
  const signOut = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Sign out');
  publish.addEventListener('click', renderPublish);
  reload.addEventListener('click', () => {
    if (isDirty() && reload.dataset.armed !== '1') {
      reload.dataset.armed = '1';
      reload.textContent = 'Discard changes?';
      return;
    }
    void load().catch((e: unknown) => announce(errorText(e)));
  });
  signOut.addEventListener('click', () => {
    write(sessionStorage, TOKEN_KEY, null);
    state.gh = null;
    renderSignIn();
  });

  const bar = h(
    'header',
    { class: 'admin-bar' },
    h(
      'div',
      {},
      h('p', { class: 'section-label' }, '// portfolio admin'),
      h('p', { class: 'repo' }, `${gh.ref.owner}/${gh.ref.repo} @ ${gh.ref.branch}`),
    ),
    changes,
    h('div', { class: 'bar-actions' }, publish, reload, signOut),
  );

  // ---- project list ----
  const items = state.projects.map((p, i) => {
    const button = (
      label: string,
      action: () => void,
      extra: Record<string, string | boolean> = {},
    ): HTMLButtonElement => {
      const b = h('button', { type: 'button', class: 'link-btn', ...extra }, label);
      b.addEventListener('click', action);
      return b;
    };
    const move = (delta: number): void => {
      const [item] = state.projects.splice(i, 1);
      if (item) state.projects.splice(i + delta, 0, item);
      renderDashboard();
      announce(`${p.title} moved ${delta < 0 ? 'up' : 'down'}.`);
    };
    const del = button(
      'Delete',
      () => {
        if (del.dataset.armed !== '1') {
          del.dataset.armed = '1';
          del.textContent = 'Confirm delete';
          setTimeout(() => {
            del.dataset.armed = '';
            del.textContent = 'Delete';
          }, 4000);
          return;
        }
        state.projects.splice(i, 1);
        state.touched.add(p.slug);
        renderDashboard();
        announce(`${p.title} deleted from the draft. Publish to make it final.`);
      },
      { class: 'link-btn danger', 'aria-label': `Delete ${p.title}` },
    );

    return h(
      'li',
      { class: editing?.index === i ? 'is-editing' : '' },
      h('img', { class: 'thumb', src: resolve(p.media.poster), alt: '' }),
      h('div', { class: 'item-text' }, h('strong', {}, p.title), h('span', {}, `#work/${p.slug}`)),
      h(
        'div',
        { class: 'item-tools' },
        button('Edit', () => renderDashboard({ index: i, isNew: false }), {
          'aria-label': `Edit ${p.title}`,
        }),
        button('↑', () => move(-1), { 'aria-label': `Move ${p.title} up`, disabled: i === 0 }),
        button('↓', () => move(1), {
          'aria-label': `Move ${p.title} down`,
          disabled: i === state.projects.length - 1,
        }),
        del,
      ),
    );
  });
  const newButton = h('button', { type: 'button', class: 'btn btn-ghost' }, '+ New project');
  newButton.addEventListener('click', () => renderDashboard({ index: null, isNew: true }));
  const sidebar = h(
    'aside',
    { class: 'admin-list', 'aria-label': 'Projects' },
    h('h2', {}, `Projects (${state.projects.length})`),
    h('ol', {}, ...items),
    newButton,
  );

  // ---- editor + preview ----
  const preview = h('div', { class: 'admin-preview' });
  const showPreview = (p: Project): void => {
    const resolved = withResolvedMedia(p);
    const card = renderProjectCard(resolved);
    enhanceProjectCard(card);
    const open = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Preview case study');
    open.addEventListener('click', () => dialog.open(resolved));
    preview.replaceChildren(
      h('h2', {}, 'Live preview'),
      h('ul', { class: 'project-grid' }, card),
      open,
    );
  };

  let main: HTMLElement;
  if (editing) {
    const original = editing.index === null ? emptyProject() : state.projects[editing.index];
    if (!original) return renderDashboard();
    const others = state.projects.filter((_, i) => i !== editing.index).map((p) => p.slug);
    const form = renderEditor(original, {
      isNew: editing.isNew,
      takenSlugs: others,
      resolve,
      addFile: (sitePath, blob) => {
        state.pending.set(sitePath, { blob, url: URL.createObjectURL(blob) });
        return sitePath;
      },
      onChange: showPreview,
      onCancel: () => renderDashboard(),
      onSave: (draft) => {
        if (editing.index === null) state.projects.push(draft);
        else state.projects[editing.index] = draft;
        state.touched.add(draft.slug);
        renderDashboard();
        announce(`${draft.title} saved to the draft. Publish when you're ready.`);
      },
    });
    main = h(
      'section',
      { class: 'admin-editor', 'aria-label': 'Editor' },
      h('h2', {}, editing.isNew ? 'New project' : `Edit: ${original.title}`),
      form,
    );
    showPreview(original);
  } else {
    main = h(
      'section',
      { class: 'admin-empty' },
      h('h2', {}, 'Pick a project to edit, or add a new one.'),
      h(
        'p',
        {},
        'Edits collect in a draft. Nothing reaches GitHub until you press Publish, which makes a single commit with the data and all new media.',
      ),
    );
  }

  app.replaceChildren(
    bar,
    h('div', { class: 'admin-grid' }, sidebar, main, editing ? preview : ''),
  );
  if (editing) document.getElementById('f-title')?.focus();
}

// =====================================================================
// Publish
// =====================================================================
function renderPublish(): void {
  const gh = state.gh;
  if (!gh) return;

  const referenced = new Set(
    state.projects
      .flatMap((p) => [
        p.media.poster,
        p.media.previewMp4,
        p.media.previewWebm,
        ...p.media.screenshots.map((s) => s.src),
      ])
      .filter((x): x is string => Boolean(x)),
  );
  const uploads = [...state.pending.entries()].filter(([path]) => referenced.has(path));
  const size = uploads.reduce((sum, [, f]) => sum + f.blob.size, 0);

  const message = h('input', {
    id: 'p-message',
    type: 'text',
    value: 'content: update portfolio projects',
  });
  const progress = h('p', { class: 'publish-progress', role: 'status' });
  const confirm = h('button', { type: 'button', class: 'btn btn-primary' }, 'Publish now');
  const back = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Back');
  back.addEventListener('click', () => renderDashboard());

  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    back.disabled = true;
    try {
      const changes: FileChange[] = [{ path: DATA_PATH, base64: textToBase64(dataJson()) }];
      for (const [i, [sitePath, file]] of uploads.entries()) {
        progress.textContent = `Preparing file ${i + 1} of ${uploads.length}…`;
        changes.push({ path: `public${sitePath}`, base64: await blobToBase64(file.blob) });
      }
      // Tidy media folders of edited/deleted projects: drop files nothing points to anymore.
      for (const slug of state.touched) {
        const existing = await gh.listFiles(state.baseSha, `public/assets/projects/${slug}/`);
        for (const path of existing) {
          if (!referenced.has(path.slice('public'.length))) changes.push({ path, delete: true });
        }
      }
      progress.textContent = `Committing ${changes.length} file changes…`;
      const sha = await gh.commit(
        state.baseSha,
        changes,
        message.value.trim() || 'content: update portfolio projects',
      );
      state.baseSha = sha;
      state.savedJson = dataJson();
      state.pending.forEach((p) => URL.revokeObjectURL(p.url));
      state.pending.clear();
      state.touched.clear();

      const { owner, repo } = gh.ref;
      app.replaceChildren(
        h(
          'section',
          { class: 'admin-done' },
          h('h1', {}, 'Published'),
          h(
            'p',
            {},
            `Commit ${sha.slice(0, 7)} is on ${gh.ref.branch}. GitHub Actions rebuilds the site; it's usually live in a minute or two.`,
          ),
          h(
            'p',
            {},
            h(
              'a',
              {
                href: `https://github.com/${owner}/${repo}/commit/${sha}`,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              'View the commit ↗',
            ),
            ' · ',
            h(
              'a',
              {
                href: `https://github.com/${owner}/${repo}/actions`,
                target: '_blank',
                rel: 'noopener noreferrer',
              },
              'Watch the build ↗',
            ),
          ),
          (() => {
            const again = h(
              'button',
              { type: 'button', class: 'btn btn-primary' },
              'Back to projects',
            );
            again.addEventListener('click', () => renderDashboard());
            return again;
          })(),
        ),
      );
      announce('Published.');
    } catch (error) {
      progress.textContent = errorText(error);
      confirm.disabled = false;
      back.disabled = false;
    }
  });

  app.replaceChildren(
    h(
      'section',
      { class: 'admin-publish' },
      h('h1', {}, 'Publish to GitHub'),
      h(
        'ul',
        {},
        h('li', {}, `${state.projects.length} projects in src/data/projects.json`),
        h('li', {}, `${uploads.length} new media files (${(size / 1048576).toFixed(1)} MB)`),
        state.touched.size
          ? h('li', {}, `Unused media in ${[...state.touched].join(', ')} will be removed`)
          : null,
      ),
      h('div', { class: 'field' }, h('label', { for: 'p-message' }, 'Commit message'), message),
      progress,
      h('div', { class: 'editor-actions' }, confirm, back),
    ),
  );
  message.focus();
}

// =====================================================================
// Start
// =====================================================================
window.addEventListener('beforeunload', (event) => {
  if (state.gh && isDirty()) event.preventDefault(); // browser asks "leave site?"
});

const remembered = read(sessionStorage, TOKEN_KEY);
if (remembered) {
  const { token, ref } = JSON.parse(remembered) as { token: string; ref: typeof DEFAULTS };
  connect(new GitHub(token, ref)).catch((e: unknown) => renderSignIn(errorText(e)));
} else {
  renderSignIn();
}
