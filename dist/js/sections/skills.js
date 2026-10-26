// Fourteen compact soap bubbles. Pops are random and each one is followed, in sequence, by a
// birth in an interior gap; the cluster keeps packing itself while bubbles vanish and grow.
// Returns the update to call whenever the motion preference changes.
import { root } from '../dom.js';
import { isJourney, state } from '../state.js';

export function initSkills() {
  const field = document.querySelector('.skill-orbits');
  const items = [...field.querySelectorAll('.skill-item')];
  const COUNT = 14, FILL = .72, GAP = 1, BIRTH = 1.5, POP = .34, PULL = 1.4, HOVER = .22, STEP = 1 / 60;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  let bubbles = [], cursor = 0, clock = 0, queue = [], lastAt = 0, doubled = false;
  const lastShown = new Map();
  let size = 0, width = 0, height = 0, spacing = 0;
  let frame = 0, last = 0, visible = false, enabled = false;
  let pointer = null, lastGap = null, hoveredBubble = null, calm = 0, owed = 0;

  function measure() {
    if (!field.clientWidth) return false;
    width = field.clientWidth; height = field.clientHeight;
    // The largest bubble whose hexagonal packing of COUNT leaves FILL of the field used, so births
    // and the hover swell still find room.
    size = 106;
    while (size > 40 && COUNT * .866 * (size * GAP) ** 2 > FILL * (width - 24 - size) * (height - 24 - size)) size--;
    spacing = size * GAP; // Centres rest one bubble apart, so neighbours keep a visible gap.
    field.style.setProperty('--bubble-size', `${size}px`);
    return true;
  }
  function bound(b) {
    b.x = clamp(b.x, size / 2 + 12, width - size / 2 - 12);
    b.y = clamp(b.y, size / 2 + 12, height - size / 2 - 12);
  }
  // Share of its full footprint a bubble claims: newborns and hovered ones swell and shoulder their
  // neighbours aside, popped ones free the space.
  function footprint(b) {
    if (b.dying !== null) return 1 - ease((clock - b.dying) / POP);
    return (.15 + .85 * ease((clock - b.born) / BIRTH)) * (1 + HOVER * b.hover);
  }
  function add(x, y, initial = false) {
    const names = new Set(bubbles.map(b => b.node.textContent.trim()));
    const node = items.filter(candidate => !bubbles.some(b => b.node === candidate)
      && !names.has(candidate.textContent.trim()))
      .sort((a, b) => (lastShown.get(a) ?? -1) - (lastShown.get(b) ?? -1))[0];
    lastShown.set(node, cursor++);
    node.dataset.alive = '';
    bubbles.push({ node, x, y, shownX: x, shownY: y, hover: 0, dying: null,
      born: initial ? clock - BIRTH - Math.random() * 18 : clock });
  }

  function relax(dt) {
    // Continuous packing: a weak pull to the centre closes holes, overlaps push neighbours apart.
    // Returns the largest distance any bubble travelled, to tell when the cluster has come to rest.
    const before = bubbles.map(b => [b.x, b.y]);
    // The bubble under the pointer is an anchor: if it were pushed by its own swell, it would slide out
    // from under the cursor, shrink, slide back and swell again, a rapid left-right shake.
    const anchored = b => b === hoveredBubble;
    for (let pass = 0; pass < 3; pass++) {
      for (const b of bubbles) {
        if (anchored(b)) continue;
        b.x += (width / 2 - b.x) * PULL * dt / 3;
        b.y += (height / 2 - b.y) * PULL * dt / 3;
      }
      for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        if (Math.hypot(dx, dy) < .01) { dx = .1; dy = .07; }
        const distance = Math.hypot(dx, dy), reach = spacing * (footprint(a) + footprint(b)) / 2;
        if (distance >= reach) continue;
        const move = (reach - distance) / distance;
        const wa = anchored(a) ? 0 : anchored(b) ? 1 : .5, wb = 1 - wa;
        a.x -= dx * move * wa; a.y -= dy * move * wa;
        b.x += dx * move * wb; b.y += dy * move * wb;
      }
      bubbles.forEach(bound);
    }
    return Math.max(0, ...bubbles.map((b, i) => Math.hypot(b.x - before[i][0], b.y - before[i][1])));
  }
  function settle() {
    for (let i = 0; i < 120; i++) relax(STEP);
    for (const b of bubbles) { b.shownX = b.x; b.shownY = b.y; }
    calm = 0;
  }
  // Anything still growing, bursting or swelling keeps the packing live.
  const busy = () => bubbles.some(b => b.dying !== null || clock - b.born < BIRTH + .1
    || Math.abs(b.hover - (b === hoveredBubble ? 1 : 0)) > .003);

  function gap() {
    // Interior triangular gaps vary with each arrangement; no fixed centre emitter.
    const live = bubbles.filter(b => b.dying === null);
    const candidates = [];
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      for (let k = j + 1; k < live.length; k++) {
        const triple = [live[i], live[j], live[k]];
        if (triple.some(a => triple.some(b => Math.hypot(a.x - b.x, a.y - b.y) > spacing * 1.8))) continue;
        const x = triple.reduce((sum, b) => sum + b.x, 0) / 3;
        const y = triple.reduce((sum, b) => sum + b.y, 0) / 3;
        const clearance = Math.min(...live.map(b => Math.hypot(x - b.x, y - b.y)));
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

  function schedule(from) {
    // A calm carousel: a pop every 5-7 s (7 s after a double one). Each birth follows its own pop,
    // and the second pop of a double event waits for the first birth.
    const double = Math.random() < .35;
    let at = from + (doubled ? 7 : 5 + Math.random() * 2);
    queue = queue.filter(action => action.manual);
    for (let i = double ? 2 : 1; i > 0; i--) {
      queue.push({ at, type: 'pop' });
      at += POP + .8 + Math.random() * .5;
      queue.push({ at, type: 'birth' });
      at += 1 + Math.random() * .6;
    }
    doubled = double;
    queue.sort((p, q) => p.at - q.at);
  }
  function perform(action) {
    if (action.type === 'pop' && !action.manual) lastAt = action.at;
    if (action.type === 'birth') { const { x, y } = gap(); add(x, y); return; }
    // Any mature bubble may pop; fresh ones are left to finish growing.
    const mature = bubbles.filter(b => b.dying === null && clock - b.born > BIRTH + 1.5);
    pop(mature[Math.floor(Math.random() * mature.length)]);
  }
  function pop(victim) {
    if (!victim || victim.dying !== null) return;
    victim.dying = clock;
    victim.node.dataset.popping = '';
  }
  function retire() {
    const gone = bubbles.filter(b => b.dying !== null && clock - b.dying >= POP);
    if (!gone.length) return;
    for (const b of gone) {
      b.node.style.opacity = 0;
      b.node.removeAttribute('data-alive'); b.node.removeAttribute('data-popping');
    }
    bubbles = bubbles.filter(b => !gone.includes(b));
  }

  function bubbleAt(x, y) {
    // Nearest live bubble under the pointer; a hovered one has already grown, so it keeps its hold.
    return bubbles.filter(b => b.dying === null)
      .map(b => ({ b, distance: Math.hypot(b.x - x, b.y - y) }))
      .filter(({ b, distance }) => distance <= size / 2 * footprint(b) * (1 + .22 * b.hover))
      .sort((p, q) => p.distance - q.distance)[0]?.b;
  }
  function paint(dt = 0) {
    // Hysteresis: the bubble already hovered keeps the pointer until it leaves with a small margin, so two
    // neighbours never trade the swell back and forth while the cluster shifts under a still cursor.
    const holds = pointer && hoveredBubble && bubbles.includes(hoveredBubble) && hoveredBubble.dying === null
      && Math.hypot(hoveredBubble.x - pointer.x, hoveredBubble.y - pointer.y)
        <= size / 2 * footprint(hoveredBubble) * (1 + .22 * hoveredBubble.hover) * 1.1;
    const hovered = !pointer ? null : holds ? hoveredBubble : bubbleAt(pointer.x, pointer.y) || null;
    hoveredBubble = hovered;
    field.classList.toggle('is-hovering', !!hovered);
    for (const b of bubbles) {
      b.hover += ((b === hovered ? 1 : 0) - b.hover) * (1 - Math.exp(-9 * dt));
      // The drawn position follows the packing through a low-pass filter, so any residual flutter of the
      // packing (frames of uneven length move the pull and the pushes by different amounts) stays invisible.
      const follow = 1 - Math.exp(-20 * dt);
      b.shownX += (b.x - b.shownX) * follow; b.shownY += (b.y - b.shownY) * follow;
      const x = b.shownX, y = b.shownY;
      let scale = .18 + .82 * ease((clock - b.born) / BIRTH), opacity = 1;
      if (b.dying !== null) {
        // A quick swell, then the bubble bursts and fades.
        const t = clamp((clock - b.dying) / POP, 0, 1), burst = ease((t - .35) / .65);
        scale = 1 + .14 * ease(t / .35) - .14 * burst - .3 * burst;
        opacity = 1 - burst;
      }
      b.node.style.opacity = opacity.toFixed(3);
      // One transform per bubble (position and swell), so each stays a single stable
      // compositor layer: no nested animated layers re-rasterised every frame.
      b.node.style.transform = `translate3d(${clamp(x - size / 2, 4, width - size - 4).toFixed(2)}px, ${clamp(y - size / 2, 6, height - size - 6).toFixed(2)}px, 0) scale(${(scale * (1 + HOVER * b.hover)).toFixed(4)})`;
    }
  }
  function tick(now) {
    frame = 0;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now; clock += dt;
    while (queue.length && queue[0].at <= clock) perform(queue.shift());
    if (!queue.some(action => !action.manual)) schedule(lastAt);
    retire();
    // At rest the packing is frozen: the pull and the overlap pushes never settle to the last hundredth of a
    // pixel, and that endless creep reads as a shimmer on fine logos.
    // The packing advances in fixed steps: its resting arrangement must not depend on how long each frame took.
    if (busy()) calm = 0;
    owed = Math.min(owed + dt, STEP * 4);
    for (; owed >= STEP; owed -= STEP) if (calm < 20) calm = relax(STEP) < .04 && !busy() ? calm + 1 : 0;
    paint(dt);
    frame = requestAnimationFrame(tick);
  }
  function clearPointer() { pointer = null; }
  function run() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    const paused = !enabled || !visible || !bubbles.length || document.hidden;
    field.classList.toggle('is-paused', paused);
    if (paused) clearPointer();
    else frame = requestAnimationFrame(tick);
  }
  function seed() {
    clock = 0; owed = 0; lastAt = -2; doubled = false; queue = []; lastGap = null; hoveredBubble = null; calm = 0;
    // Hexagonal lattice points inside the field, nearest the centre first.
    const lattice = [], rowGap = spacing * .866, reach = Math.ceil(Math.max(width, height) / rowGap);
    for (let r = -reach; r <= reach; r++) for (let c = -reach; c <= reach; c++) {
      const x = width / 2 + (c + (r & 1 ? .5 : 0)) * spacing, y = height / 2 + r * rowGap;
      if (Math.abs(x - width / 2) <= width / 2 - size / 2 - 12 && Math.abs(y - height / 2) <= height / 2 - size / 2 - 12)
        lattice.push([x, y]);
    }
    lattice.sort((p, q) => Math.hypot(p[0] - width / 2, p[1] - height / 2) - Math.hypot(q[0] - width / 2, q[1] - height / 2));
    lattice.slice(0, COUNT).forEach(([x, y]) => add(x, y, true));
    while (bubbles.length < COUNT) add(width / 2 + (Math.random() - .5) * spacing, height / 2 + (Math.random() - .5) * spacing, true);
    settle();
    schedule(0); paint();
  }
  function motion() {
    // The floating bubbles belong to Journey; Reading shows the static labelled grid.
    const next = !state.reduced && isJourney();
    if (next === enabled) return;
    enabled = next;
    field.classList.toggle('is-floating', enabled);
    field.style.removeProperty('--bubble-size');
    items.forEach(node => {
      node.removeAttribute('style'); node.removeAttribute('data-alive'); node.removeAttribute('data-popping');
    });
    bubbles = []; clearPointer();
    if (enabled && measure()) seed();
    run();
  }
  field.addEventListener('pointermove', e => {
    if (!enabled || e.pointerType === 'touch') return;
    const r = field.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
  });
  // Easter egg: a double click bursts the bubble, and its replacement is born right after.
  field.addEventListener('dblclick', e => {
    if (!enabled) return;
    const r = field.getBoundingClientRect();
    const target = bubbleAt(e.clientX - r.left, e.clientY - r.top);
    if (!target || clock - target.born < BIRTH) return;
    pop(target);
    queue.push({ at: clock + POP + .35, type: 'birth', manual: true });
    queue.sort((p, q) => p.at - q.at);
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
      bubbles.forEach(b => { b.x *= width / oldWidth; b.y *= height / oldHeight; });
      calm = 0;
      settle();
    }
    paint(); run();
  }).observe(field);
  document.addEventListener('visibilitychange', run);
  new MutationObserver(motion).observe(root, { attributes: true, attributeFilter: ['class'] });
  motion();
  return motion;
}
