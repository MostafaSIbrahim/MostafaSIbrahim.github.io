import { qs, qsa } from '../lib/dom';

const mobile = window.matchMedia('(max-width: 860px)');

interface NavTarget {
  link: HTMLAnchorElement;
  section: HTMLElement;
}

export function initNav(): void {
  const header = qs('#site-header');
  const nav = qs('#site-nav');
  const toggle = qs<HTMLButtonElement>('#menu-toggle');
  const links = qsa<HTMLAnchorElement>('.nav-link', nav);

  // ---- Mobile menu ----
  const setOpen = (open: boolean, returnFocus = false): void => {
    const isOpen = mobile.matches && open;
    nav.classList.toggle('is-open', isOpen);
    nav.inert = mobile.matches && !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    if (returnFocus) toggle.focus();
  };

  const isOpen = (): boolean => nav.classList.contains('is-open');

  toggle.addEventListener('click', () => {
    setOpen(!isOpen());
    if (isOpen()) links[0]?.focus();
  });

  links.forEach((link) =>
    link.addEventListener('click', () => {
      if (mobile.matches) setOpen(false);
    }),
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) setOpen(false, true);
  });

  // Close when focus or a click lands outside the menu.
  const closeIfOutside = (target: EventTarget | null): void => {
    if (!isOpen() || !(target instanceof Node)) return;
    if (!nav.contains(target) && !toggle.contains(target)) setOpen(false);
  };
  document.addEventListener('focusin', (event) => closeIfOutside(event.target));
  document.addEventListener('click', (event) => closeIfOutside(event.target));

  mobile.addEventListener('change', () => setOpen(false));
  setOpen(false);

  // ---- Active section ----
  const targets: NavTarget[] = links.flatMap((link) => {
    const section = document.getElementById(link.hash.slice(1));
    return section ? [{ link, section }] : [];
  });

  const visible = new Set<string>();

  const setActive = (id: string | null): void => {
    targets.forEach(({ link, section }) => {
      if (section.id === id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };

  const updateActive = (): void => {
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom && window.scrollY > 0) {
      setActive(targets.at(-1)?.section.id ?? null); // short last section never reaches the band
      return;
    }
    setActive(targets.find(({ section }) => visible.has(section.id))?.section.id ?? null);
  };

  // A thin band just above the middle of the viewport decides which section is current.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      updateActive();
    },
    { rootMargin: '-35% 0px -60% 0px' },
  );
  targets.forEach(({ section }) => observer.observe(section));

  // ---- Header border + bottom-of-page check, once per frame ----
  let frame = 0;
  const onScroll = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      header.classList.toggle('is-scrolled', window.scrollY > 8);
      updateActive();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
