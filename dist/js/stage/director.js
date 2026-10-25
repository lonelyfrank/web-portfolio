// Regia del Viaggio: un solo proprietario della scena per ogni richiesta.
import { SECTION, STAGE, TELEPORT_FRAMES, TIMING } from '../config.js';
import { avatar, navLinks, pages, track } from '../dom.js';
import { isJourney, state } from '../state.js';
import {
  clearTeleport, currentActor, positionTeleport, restActor, setActor, startTeleport,
  stopAvatar, teleport, walkAvatar,
} from './actor.js';
import { bayAt, bayOfSet, bays, closeBays, freezeLifts, mountSet, moveLift, shiftBays, stationBays } from './bays.js';
import {
  anchorContent, currentCam, followContent, normalize, positionContent, restCam, setCam,
  shiftTexture, stopFollowing,
} from './camera.js';
import { setPhase } from './phase.js';
import { powerDown, powerUp } from './projector.js';
import { scheduleRadio } from './radio.js';
import { clearRest } from './rest.js';
import { arrive, cancelStation } from './stations.js';

// Walking or teleporting, kept when a resize resumes the same request.
let journeyMovement = 'walking';

// One owner of the stage. Every request supersedes the previous one: pending
// timers and awaits of older requests return early, animations are retargeted
// from their current values, so nothing queues up or freezes midway.
export const director = {
  run: 0,
  timers: new Map(),
  requested: state.current,
  cancel() {
    // Commit the rendered values before removing a transition. In particular,
    // CSS reversal shortening must not change the selected ground speed.
    if (isJourney()) {
      const cam = currentCam();
      positionTeleport(cam);
      const actor = currentActor();
      setCam(cam);
      setActor(actor);
      void avatar.offsetWidth;
    }
    clearTeleport();
    this.run++;
    stopFollowing();
    this.timers.forEach((resolve, timer) => { clearTimeout(timer); resolve(); });
    this.timers.clear();
    // Resolve cancelled lift awaits too, including when switching to Reading.
    freezeLifts();
  },
  wait(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.timers.delete(timer); resolve(); }, Math.max(0, ms));
      this.timers.set(timer, resolve);
    });
  },
};

export async function stageTo(target, { instant = false, resume = false } = {}) {
  const previousTeleport = teleport;
  director.cancel();
  const run = director.run;
  const alive = () => run === director.run && isJourney();
  const from = director.requested;
  director.requested = target;
  cancelStation();
  clearRest();
  powerDown();
  setStageContent(target, false);

  if (instant || state.reduced || document.hidden) { settle(target); return; }

  // Exit the interaction and lower equipment independently of the text.
  setPhase('leaving');
  scheduleRadio();
  const k = stationBays.get(target);
  const destination = bayAt(k);
  positionContent();
  const own = bayOfSet(target);
  const lowering = new Map();
  bays.forEach(bay => {
    if (bay.set !== null && (bay.set !== target || bay !== destination)) {
      // Resume from the visible height, including a descent interrupted by a click.
      lowering.set(bay, moveLift(bay, STAGE.drop, TIMING.lower, 'cubic-bezier(.5,0,.75,.6)'));
    }
  });
  // Prepare the destination concurrently with travel. Only an occupied shaft or
  // a visible copy of the requested set must finish descending before remounting.
  const rising = (async () => {
    await Promise.all([lowering.get(own), lowering.get(destination)]);
    if (!alive()) return;
    mountSet(destination, target);
    const lift = moveLift(destination, 0, TIMING.rise, 'cubic-bezier(.2,.7,.25,1)');
    // Equipment rises during travel; Projects only projects once Frank arrives.
    setStageContent(target, true);
    if (target !== SECTION.projects) powerUp(target);
    await lift;
  })();

  // Finish an interrupted dematerialisation even when the new request is nearby:
  // switching straight to walking would make a partially invisible actor flash.
  const movement = resume ? journeyMovement
    : (previousTeleport || Math.abs(target - from) > 1) ? 'teleporting' : 'walking';
  journeyMovement = movement;
  const speed = movement === 'teleporting' ? STAGE.jumpSpeed : STAGE.walkSpeed;
  const camFrom = currentCam();
  const camTo = restCam(k, target);
  // Ground speed under the feet = bridge motion relative to the character,
  // so the stop offset he covers on screen is part of the synchronised gait.
  const ground = (camTo + restActor(target)) - (camFrom + currentActor());
  let travel = Math.abs(camTo - camFrom) > .5
    ? Math.max(TIMING.minTravel, Math.round(Math.max(Math.abs(ground), Math.abs(camTo - camFrom)) / speed * 1000)) : 0;
  let walk = 0;
  if (travel) {
    setPhase('approaching');
    // Near a reversal the actor can already be at the target world coordinate
    // while the camera still needs to reframe it. Keep that camera move smooth,
    // and synchronise the stride to the actual (possibly zero) ground speed.
    if (movement === 'teleporting') {
      stopAvatar();
      const startFrame = previousTeleport?.frame ?? 0;
      // A same-destination resize keeps the original camera-to-frame mapping.
      // A new destination starts from the currently visible pose, without a pop.
      startTeleport(resume && previousTeleport ? previousTeleport : {
        fromCam: camFrom, toCam: camTo, origin: camFrom + currentActor(),
        destination: camTo + restActor(target), startFrame, frame: startFrame,
        duration: Math.max(travel, (2 * TELEPORT_FRAMES - startFrame) * TIMING.teleportFrame),
      });
      travel = resume && previousTeleport
        ? Math.max(TIMING.minTravel, teleport.duration * Math.abs((camTo - camFrom) / (teleport.toCam - teleport.fromCam)))
        : teleport.duration;
      if (!previousTeleport) avatar.classList.toggle('back', ground < 0);
      positionTeleport(camFrom);
    } else if (Math.abs(ground) > .5) walkAvatar(ground, Math.abs(ground) / travel * 1000);
    else stopAvatar();
    setCam(camTo, travel);
    if (!teleport) setActor(restActor(target), travel);
  } else {
    // Same shaft (a quick return): only a short local walk to the stop.
    const offset = restActor(target) - currentActor();
    if (Math.abs(offset) > 2) {
      walkAvatar(offset, STAGE.alignSpeed);
    }
    walk = Math.abs(offset) / STAGE.alignSpeed * 1000;
    setActor(restActor(target), walk);
  }

  followContent();
  // Wait for the journey while both sets are already moving on their lifts.
  if (travel || walk) {
    const motion = (travel ? track : avatar).getAnimations()[0];
    // A viewport scale change can cancel a CSS transition before the resize
    // handler restarts it. Cancellation is not arrival: only its new owner may
    // commit the endpoint. This also releases awaits superseded by navigation.
    if (motion) {
      const completed = await motion.finished.then(() => true, () => false);
      if (!completed) return;
    } else await director.wait(travel || walk);
    if (!alive()) return;
  }
  // Commit the exact endpoint before recycling bridge modules.
  setCam(camTo);
  clearTeleport();
  setActor(restActor(target));
  avatar.classList.remove('walking');
  avatar.style.removeProperty('--cycle-ms');
  setPhase('arriving');
  await Promise.all([rising, ...lowering.values()]);
  if (!alive()) return;

  // Coordinates and lifts are settled before enabling the Projects projection.
  normalize();
  positionContent();
  setStageContent(target, true);
  if (target === SECTION.projects) powerUp(target);
  arrive();
}

// Stable, complete composition without travel (load, mode switch, reduced motion).
export function settle(target) {
  clearTeleport();
  director.requested = target;
  showPage(target);
  closeBays();
  const shift = Math.round(currentCam() / STAGE.bay);
  shiftBays(shift);
  shiftTexture(shift);
  const centre = bayAt(0);
  mountSet(centre, target);
  moveLift(centre, 0, 0);
  setCam(restCam(0, target));
  anchorContent(target);
  positionContent();
  setActor(restActor(target));
  avatar.classList.remove('walking');
  setStageContent(target, true);
  powerUp(target, { instant: true });
  arrive();
}

function setStageContent(index, on) {
  // Mechanical state is useful to the director, but never gates semantic text.
  pages[index].dataset.stage = on ? 'on' : 'off';
}

export function showPage(index) {
  const focusedPage = document.activeElement.closest('.page');
  if (focusedPage && focusedPage !== pages[index]) {
    navLinks[index].focus({ preventScroll: true });
  }
  pages.forEach((page, i) => {
    page.classList.toggle('active', i === index);
    page.inert = i !== index;
  });
  positionContent();
}
