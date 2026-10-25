// Riposo a Home (e sul ponte di Lettura): la gatta gira, poi Frank la accarezza.
import { REST, SECTION } from '../config.js';
import { $, $$, avatar } from '../dom.js';
import { isJourney, state } from '../state.js';

const avatars = $$('.avatar');
const readingAvatar = $('.bridge .avatar');
let restTimer;

export function clearRest() {
  clearTimeout(restTimer);
  avatars.forEach(node => node.classList.remove('petting'));
}

export function scheduleRest() {
  clearRest();
  if (state.reduced || document.hidden
    || (isJourney() && (state.current !== SECTION.home || state.phase !== 'waiting'))) return;
  restTimer = setTimeout(() => {
    (isJourney() ? avatar : readingAvatar).classList.add('petting');
    restTimer = setTimeout(scheduleRest, REST.petMs);
  }, REST.idleMs);
}
