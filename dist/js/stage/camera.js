// Camera del Viaggio: ponte, pannelli di testo e parallasse seguono la stessa x.
import { SECTION, SLIDE_GAP, STAGE, STATION_BAYS, STATIONS } from '../config.js';
import { main, pages, root, track, translateOf, unit } from '../dom.js';
import { inTransit, isJourney, state } from '../state.js';
import { positionTeleport } from './actor.js';
import { liftsMoving, shiftBays, stationBays } from './bays.js';
import { placeBeam } from './projector.js';

// Camera position (su) that places bay k under the area's composition.
export const restCam = (k, index) => k * STAGE.bay + STATIONS[index].focus - STATIONS[index].bay;

export function setCam(cam, duration = 0) {
  track.style.transition = duration ? `transform ${duration}ms linear` : 'none';
  track.style.setProperty('--cam', cam);
  if (!duration) void track.offsetWidth;
}
export function currentCam() {
  // At rest the authored value is exact. Serialising a large CSS matrix rounds
  // its translation, which otherwise leaves subpixel drift after normalization.
  return track.getAnimations().length ? -translateOf(track, 'x') / unit()
    : Number(track.style.getPropertyValue('--cam'));
}

// Station anchors map the rendered camera to one continuous strip of slides.
// This keeps trips short at a natural gait without overlapping wide panels.
export const contentPositions = new Map();
export let renderedCam = 0;
let contentFrame = 0;
let contentLayout;

// Layout is stable during travel. Read dimensions once on mode/size changes,
// before any per-frame writes, rather than forcing layout on every camera tick.
export function measureContent() {
  const gutter = parseFloat(getComputedStyle(main).paddingLeft);
  const width = main.clientWidth - 2 * gutter;
  contentLayout = { width, pitch: width + Math.max(SLIDE_GAP, gutter),
    left: main.getBoundingClientRect().left + gutter, viewport: innerWidth };
}

// Anchors of a stable composition with `target` at the centre of bay 0.
export function anchorContent(target) {
  contentPositions.clear();
  stationBays.clear();
  pages.forEach((page, index) => {
    const k = (index - target) * STATION_BAYS;
    stationBays.set(index, k);
    contentPositions.set(index, restCam(k, index));
  });
}

function contentProgress(cam) {
  let index = 0;
  while (index < pages.length - 2 && cam > contentPositions.get(index + 1)) index++;
  const start = contentPositions.get(index);
  const end = contentPositions.get(index + 1);
  return index + (cam - start) / (end - start);
}

export function positionContent() {
  if (!isJourney() || !contentPositions.size) return;
  const cam = currentCam();
  renderedCam = cam;
  positionTeleport(cam);
  const progress = contentProgress(cam);
  const { width, pitch, left, viewport } = contentLayout;
  pages.forEach((page, index) => {
    const x = (index - progress) * pitch;
    // Position before revealing: even an inactive section is rendered whenever
    // its scrollport intersects the main viewport. Navigation owns only inert.
    page.style.setProperty('--content-x', `${x}px`);
    const hidden = index !== state.current && (left + x + width <= 0 || left + x >= viewport);
    if (page.hidden !== hidden) page.hidden = hidden;
  });
  // Distant scenery samples this same camera, at its existing slower ratios.
  setParallax((cam - contentPositions.get(0)) / (STATION_BAYS * STAGE.bay));
}

export function followContent() {
  cancelAnimationFrame(contentFrame);
  const update = () => {
    positionContent();
    if (state.poweredStation === SECTION.projects) placeBeam();
    contentFrame = isJourney() && !state.reduced && !document.hidden && inTransit()
      ? requestAnimationFrame(update) : 0;
  };
  update();
}

export function stopFollowing() {
  cancelAnimationFrame(contentFrame);
  contentFrame = 0;
}

export function setParallax(index, duration = 0) {
  root.style.setProperty('--travel-ms', `${duration}ms`);
  root.style.setProperty('--step', index);
}

// Bridge texture shifts with normalisation so the periodic modules never jump.
export let textureOffset = 0;
export function shiftTexture(shift) {
  textureOffset += shift * STAGE.bay;
  track.style.setProperty('--texture-x', textureOffset);
}

// Brings the camera back near zero between trips. Every rendered coordinate,
// including scenery and bridge texture, is preserved.
export function normalize() {
  const cam = currentCam();
  const shift = Math.round(cam / STAGE.bay);
  if (!shift || liftsMoving()) return;
  shiftBays(shift);
  shiftTexture(shift);
  contentPositions.forEach((anchor, index) => contentPositions.set(index, anchor - shift * STAGE.bay));
  stationBays.forEach((k, index) => stationBays.set(index, k - shift));
  setCam(cam - shift * STAGE.bay);
  positionContent();
}
