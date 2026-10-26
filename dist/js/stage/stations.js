// Postazioni: allestimenti di ogni area e interazioni di Frank (About, Contact).
import { INTERACTION, RADIO, SECTION, STATIONS } from '../config.js';
import { avatar, pages, stationNodes } from '../dom.js';
import { isJourney, state } from '../state.js';
import { setActor, stopAvatar } from './actor.js';
import { bays, storage } from './bays.js';
import { setPhase } from './phase.js';
import { scheduleRadio } from './radio.js';
import { scheduleRest } from './rest.js';

let stationTimer;
let activeStation = null;
let interactionFrame = 0;

// Local anchors of each set, in the same units as design/stations.md.
export function initStations() {
  stationNodes.forEach((node, index) => {
    const station = STATIONS[index];
    node.style.setProperty('--floor-y', station.floor);
    node.style.setProperty('--bay-x', station.bay);
    if (station.equipment) {
      node.style.setProperty('--equipment-x', station.equipment[0]);
      node.style.setProperty('--equipment-y', station.equipment[1]);
    }
  });
}

export function placeStations(journey) {
  stationNodes.forEach((node, index) => {
    node.classList.remove('interaction-active');
    node.style.setProperty('--frame', STATIONS[index].staticFrame || 0);
    // Move the same node; no duplicate radio, desk, Frank or cat in hidden tabs.
    if (journey || !STATIONS[index].frames) {
      if (!node.closest('.bay-mount')) storage.append(node);
    } else {
      bays.forEach(bay => { if (bay.set === index) bay.set = null; });
      pages[index].append(node);
      node.classList.add('interaction-active');
    }
  });
}

export function cancelStation() {
  clearTimeout(stationTimer);
  // Exit from the authored pose's foot anchor, even if interrupted mid-sequence.
  if (activeStation !== null && isJourney()) {
    const station = STATIONS[activeStation];
    setActor(station.actorX[interactionFrame] - station.focus);
    avatar.classList.toggle('back', activeStation === SECTION.about);
  }
  stationNodes.forEach(node => node.classList.remove('interaction-active'));
  avatar.classList.remove('station-owned');
  activeStation = null;
}

export function arrive() {
  stopAvatar();
  if (!isJourney()) return;
  const station = STATIONS[state.current];
  if (!station.frames) {
    avatar.classList.remove('back');
    setPhase('waiting');
    if (state.current === SECTION.home) scheduleRest();
    scheduleRadio();
    return;
  }
  // Orient before replacing the walking pair with the actor layer.
  avatar.classList.toggle('back', state.current === SECTION.about);
  setPhase('aligning');
  if (state.reduced || document.hidden) startInteraction(true);
  else stationTimer = setTimeout(() => startInteraction(false), INTERACTION.alignMs);
}

function startInteraction(staticPose) {
  activeStation = state.current;
  const station = STATIONS[state.current];
  interactionFrame = staticPose ? station.staticFrame : 0;
  const node = stationNodes[state.current];
  node.style.setProperty('--frame', interactionFrame);
  node.classList.add('interaction-active');
  avatar.classList.add('station-owned');
  setPhase(staticPose ? 'waiting' : 'interacting');
  scheduleRadio();
  if (!staticPose) stationTimer = setTimeout(advanceInteraction, INTERACTION.frameMs);
}

function advanceInteraction() {
  if (activeStation === null || state.reduced || document.hidden || !isJourney()) return;
  const station = STATIONS[activeStation];
  if (interactionFrame === station.frames - 1) {
    setPhase('waiting');
    if (!station.loop) { scheduleRadio(RADIO.tunedDelayMs); return; } // Setup and stand-up play once.
  }
  interactionFrame = (interactionFrame + 1) % station.frames;
  stationNodes[activeStation].style.setProperty('--frame', interactionFrame);
  stationTimer = setTimeout(advanceInteraction, INTERACTION.frameMs);
}

export function pauseStation() {
  clearTimeout(stationTimer);
}

// After the document becomes visible again: continue an unfinished sequence.
// Returns false when no interaction owns the actor.
export function resumeStation() {
  if (activeStation === null) return false;
  const station = STATIONS[activeStation];
  if (!state.reduced && (station.loop || interactionFrame < station.frames - 1)) {
    stationTimer = setTimeout(advanceInteraction, INTERACTION.frameMs);
  }
  return true;
}

// After motion is enabled again: only looping interactions restart.
export function restartLoop() {
  if (activeStation === null || !STATIONS[activeStation].loop) return false;
  clearTimeout(stationTimer);
  stationTimer = setTimeout(advanceInteraction, INTERACTION.frameMs);
  return true;
}
