// Parabola di Contact: una scansione ogni 7-12 s (subito dopo la sintonia di Frank), poi la posa inclinata.
import { RADIO, SECTION } from '../config.js';
import { $ } from '../dom.js';
import { isJourney, state } from '../state.js';

const radio = $('.station-contact .station-equipment');
let radioTimer;

// In Viaggio la parabola esiste solo nell'area Contact: niente timer per un
// allestimento chiuso nel vano, né durante transizioni e lavoro di Frank.
function radioAvailable() {
  return !state.reduced && !document.hidden
    && (!isJourney() || (state.current === SECTION.contact && state.phase === 'waiting'));
}

export function scheduleRadio(firstDelayMs) {
  clearTimeout(radioTimer);
  radio.style.setProperty('--radio-frame', 1);
  radio.dataset.state = 'resting';
  if (!radioAvailable()) return;
  const delay = firstDelayMs ?? RADIO.minDelayMs + Math.random() * (RADIO.maxDelayMs - RADIO.minDelayMs);
  radioTimer = setTimeout(() => scanRadio(0), delay);
}

function scanRadio(index) {
  if (!radioAvailable()) { scheduleRadio(); return; }
  if (index === RADIO.scan.length) { scheduleRadio(); return; }
  radio.dataset.state = 'scanning';
  radio.style.setProperty('--radio-frame', RADIO.scan[index]);
  radioTimer = setTimeout(() => scanRadio(index + 1), RADIO.frameMs);
}
