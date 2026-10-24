import type { Project } from '../types/content';

export interface FieldError {
  field: string; // id of the input to focus
  message: string;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isHttps = (url: string): boolean => {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Everything the public gallery relies on, checked before a project can be saved. */
export function validateProject(p: Project, takenSlugs: string[]): FieldError[] {
  const errors: FieldError[] = [];
  const need = (field: string, value: string, label: string): void => {
    if (!value.trim()) errors.push({ field, message: `${label} is required.` });
  };

  need('f-title', p.title, 'Title');
  if (!SLUG.test(p.slug)) {
    errors.push({
      field: 'f-slug',
      message: 'Slug: lowercase letters, numbers and single dashes.',
    });
  } else if (takenSlugs.includes(p.slug)) {
    errors.push({ field: 'f-slug', message: `Another project already uses the slug "${p.slug}".` });
  }
  need('f-tagline', p.tagline, 'Tagline');
  if (p.tagline.length > 160)
    errors.push({ field: 'f-tagline', message: 'Tagline: 160 characters at most.' });
  if (p.stack.length === 0)
    errors.push({ field: 'f-stack', message: 'Add at least one technology.' });
  if (p.tags.length === 0)
    errors.push({ field: 'f-tags', message: 'Add at least one tag for the filters.' });
  need('f-challenge', p.challenge, 'Challenge');
  need('f-solution', p.solution, 'Solution');
  need('f-result', p.result, 'Result');

  if (p.demoUrl && !isHttps(p.demoUrl))
    errors.push({ field: 'f-demo', message: 'Demo URL must start with https://' });
  if (p.sourceUrl && !isHttps(p.sourceUrl))
    errors.push({ field: 'f-source', message: 'Source URL must start with https://' });

  if (p.credentials) {
    const c = p.credentials;
    if (!c.username.trim() || !c.password.trim()) {
      errors.push({
        field: 'f-cred-user',
        message: 'Demo login needs both a username and a password.',
      });
    }
  }

  if (!p.media.poster) errors.push({ field: 'f-poster', message: 'A cover image is required.' });
  p.media.screenshots.forEach((shot, i) => {
    if (!shot.alt.trim()) {
      errors.push({
        field: `f-shot-alt-${i}`,
        message: `Screenshot ${i + 1}: describe it for screen readers (alt text).`,
      });
    }
  });
  return errors;
}
