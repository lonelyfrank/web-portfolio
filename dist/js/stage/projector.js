// Postazione Projects: proiettore, fascio di luce e carosello che proietta.
import { SECTION, TIMING } from '../config.js';
import { $, dialog, stationNodes } from '../dom.js';
import { isJourney, state } from '../state.js';
import { ProjectCarousel } from '../sections/carousel.js';

const station = stationNodes[SECTION.projects];
const emitter = $('[data-emitter="feature"]', station);
const beam = $('.scene-link[data-link="feature"]');
const screen = $('.project-carousel');

export const projectCarousel = new ProjectCarousel({
  canNavigate: () => isJourney() && state.current === SECTION.projects && state.phase === 'waiting'
    && state.poweredStation === SECTION.projects && !dialog.open && !document.hidden,
  reduced: () => state.reduced,
  onChange: () => placeBeam(),
});

export function powerDown() {
  state.poweredStation = null;
  station.dataset.power = 'off';
  projectCarousel.power(false);
  beam.style.transitionDelay = '0ms';
  beam.classList.remove('on');
}

// Only Projects has screens to switch on; the other areas keep their own direction.
export function powerUp(index, { instant = false } = {}) {
  if (!isJourney()) return;
  state.poweredStation = index;
  if (index !== SECTION.projects) return;
  station.dataset.power = 'on';
  projectCarousel.power(true);
  placeBeam();
  beam.style.transitionDelay = instant || state.reduced ? '0ms' : `${TIMING.activate / 2}ms`;
  beam.classList.add('on');
}

// The beam is measured from the real projector and panel, so it follows both
// the travelling camera and the rising lift, as well as layout changes.
export function placeBeam() {
  const box = target => target.getBoundingClientRect();
  // Measure the stable canvas, not the child's power-on transform.
  const lens = box(emitter);
  const target = box(screen);
  const panelBottom = target.top + target.height * .82;
  const lensY = lens.top + lens.height * .22;
  const lensL = lens.left + lens.width * .3;
  const lensR = lens.right - lens.width * .3;
  // Keep the light cone well inside the HUD (60% of the canvas width).
  const screenL = target.left + target.width * .2;
  const screenR = target.right - target.width * .2;
  const left = Math.min(lensL, screenL);
  const right = Math.max(lensR, screenR);
  const width = right - left;
  const height = Math.max(1, lensY - panelBottom);
  const pct = x => `${((x - left) / width * 100).toFixed(2)}%`;
  Object.assign(beam.style, {
    left: `${left}px`, top: `${panelBottom}px`, width: `${width}px`, height: `${height}px`,
    clipPath: `polygon(${pct(screenL)} 0, ${pct(screenR)} 0, ${pct(lensR)} 100%, ${pct(lensL)} 100%)`,
  });
}
