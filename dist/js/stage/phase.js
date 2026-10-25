// Fase della regia: un solo punto di scrittura per stato, DOM e controlli.
import { strip } from '../dom.js';
import { state } from '../state.js';
import { projectCarousel } from './projector.js';

export function setPhase(next) {
  state.phase = next;
  strip.dataset.phase = next;
  projectCarousel.controls();
}
