// Movimento ridotto: la preferenza di sistema iniziale e il comando Movimento
// governano lo stesso stato per CSS e JavaScript.
import { $, root } from './dom.js';
import { isJourney, state } from './state.js';
import { bays } from './stage/bays.js';
import { director, settle } from './stage/director.js';
import { projectCarousel } from './stage/projector.js';
import { scheduleRadio } from './stage/radio.js';
import { scheduleRest } from './stage/rest.js';
import { cancelStation, restartLoop } from './stage/stations.js';

const button = $('#motion');
const listeners = new Set();

// Components with their own animation loop follow every change.
export function onMotionChange(listener) {
  listeners.add(listener);
}

export function setReduced(value) {
  state.reduced = value;
  projectCarousel.cancel();
  root.classList.toggle('motion-reduced', value);
  button.setAttribute('aria-pressed', String(value));
  button.title = value ? 'Riattiva movimento' : 'Riduci movimento';
  button.setAttribute('aria-label', button.title);
  if (isJourney() && bays.length) {
    if (value) { director.cancel(); cancelStation(); settle(state.current); }
    else if (!restartLoop()) scheduleRest();
  } else scheduleRest();
  scheduleRadio();
  listeners.forEach(listener => listener(value));
}

export function initMotion() {
  button.addEventListener('click', () => setReduced(!state.reduced));
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => setReduced(e.matches));
}
