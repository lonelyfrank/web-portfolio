// Frank e la gatta sul ponte del Viaggio: posizione, camminata e teletrasporto.
import { STAGE, STATIONS, TELEPORT_FRAMES, TIMING } from '../config.js';
import { avatar, translateOf, unit } from '../dom.js';
import { clearRest } from './rest.js';

// Offset (su) of the resting actor from the centred group of an area.
export const restActor = index => STATIONS[index].stop[0] - STATIONS[index].focus;

export function setActor(offset, duration = 0) {
  avatar.style.transition = duration ? `transform ${duration}ms linear` : 'none';
  avatar.style.setProperty('--actor-x', offset);
}
export function currentActor() { return translateOf(avatar, 'x') / unit(); }

// Current teleport, sampled from the camera: { fromCam, toCam, origin,
// destination, startFrame, frame, duration }.
export let teleport = null;

export function startTeleport(next) {
  teleport = next;
  avatar.classList.add('teleporting');
}

// The actor stays attached to the departure floor, then changes world position
// only inside the empty atlas frame. Camera, scenery and panels keep scrolling.
// Sampling the camera also preserves the sequence across a resize or a pause.
export function positionTeleport(cam) {
  if (!teleport) return;
  const state = teleport;
  const progress = Math.max(0, Math.min(1, (cam - state.fromCam) / (state.toCam - state.fromCam)));
  const elapsed = progress * state.duration;
  const arrival = elapsed >= state.duration - TELEPORT_FRAMES * TIMING.teleportFrame;
  const frame = arrival
    ? Math.ceil((state.duration - elapsed) / TIMING.teleportFrame) - 1
    : state.startFrame + Math.floor(elapsed / TIMING.teleportFrame);
  state.frame = Math.max(0, Math.min(TELEPORT_FRAMES - 1, frame));
  avatar.style.setProperty('--teleport-frame', state.frame);
  avatar.dataset.teleport = arrival ? 'arriving' : state.frame === TELEPORT_FRAMES - 1 ? 'hidden' : 'leaving';
  setActor((arrival ? state.destination : state.origin) - cam);
}

export function clearTeleport() {
  teleport = null;
  avatar.classList.remove('teleporting');
  avatar.style.removeProperty('--teleport-frame');
  delete avatar.dataset.teleport;
}

export function walkAvatar(direction, speed) {
  clearTeleport();
  avatar.classList.add('walking');
  avatar.classList.toggle('back', direction < 0);
  avatar.style.setProperty('--cycle-ms', `${Math.round(STAGE.walkStride / speed * 1000)}ms`);
}

export function stopAvatar() {
  clearTeleport();
  avatar.classList.remove('walking');
  avatar.style.removeProperty('--cycle-ms');
  clearRest();
}
