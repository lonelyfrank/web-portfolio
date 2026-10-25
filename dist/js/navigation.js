// Navigazione fra le tappe: navbar, hash, frecce, tastiera, rotella e swipe
// convergono sulla stessa regia.
import { SECTIONS, WHEEL } from './config.js';
import { $, $$, dialog, main, navLinks, pages } from './dom.js';
import { isJourney, state } from './state.js';
import { showPage, stageTo } from './stage/director.js';

const progress = $('.progress');
progress.innerHTML = SECTIONS
  .map(id => `<a href="#${id}" aria-label="Vai a ${id}"></a>`)
  .join('');
const progressDots = $$('a', progress);
const counter = $('#counter');
const prev = $('#prev');
const next = $('#next');

const pad = n => String(n).padStart(2, '0');

export function setActiveNav(index) {
  [...navLinks, ...progressDots].forEach(link => {
    const active = link.hash === `#${SECTIONS[index]}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

export function show(index, { instant = false } = {}) {
  index = Math.max(0, Math.min(SECTIONS.length - 1, index));
  state.current = index;

  showPage(index);
  setActiveNav(index);
  stageTo(index, { instant });

  counter.textContent = `${pad(index + 1)} / ${pad(SECTIONS.length)}`;
  prev.disabled = index === 0;
  next.disabled = index === SECTIONS.length - 1;
  const name = SECTIONS[index];
  document.title = `${name[0].toUpperCase() + name.slice(1)} — Francesco Spina`;
}

function go(index) {
  if (index >= 0 && index < SECTIONS.length && index !== state.current) location.hash = SECTIONS[index];
}

// La rotella cambia tappa solo quando il contenuto corrente è già a fine corsa.
function canScroll(target, direction) {
  for (let node = target; node && pages[state.current].contains(node); node = node.parentElement) {
    if (node.scrollHeight <= node.clientHeight + 3 || !/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) continue;
    if (direction > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 3 : node.scrollTop > 3) return true;
  }
  return false;
}

export function initNavigation() {
  window.addEventListener('hashchange', () => {
    if (!isJourney()) return;
    const index = location.hash ? SECTIONS.indexOf(location.hash.slice(1)) : 0;
    if (index < 0) return; // e.g. the skip link targets #content, not Home.
    show(index);
    $('h1, h2', pages[state.current]).focus({ preventScroll: true });
  });

  prev.addEventListener('click', () => go(state.current - 1));
  next.addEventListener('click', () => go(state.current + 1));

  window.addEventListener('keydown', e => {
    if (!isJourney() || dialog.open || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey
      || e.target.isContentEditable || e.target.closest('.project-carousel, button, input, textarea, select, summary')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(state.current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(state.current - 1); }
  });

  let wheelAmount = 0;
  let lastWheel = -Infinity;
  let lastWheelEvent = 0;
  window.addEventListener('wheel', e => {
    if (!isJourney() || dialog.open || e.defaultPrevented || e.ctrlKey || !e.deltaY || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const direction = Math.sign(e.deltaY);
    if (canScroll(e.target, direction)) { wheelAmount = 0; return; }

    e.preventDefault();
    const now = performance.now();
    if (now - lastWheelEvent > WHEEL.burstMs || Math.sign(wheelAmount) !== direction) wheelAmount = 0;
    lastWheelEvent = now;
    if (now - lastWheel < WHEEL.cooldownMs) return;
    const delta = e.deltaY * (e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16
      : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? pages[state.current].clientHeight : 1);
    wheelAmount += delta;
    if (Math.abs(wheelAmount) > WHEEL.threshold) {
      go(state.current + direction);
      lastWheel = now;
      wheelAmount = 0;
    }
  }, { passive: false });

  let touchStart = null;
  main.addEventListener('touchstart', e => {
    touchStart = e.touches.length === 1 ? e.touches[0] : null;
  }, { passive: true });
  main.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  main.addEventListener('touchend', e => {
    const start = touchStart;
    touchStart = null;
    if (!start || e.touches.length || !isJourney() || dialog.open || e.target.closest('.projects-grid, .project-carousel')) return;
    const end = [...e.changedTouches].find(touch => touch.identifier === start.identifier);
    if (!end) return;
    const dx = end.clientX - start.clientX;
    const dy = end.clientY - start.clientY;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(state.current + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
