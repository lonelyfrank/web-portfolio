// Modalità: "read" (pagina che scorre, default su mobile e senza JS) e
// "journey" (un'area alla volta: il mondo scorre attorno al personaggio
// e l'allestimento dell'area sale da un vano elevatore del ponte).
import { JOURNEY_QUERY, MODE_KEY, SECTIONS, SITE_TITLE } from './config.js';
import { $$, pages, root } from './dom.js';
import { state } from './state.js';
import { setActiveNav, show } from './navigation.js';
import { updateReadProgress } from './reading.js';
import { stopAvatar } from './stage/actor.js';
import { measureContent } from './stage/camera.js';
import { director } from './stage/director.js';
import { powerDown, projectCarousel } from './stage/projector.js';
import { scheduleRadio } from './stage/radio.js';
import { scheduleRest } from './stage/rest.js';
import { cancelStation, placeStations } from './stage/stations.js';

const modeButtons = $$('[data-mode]');

function savedMode() {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    return ['journey', 'read'].includes(mode) ? mode : null;
  } catch { return null; }
}

export function setMode(mode, { save = false } = {}) {
  if (save) {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage non disponibile */ }
  }
  const journey = mode === 'journey';
  director.cancel();
  cancelStation();
  powerDown();
  root.classList.toggle('journey', journey);
  placeStations(journey);
  projectCarousel.mode(journey);
  measureContent();
  modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

  if (journey) {
    show(state.current, { instant: true });
    // Reading can change the active section without changing the hash. Keep
    // both in sync when switching modes so clicking the old anchor still works.
    if (save) history.replaceState(history.state, '', `#${SECTIONS[state.current]}`);
    // il salto all'ancora del caricamento può aver spostato il documento
    window.scrollTo(0, 0);
  } else {
    stopAvatar();
    scheduleRest();
    pages.forEach(page => {
      page.hidden = false;
      page.inert = false;
      page.classList.remove('active');
      delete page.dataset.stage;
    });
    root.style.setProperty('--step', 0);
    document.title = SITE_TITLE;
    setActiveNav(state.current);
    if (save) pages[state.current].scrollIntoView({ block: 'start', behavior: 'instant' });
    updateReadProgress();
  }
  scheduleRadio();
}

export function initMode() {
  modeButtons.forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode, { save: true }));
  });
  matchMedia(JOURNEY_QUERY).addEventListener('change', e => {
    if (!savedMode()) setMode(e.matches ? 'journey' : 'read');
  });
}
