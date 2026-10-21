document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme preference with optional persistence
  const themeToggle = document.getElementById('theme-toggle');
  const root = document.documentElement;
  const systemTheme = window.matchMedia(
    '(prefers-color-scheme: dark)'
  );

  let preferredTheme = null;

  try {
    const storedTheme = localStorage.getItem('theme');

    if (storedTheme === 'dark' || storedTheme === 'light') {
      preferredTheme = storedTheme;
    }
  } catch {
    // The page remains usable when browser storage is unavailable.
  }

  const applyTheme = theme => {
    root.dataset.theme = theme;

    themeToggle.setAttribute(
      'aria-label',
      theme === 'dark'
        ? 'Switch to light theme'
        : 'Switch to dark theme'
    );
  };

  applyTheme(
    preferredTheme || (systemTheme.matches ? 'dark' : 'light')
  );

  themeToggle.addEventListener('click', () => {
    preferredTheme =
      root.dataset.theme === 'dark' ? 'light' : 'dark';

    applyTheme(preferredTheme);

    try {
      localStorage.setItem('theme', preferredTheme);
    } catch {
      // Theme switching still works for the current visit.
    }
  });

  systemTheme.addEventListener('change', event => {
    if (preferredTheme === null) {
      applyTheme(event.matches ? 'dark' : 'light');
    }
  });

   // 2. Mobile navigation
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  const mobileLayout = window.matchMedia('(max-width: 868px)');

  const setMenuOpen = (open, restoreFocus = false) => {
    const isOpen = mobileLayout.matches && open;

    if (restoreFocus) {
      menuToggle.focus();
    }

    navMenu.classList.toggle('is-open', isOpen);
    navMenu.inert = mobileLayout.matches && !isOpen;

    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute(
      'aria-label',
      isOpen ? 'Close navigation menu' : 'Open navigation menu'
    );
  };

  menuToggle.addEventListener('click', () => {
    const open = !navMenu.classList.contains('is-open');
    setMenuOpen(open);

    if (open) {
      navMenu.querySelector('a')?.focus();
    }
  });

  navMenu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileLayout.matches) {
        setMenuOpen(false, true);
      }
    });
  });

  document.addEventListener('keydown', event => {
    if (
      event.key === 'Escape' &&
      navMenu.classList.contains('is-open')
    ) {
      setMenuOpen(false, true);
    }
  });

  document.addEventListener('focusin', event => {
    if (
      navMenu.classList.contains('is-open') &&
      !navMenu.contains(event.target) &&
      !menuToggle.contains(event.target)
    ) {
      setMenuOpen(false);
    }
  });

  mobileLayout.addEventListener('change', () => {
    const focusWillBeHidden =
      mobileLayout.matches &&
      navMenu.contains(document.activeElement);

    setMenuOpen(false, focusWillBeHidden);
  });

  setMenuOpen(false);
    // Highlight the current section in navigation.
  const header = document.querySelector('.header');
  const navigationItems = Array.from(
    navMenu.querySelectorAll('.nav-link')
  ).map(link => ({
    link,
    section: document.getElementById(
      link.getAttribute('href').slice(1)
    )
  })).filter(item => item.section);

  let navigationFrame = null;

  const updateActiveSection = () => {
    navigationFrame = null;

    const readingLine = header.getBoundingClientRect().bottom + 32;
    let activeItem = null;

    navigationItems.forEach(item => {
      if (item.section.getBoundingClientRect().top <= readingLine) {
        activeItem = item;
      }
    });

    // The final section may be too short to reach the reading line.
    const atPageEnd =
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2;

    if (atPageEnd && window.scrollY > 0) {
      activeItem = navigationItems[navigationItems.length - 1];
    }

    navigationItems.forEach(item => {
      if (item === activeItem) {
        item.link.setAttribute('aria-current', 'location');
      } else {
        item.link.removeAttribute('aria-current');
      }
    });
  };

  const scheduleNavigationUpdate = () => {
    if (navigationFrame !== null) return;

    navigationFrame = window.requestAnimationFrame(
      updateActiveSection
    );
  };

  window.addEventListener('scroll', scheduleNavigationUpdate, {
    passive: true
  });
  window.addEventListener('resize', scheduleNavigationUpdate);
  window.addEventListener('load', scheduleNavigationUpdate);
  window.addEventListener('hashchange', scheduleNavigationUpdate);

  updateActiveSection();
  // 3. Project screenshot galleries
  document.querySelectorAll('[data-gallery]').forEach(gallery => {
    const slides = Array.from(
      gallery.querySelectorAll('.gallery-slide')
    );
    const controls = gallery.querySelector('.gallery-controls');
    const previous = gallery.querySelector('[data-previous]');
    const next = gallery.querySelector('[data-next]');
    const status = gallery.querySelector('.gallery-status');

    if (
      slides.length < 2 ||
      !controls ||
      !previous ||
      !next ||
      !status
    ) {
      return;
    }

    let currentIndex = 0;

    const showSlide = index => {
      currentIndex = (index + slides.length) % slides.length;

      slides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== currentIndex;
      });

      status.textContent =
        `Screen ${currentIndex + 1} of ${slides.length}`;
    };

    previous.addEventListener('click', () => {
      showSlide(currentIndex - 1);
    });

    next.addEventListener('click', () => {
      showSlide(currentIndex + 1);
    });

    controls.addEventListener('keydown', event => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showSlide(currentIndex - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showSlide(currentIndex + 1);
      }
    });

    showSlide(0);
    gallery.classList.add('is-enhanced');
    controls.hidden = false;
  });
});