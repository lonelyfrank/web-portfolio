// Visibilità del documento e resize: la scena non resta mai a metà di un tragitto.
import { SECTION } from './config.js';
import { root } from './dom.js';
import { inTransit, isJourney, state } from './state.js';
import { updateReadProgress } from './reading.js';
import { refreshLifts } from './stage/bays.js';
import { measureContent, positionContent, renderedCam, setCam } from './stage/camera.js';
import { director, settle, stageTo } from './stage/director.js';
import { placeBeam } from './stage/projector.js';
import { scheduleRadio } from './stage/radio.js';
import { clearRest, scheduleRest } from './stage/rest.js';
import { arrive, pauseStation, resumeStation } from './stage/stations.js';

export function initLifecycle() {
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('document-hidden', document.hidden);
    clearRest();
    pauseStation();
    if (document.hidden) {
      // Never leave a transfer or a lift halfway in a hidden document.
      if (isJourney() && inTransit()) {
        director.cancel();
        settle(state.current);
      }
    } else if (!resumeStation()) {
      // No interaction to continue: finish an interrupted arrival, or rest.
      if (isJourney() && state.phase === 'aligning') arrive();
      else scheduleRest();
    }
    scheduleRadio();
  });

  let resizeFrame;
  window.addEventListener('resize', () => {
    const cam = renderedCam;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      measureContent();
      if (!isJourney()) { updateReadProgress(); return; }
      if (!inTransit()) {
        // Pixel values depend on the scene unit: re-apply them, keep the pose.
        refreshLifts();
        positionContent();
        if (state.current === SECTION.projects) placeBeam();
      } else {
        // A scale/layout change reflows the world around its last rendered camera,
        // then resumes the same request. Never jump to the destination on resize.
        setCam(cam);
        positionContent();
        stageTo(state.current, { resume: true });
      }
    });
  });
}
