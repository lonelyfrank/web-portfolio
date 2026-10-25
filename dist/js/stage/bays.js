// Vani elevatori del ponte e allestimenti montati sui loro piani.
import { STAGE } from '../config.js';
import { $, stationNodes, track, translateOf, unit } from '../dom.js';

// Closed sets wait here, outside the rendered stage.
export const storage = $('.set-storage');

// Bays: identical modules of the bridge. Each one owns its shaft, plate, rods and
// cylinders. An area's equipment ("set") is mounted on one bay's plate at a time.
export const bays = [];
// Bridge module assigned to each area during the current trip.
export const stationBays = new Map();

export function buildBays() {
  track.style.setProperty('--bay-radius', STAGE.bays + 1);
  for (let k = -STAGE.bays; k <= STAGE.bays; k++) {
    const el = document.createElement('div');
    el.className = 'bay';
    el.innerHTML = `
      <div class="bay-rail"></div>
      <div class="bay-bracket"></div>
      <div class="bay-shaft"></div>
      <div class="bay-pad bay-pad-top"></div>
      <div class="bay-lift"><div class="bay-rod bay-rod-left"></div><div class="bay-rod bay-rod-right"></div><div class="bay-plate"></div><div class="bay-mount"></div></div>
      <div class="bay-cylinder bay-cylinder-left"></div>
      <div class="bay-cylinder bay-cylinder-right"></div>
      <div class="bay-pad bay-pad-front"></div>
      <div class="bay-edge"></div>`;
    track.append(el);
    const bay = { el, k, lift: $('.bay-lift', el), mount: $('.bay-mount', el), set: null, level: STAGE.drop };
    setBayIndex(bay, k);
    bays.push(bay);
  }
}

function setBayIndex(bay, k) {
  bay.k = k;
  bay.el.style.setProperty('--k', k);
}

// Renumbers the modules for a camera moved back by `shift` bays. Modules that
// leave the generated range re-enter on the other side, always closed and empty.
export function shiftBays(shift) {
  const span = 2 * STAGE.bays + 1;
  bays.forEach(bay => {
    let k = bay.k - shift;
    if (k < -STAGE.bays || k > STAGE.bays) {
      while (k < -STAGE.bays) k += span;
      while (k > STAGE.bays) k -= span;
      unmountSet(bay);
      moveLift(bay, STAGE.drop, 0);
    }
    setBayIndex(bay, k);
  });
}

export const bayOfSet = index => bays.find(bay => bay.set === index) || null;
export const bayAt = k => bays.find(bay => bay.k === k);
export const liftsMoving = () => bays.some(bay => bay.lift.getAnimations().length);

// The equipment darkens as it sinks and fades out in the lowest part of the
// shaft; plate, rods and cylinders belong to the bay and stay visible.
const shade = level => {
  const depth = Math.min(1, Math.max(0, level / STAGE.drop));
  return {
    filter: depth < .005 ? 'none' : `brightness(${(1 - .7 * depth).toFixed(3)})`,
    opacity: Math.min(1, (1 - depth) / .35).toFixed(3),
  };
};

export function liftLevel(bay) {
  if (!bay.lift.getAnimations().length) return bay.level;
  return translateOf(bay.lift, 'y') / unit();
}

// Rigid move of plate, rods and equipment together; returns when it stops.
export function moveLift(bay, level, duration, easing) {
  const from = liftLevel(bay);
  [bay.lift, bay.mount].forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
  bay.level = level;
  const end = { transform: `translateY(${level * unit()}px)` };
  Object.assign(bay.lift.style, end);
  Object.assign(bay.mount.style, shade(level));
  bay.el.classList.toggle('raised', level < STAGE.drop - .5);
  const time = duration * Math.abs(level - from) / STAGE.drop;
  if (time < 16) return Promise.resolve();
  const options = { duration: time, easing };
  // Same timing for the rigid move and the darkness of the shaft.
  bay.mount.animate([0, .25, .5, .75, 1].map(offset => ({ ...shade(from + (level - from) * offset), offset })), options);
  const animation = bay.lift.animate([{ transform: `translateY(${from * unit()}px)` }, end], options);
  return animation.finished.then(() => {}, () => {});
}

// Freeze every running lift at its rendered height, releasing pending awaits.
export function freezeLifts() {
  bays.forEach(bay => {
    if (bay.lift.getAnimations().length || bay.mount.getAnimations().length) {
      moveLift(bay, liftLevel(bay), 0);
    }
  });
}

// Pixel values depend on the scene unit: re-apply them, keep the levels.
export function refreshLifts() {
  bays.forEach(bay => moveLift(bay, bay.level, 0));
}

export function mountSet(bay, index) {
  const previous = bayOfSet(index);
  if (previous && previous !== bay) previous.set = null;
  if (bay.set !== null && bay.set !== index) unmountSet(bay);
  bay.set = index;
  bay.mount.append(stationNodes[index]);
}

export function unmountSet(bay) {
  if (bay.set === null) return;
  if (stationNodes[bay.set].parentNode === bay.mount) storage.append(stationNodes[bay.set]);
  bay.set = null;
}

// Every module closed and empty at once, before a stable composition.
export function closeBays() {
  bays.forEach(bay => {
    bay.lift.getAnimations().forEach(animation => animation.cancel());
    unmountSet(bay);
    moveLift(bay, STAGE.drop, 0);
  });
}
