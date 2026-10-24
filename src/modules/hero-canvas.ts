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

  /**
   * Edge fade done in maths instead of a CSS mask (a mask is re-rasterized every frame).
   * 1 near the focus point (70% across, 45% down), fading to 0 towards the edges.
   */
  const fade = (x: number, y: number): number => {
    const dx = (x - width * 0.7) / (width * 0.75);
    const dy = (y - height * 0.45) / (height * 0.7);
    const r = Math.sqrt(dx * dx + dy * dy);
    return r <= 0.35 ? 1 : r >= 0.85 ? 0 : 1 - (r - 0.35) / 0.5;
  };

  const BUCKETS = 4; // lines are grouped by opacity: 4 strokes per frame instead of hundreds
  const paths: Path2D[] = [];

  function draw(): void {
    g.clearRect(0, 0, width, height);
    g.lineWidth = 1;
    for (let k = 0; k < BUCKETS; k++) paths[k] = new Path2D();

    points.forEach((a, i) => {
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j];
        if (!b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > LINK_DISTANCE * LINK_DISTANCE) continue;
        const strength =
          (1 - Math.sqrt(d2) / LINK_DISTANCE) * fade((a.x + b.x) / 2, (a.y + b.y) / 2);
        const bucket = Math.min(BUCKETS - 1, Math.floor(strength * BUCKETS));
        if (strength <= 0.05) continue;
        paths[bucket]?.moveTo(a.x, a.y);
        paths[bucket]?.lineTo(b.x, b.y);
      }
    });
    g.strokeStyle = colors.line;
    paths.forEach((path, k) => {
      g.globalAlpha = ((k + 1) / BUCKETS) * 0.35;
      g.stroke(path);
    });

    // Cursor links + nodes: one path per colour/opacity group.
    const hot = new Path2D();
    const hotNodes = new Path2D();
    const nodes: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
    for (const p of points) {
      const near = pointer.active ? Math.hypot(p.x - pointer.x, p.y - pointer.y) : Infinity;
      if (near < POINTER_RADIUS) {
        hot.moveTo(p.x, p.y);
        hot.lineTo(pointer.x, pointer.y);
        hotNodes.moveTo(p.x + p.r, p.y);
        hotNodes.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        continue;
      }
      const level = Math.round(fade(p.x, p.y) * 2);
      if (level === 0) continue;
      const path = nodes[level] ?? nodes[2];
      path?.moveTo(p.x + p.r, p.y);
      path?.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    g.fillStyle = colors.node;
    nodes.forEach((path, level) => {
      g.globalAlpha = level * 0.35;
      if (level) g.fill(path);
    });
    g.strokeStyle = colors.accent;
    g.fillStyle = colors.accent;
    g.globalAlpha = 0.6;
    g.stroke(hot);
    g.globalAlpha = 1;
    g.fill(hotNodes);
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
