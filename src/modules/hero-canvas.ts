import { onReducedMotionChange, prefersReducedMotion } from '../lib/motion';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const LINK_DISTANCE = 140; // px: nodes closer than this get a connecting line
const POINTER_RADIUS = 180; // px: nodes near the cursor link to it
const SPEED = 0.25; // px per frame
const AREA_PER_NODE = 16000; // px²: density; capped by MAX_NODES
const MAX_NODES = 80;

/**
 * A drifting network of nodes behind the hero: servers, services, code.
 * Pauses when off screen or in a hidden tab; draws one still frame under reduced motion.
 */
export function initHeroCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  if (!ctx || !host) return;
  // Narrowed aliases, so the helpers below never need non-null assertions.
  const g: CanvasRenderingContext2D = ctx;
  const box: HTMLElement = host;

  let width = 0;
  let height = 0;
  let points: Point[] = [];
  let colors = readColors();
  const pointer = { x: 0, y: 0, active: false };
  let inView = true;
  let frame = 0;

  const makePoint = (): Point => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 2 * SPEED,
    vy: (Math.random() - 0.5) * 2 * SPEED,
    r: 1 + Math.random() * 1.6,
  });

  function resize(): void {
    const rect = box.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Keep existing nodes (no reshuffle when a mobile URL bar resizes the page).
    const target = Math.min(MAX_NODES, Math.round((width * height) / AREA_PER_NODE));
    points = points.slice(0, target);
    while (points.length < target) points.push(makePoint());
    points.forEach((p) => {
      p.x = Math.min(p.x, width);
      p.y = Math.min(p.y, height);
    });
    draw();
  }

  function step(): void {
    for (const p of points) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
    }
  }

  function draw(): void {
    g.clearRect(0, 0, width, height);
    g.lineWidth = 1;

    points.forEach((a, i) => {
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j];
        if (!b) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK_DISTANCE) continue;
        g.globalAlpha = (1 - d / LINK_DISTANCE) * 0.35;
        g.strokeStyle = colors.line;
        g.beginPath();
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
        g.stroke();
      }
    });

    for (const p of points) {
      const near = pointer.active ? Math.hypot(p.x - pointer.x, p.y - pointer.y) : Infinity;
      if (near < POINTER_RADIUS) {
        g.globalAlpha = (1 - near / POINTER_RADIUS) * 0.8;
        g.strokeStyle = colors.accent;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(pointer.x, pointer.y);
        g.stroke();
      }
      g.globalAlpha = near < POINTER_RADIUS ? 1 : 0.7;
      g.fillStyle = near < POINTER_RADIUS ? colors.accent : colors.node;
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function tick(): void {
    step();
    draw();
    frame = requestAnimationFrame(tick);
  }

  function update(): void {
    const shouldRun = inView && !document.hidden && !prefersReducedMotion();
    if (shouldRun && !frame) frame = requestAnimationFrame(tick);
    if (!shouldRun && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      draw(); // leave a clean still frame
    }
  }

  // ---- Wiring ----
  new ResizeObserver(resize).observe(box);

  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? true;
    update();
  }).observe(box);

  document.addEventListener('visibilitychange', update);
  onReducedMotionChange(update);

  box.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
    if (!frame) draw(); // still frame follows the cursor too
  });
  box.addEventListener('pointerleave', () => {
    pointer.active = false;
    if (!frame) draw();
  });

  // Re-read colors when the theme changes.
  new MutationObserver(() => {
    colors = readColors();
    if (!frame) draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  update();
}

function readColors(): { node: string; line: string; accent: string } {
  const style = getComputedStyle(document.documentElement);
  return {
    node: style.getPropertyValue('--text-muted').trim(),
    line: style.getPropertyValue('--text-muted').trim(),
    accent: style.getPropertyValue('--accent').trim(),
  };
}
