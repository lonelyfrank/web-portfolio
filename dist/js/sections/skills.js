// Ten compact soap bubbles. Atomic replacements keep the visible population constant.
// Returns the update to call whenever the motion preference changes.
import { state } from '../state.js';

export function initSkills() {
  const field = document.querySelector('.skill-orbits');
  const items = [...field.children];
  const COUNT = 10, REFLOW = 1.25;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  let bubbles = [], cursor = 0, clock = 0, event = null, reflowAt = -REFLOW;
  const lastShown = new Map();
  let size = 0, width = 0, height = 0, spacing = 0;
  let frame = 0, last = 0, visible = false, enabled = false;
  let pointer = null, wave = null, lastGap = null;

  function measure() {
    if (!field.clientWidth) return false;
    width = field.clientWidth; height = field.clientHeight;
    size = Math.floor(Math.min(106, (width - 40) / 3.5, (height - 36) / 3));
    spacing = size * .91; // Leave a small visible gap beyond the artwork's transparent margins.
    field.style.setProperty('--bubble-size', `${size}px`);
    return true;
  }
  function bound(b) {
    b.hx = clamp(b.hx, size / 2 + 12, width - size / 2 - 12);
    b.hy = clamp(b.hy, size / 2 + 12, height - size / 2 - 12);
  }
  function position(b) {
    const t = ease((clock - reflowAt) / REFLOW);
    return [b.fx + (b.hx - b.fx) * t, b.fy + (b.hy - b.fy) * t];
  }
  function add(x, y, initial = false, excluded = []) {
    const names = new Set(bubbles.map(b => b.node.textContent.trim()));
    const node = items.filter(candidate => !excluded.includes(candidate)
      && !bubbles.some(b => b.node === candidate) && !names.has(candidate.textContent.trim()))
      .sort((a, b) => (lastShown.get(a) ?? -1) - (lastShown.get(b) ?? -1))[0];
    lastShown.set(node, cursor++);
    node.dataset.alive = '';
    bubbles.push({ node, hx: x, hy: y, fx: x, fy: y, ox: 0, oy: 0,
      born: initial ? clock - 2 - Math.random() * 18 : clock });
  }

  function compact() {
    // Relax target positions only at a birth or resize. No free-running billiard physics.
    for (let pass = 0; pass < 90; pass++) {
      for (const b of bubbles) {
        b.hx += (width / 2 - b.hx) * .003;
        b.hy += (height / 2 - b.hy) * .003;
      }
      for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        let dx = b.hx - a.hx, dy = b.hy - a.hy;
        if (Math.hypot(dx, dy) < .01) { dx = .1; dy = .07; }
        const distance = Math.hypot(dx, dy);
        if (distance >= spacing) continue;
        const move = (spacing - distance) / (2 * distance);
        a.hx -= dx * move; a.hy -= dy * move;
        b.hx += dx * move; b.hy += dy * move;
      }
      bubbles.forEach(bound);
    }
  }

  function gap() {
    // Interior triangular gaps vary with each arrangement; no fixed centre emitter.
    const candidates = [];
    for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
      for (let k = j + 1; k < bubbles.length; k++) {
        const triple = [bubbles[i], bubbles[j], bubbles[k]];
        if (triple.some(a => triple.some(b => Math.hypot(a.hx - b.hx, a.hy - b.hy) > spacing * 1.8))) continue;
        const x = triple.reduce((sum, b) => sum + b.hx, 0) / 3;
        const y = triple.reduce((sum, b) => sum + b.hy, 0) / 3;
        const clearance = Math.min(...bubbles.map(b => Math.hypot(x - b.hx, y - b.hy)));
        if (clearance < spacing * .55 || (lastGap && Math.hypot(x - lastGap.x, y - lastGap.y) < spacing * .35)) continue;
        const centrality = Math.hypot(x - width / 2, y - height / 2);
        candidates.push({ x, y, score: clearance - centrality * .12 + Math.random() * spacing * .22 });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const chosen = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))]
      || { x: width / 2 + (Math.random() - .5) * spacing, y: height / 2 + (Math.random() - .5) * spacing };
    lastGap = chosen;
    return chosen;
  }

  function schedule() {
    const count = Math.random() < .42 ? 2 : 1;
    const outer = [...bubbles].sort((a, b) =>
      Math.hypot(b.hx - width / 2, b.hy - height / 2) - Math.hypot(a.hx - width / 2, a.hy - height / 2)).slice(0, 6);
    // Usually retire at the perimeter; an old central cell must not lock out its alternate asset forever.
    const candidates = [...new Set([...outer, ...bubbles.filter(b => clock - b.born > 32)])];
    const ranked = candidates.map(b => ({ b, priority: (clock - b.born > 32 ? 100 : 0)
      + (clock - b.born) / 20 + Math.random() * 1.4 }))
      .sort((a, b) => b.priority - a.priority);
    event = { at: clock + 2.2 + Math.random() * 2.8, outgoing: ranked.slice(0, count).map(p => p.b) };
  }
  function replace() {
    const outgoing = event.outgoing;
    for (const b of bubbles) [b.fx, b.fy] = position(b);
    for (const b of outgoing) { b.node.style.opacity = 0; b.node.removeAttribute('data-alive'); }
    bubbles = bubbles.filter(b => !outgoing.includes(b));
    for (let i = 0; i < outgoing.length; i++) {
      const { x, y } = gap();
      add(x, y, false, outgoing.map(b => b.node));
    }
    // Death, birth and redistribution start in this same frame: ten visible images throughout.
    compact(); reflowAt = clock;
    schedule();
  }

  function pointerTargets() {
    const targets = new Map();
    if (!pointer) { wave = null; return targets; }
    const nearest = bubbles.map(b => {
      const [x, y] = position(b);
      const dx = x + b.ox - pointer.x, dy = y + b.oy - pointer.y;
      return { b, dx, dy, distance: Math.hypot(dx, dy) };
    }).sort((a, b) => a.distance - b.distance)[0];
    if (!nearest || nearest.distance > size * .65) { wave = null; return targets; }
    if (wave?.source !== nearest.b) wave = { source: nearest.b, start: clock };
    const ux = nearest.distance < 1 ? 1 : nearest.dx / nearest.distance;
    const uy = nearest.distance < 1 ? -.2 : nearest.dy / nearest.distance;
    const strength = 16 * (1 - nearest.distance / (size * .8));
    let current = nearest.b;
    const visited = new Set();
    for (let hop = 0; hop < 4 && current; hop++) {
      visited.add(current);
      const delayed = ease((clock - wave.start - hop * .11) / .2);
      targets.set(current, [ux * strength * .62 ** hop * delayed, uy * strength * .62 ** hop * delayed]);
      const [x, y] = position(current);
      current = bubbles.filter(b => !visited.has(b)).map(b => {
        const [bx, by] = position(b), dx = bx - x, dy = by - y;
        const distance = Math.hypot(dx, dy);
        return { b, distance, forward: (dx * ux + dy * uy) / (distance || 1) };
      }).filter(n => n.forward > .25 && n.distance < spacing * 1.4)
        .sort((a, b) => b.forward - a.forward)[0]?.b;
    }
    return targets;
  }
  function paint(dt = 0) {
    const targets = pointerTargets();
    for (const b of bubbles) {
      const [tx, ty] = targets.get(b) || [0, 0], blend = 1 - Math.exp(-11 * dt);
      b.ox += (tx - b.ox) * blend; b.oy += (ty - b.oy) * blend;
      const [x, y] = position(b);
      const growing = .18 + .82 * ease((clock - b.born) / REFLOW);
      const popping = event?.outgoing.includes(b) ? Math.max(0, 1 - (event.at - clock) / .16) : 0;
      b.node.style.opacity = 1;
      b.node.style.setProperty('--birth-scale', (growing * (1 + .07 * popping)).toFixed(4));
      b.node.style.transform = `translate3d(${clamp(x - size / 2 + b.ox, 4, width - size - 4).toFixed(2)}px, ${clamp(y - size / 2 + b.oy, 6, height - size - 6).toFixed(2)}px, 0)`;
    }
  }
  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now; clock += dt;
    if (clock >= event.at) replace();
    paint(dt);
    frame = requestAnimationFrame(tick);
  }
  function clearPointer() { pointer = null; wave = null; }
  function run() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    const paused = !enabled || !visible || !bubbles.length || document.hidden;
    field.classList.toggle('is-paused', paused);
    if (paused) clearPointer();
    else frame = requestAnimationFrame(tick);
  }
  function seed() {
    clock = 0; reflowAt = -REFLOW; lastGap = null;
    const rows = [[-1, 0, 1], [-1.5, -.5, .5, 1.5], [-1, 0, 1]];
    rows.flatMap((row, r) => row.map(col => [col, r])).slice(0, COUNT)
      .forEach(([col, r]) => add(width / 2 + col * spacing,
        height / 2 + (r - 1) * spacing * .866, true));
    compact();
    bubbles.forEach(b => { b.fx = b.hx; b.fy = b.hy; });
    schedule(); paint();
  }
  function motion() {
    const next = !state.reduced;
    if (next === enabled) return;
    enabled = next;
    field.classList.toggle('is-floating', enabled);
    field.style.removeProperty('--bubble-size');
    items.forEach(node => { node.removeAttribute('style'); node.removeAttribute('data-alive'); });
    bubbles = []; clearPointer();
    if (enabled && measure()) seed();
    run();
  }
  field.addEventListener('pointermove', e => {
    if (!enabled || e.pointerType === 'touch') return;
    const r = field.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  field.addEventListener('pointerleave', clearPointer);
  field.addEventListener('pointercancel', clearPointer);
  window.addEventListener('blur', clearPointer);
  window.addEventListener('scroll', clearPointer, { passive: true, capture: true });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; run(); }).observe(field);
  new ResizeObserver(() => {
    if (!enabled) return;
    const oldWidth = width, oldHeight = height;
    if (!measure()) return;
    clearPointer();
    if (!bubbles.length) seed();
    else {
      bubbles.forEach(b => { b.hx *= width / oldWidth; b.hy *= height / oldHeight; });
      compact(); bubbles.forEach(b => { b.fx = b.hx; b.fy = b.hy; });
      reflowAt = clock - REFLOW;
    }
    paint(); run();
  }).observe(field);
  document.addEventListener('visibilitychange', run);
  motion();
  return motion;
}
