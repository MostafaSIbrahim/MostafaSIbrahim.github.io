type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null; // storage blocked: fall back to the default
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked: the choice still applies for this visit
  }
}

export function initTheme(button: HTMLButtonElement): void {
  const root = document.documentElement;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  const apply = (theme: Theme): void => {
    root.dataset.theme = theme;
    button.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    );
    themeColor?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
  };

  apply(readStoredTheme() ?? 'dark');

  button.addEventListener('click', () => {
    const next: Theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    storeTheme(next);
  });
}
