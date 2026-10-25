// Stato condiviso dalla regia. Ogni altro stato appartiene al modulo che lo gestisce.
import { SECTIONS } from './config.js';
import { root } from './dom.js';

export const state = {
  current: Math.max(0, SECTIONS.indexOf(location.hash.slice(1))), // sezione selezionata
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  phase: 'waiting',     // regia del Viaggio, riflessa in .journey-strip[data-phase]
  poweredStation: null, // postazione con proiezioni accese
};

export const isJourney = () => root.classList.contains('journey');
// Leaving, approaching and arriving move the stage; waiting, aligning and
// interacting keep it at rest.
export const inTransit = () => ['leaving', 'approaching', 'arriving'].includes(state.phase);
