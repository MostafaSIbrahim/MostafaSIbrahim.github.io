import { prefersReducedMotion } from '../lib/motion';

const MAX_TILT = 10; // degrees at the edge of the hero

/**
 * Motion for the two profile photos.
 * - Hero: the round photo tilts toward the pointer (mouse and pen only).
 * - Contact: the card stays in duotone until it scrolls into view, then washes into colour.
 * CSS does the drawing; this only sets a class and two custom properties.
 */
export function initPhotoMotion(): void {
  if (prefersReducedMotion()) return; // CSS already shows both photos at rest, in colour

  const hero = document.querySelector<HTMLElement>('.hero');
  const photo = document.querySelector<HTMLElement>('[data-tilt]');
  if (hero && photo && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let frame = 0;
    hero.addEventListener('pointermove', (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = photo.getBoundingClientRect();
        const dx = (event.clientX - (box.left + box.width / 2)) / hero.clientWidth;
        const dy = (event.clientY - (box.top + box.height / 2)) / hero.clientHeight;
        photo.style.setProperty('--tilt-y', `${(dx * MAX_TILT * 2).toFixed(2)}deg`);
        photo.style.setProperty('--tilt-x', `${(-dy * MAX_TILT * 2).toFixed(2)}deg`);
      });
    });
    hero.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      photo.style.setProperty('--tilt-x', '0deg');
      photo.style.setProperty('--tilt-y', '0deg');
    });
  }

  const card = document.querySelector<HTMLElement>('[data-reveal]');
  if (card) {
    card.dataset.reveal = 'pending';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        card.dataset.reveal = 'done';
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(card);
  }
}
