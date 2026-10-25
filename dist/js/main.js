// Francesco Spina — Space Journey
// Avvio: collega i moduli nell'ordine di registrazione e compone la scena iniziale.
import { $, root } from './dom.js';
import { isJourney, state } from './state.js';
import { initDetail } from './detail.js';
import { initLifecycle } from './lifecycle.js';
import { initMode, setMode } from './mode.js';
import { initMotion, onMotionChange, setReduced } from './motion.js';
import { initNavigation } from './navigation.js';
import { initReading } from './reading.js';
import { initContact } from './sections/contact.js';
import { initSkills } from './sections/skills.js';
import { buildBays } from './stage/bays.js';
import { measureContent } from './stage/camera.js';
import { initStations } from './stage/stations.js';

initStations();
initMode();
initLifecycle();
initNavigation();
initReading();
initMotion();
initDetail();
$('#year').textContent = new Date().getFullYear();

buildBays();
measureContent();
root.classList.toggle('document-hidden', document.hidden);
setReduced(state.reduced);
setMode(isJourney() ? 'journey' : 'read');

onMotionChange(initSkills());
initContact();
