import { prefersReducedMotion } from '../lib/motion';

const TYPE_MS = 70;
const DELETE_MS = 35;
const HOLD_MS = 1800;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Types through the roles listed in data-words, like a terminal.
 * The element is aria-hidden; the full list is in a visually-hidden sibling,
 * so screen readers hear it once instead of letter by letter.
 */
export function initTypewriter(el: HTMLElement): void {
  const words = parseWords(el.dataset.words);
  if (words.length < 2 || prefersReducedMotion()) return; // static first word stays
  void run(el, words);
}

async function run(el: HTMLElement, words: string[]): Promise<void> {
  let index = 0;
  while (true) {
    const current = words[index % words.length] ?? '';
    await sleep(HOLD_MS);
    for (let n = current.length; n >= 0; n--) {
      el.textContent = current.slice(0, n);
      await sleep(DELETE_MS);
    }
    index++;
    const next = words[index % words.length] ?? '';
    for (let n = 1; n <= next.length; n++) {
      el.textContent = next.slice(0, n);
      await sleep(TYPE_MS);
    }
  }
}

function parseWords(raw: string | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? value.filter((w): w is string => typeof w === 'string') : [];
  } catch {
    return [];
  }
}
