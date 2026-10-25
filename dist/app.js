// Francesco Spina — Space Journey
// Due modalità: "read" (pagina che scorre, default su mobile e senza JS)
// e "journey" (un'area alla volta: il mondo scorre attorno al personaggio
// e l'allestimento dell'area sale da un vano elevatore del ponte).

const SECTIONS = ['home', 'about', 'projects', 'contact'];
// Local coordinates use the exported 144 × 136 canvas (floor y=132).
// Footprints and controls are explicit: never infer them from frame alpha bounds.
// `bay` is the canvas x of the lift shaft centre, `focus` the canvas x of the
// character + equipment group, which is the one centred in the viewport.
// `link` is where the remaining screen connector starts (dish).
const STATIONS = [
  { id: 'home', floor: 132, stop: [72, 132], bay: 72, focus: 72, equipment: null, companion: [28, 112, 92, 20], hands: null },
  { id: 'about', floor: 132, stop: [91, 132], bay: 53, focus: 56, equipment: [68, 129], companion: [36, 108, 96, 24], hands: [68, 82], frames: 8, loop: true, staticFrame: 0, actorX: [91, 91, 91, 91, 91, 91, 91, 91] },
  { id: 'projects', floor: 132, stop: [138, 132], bay: 72, focus: 72, equipment: null, companion: [74, 112, 64, 20], hands: null },
  { id: 'contact', floor: 132, stop: [61, 132], bay: 145, focus: 118, equipment: [111, 131], companion: [8, 98, 80, 34], hands: [87, 111], controls: { panel: [87, 111], tuner: [123, 103] }, frames: 8, loop: false, staticFrame: 7, actorX: [61, 64, 62, 99, 98, 59, 60, 60] },
];
const MODE_KEY = 'fs-mode';
const REST_MS = 6400; // due giri della gatta prima della carezza
const PET_MS = 3200;
const WHEEL_COOLDOWN_MS = 800;

// Ponte modulare (unità di scena "su": il personaggio in piedi è alto 96 su).
const STAGE = {
  bay: 330,        // passo fra due vani elevatori
  drop: 106,       // corsa del piano: copre l'allestimento più alto (parabola, 102 su)
  bays: 8,        // vani generati su ciascun lato del centro
  runSpeed: 280,  // su/s nei salti fra sezioni
  runStride: 120,  // avanzamento della corsa per ciclo di 8 fotogrammi (due passi)
  walkSpeed: 168,  // su/s fra sezioni adiacenti
  walkStride: 96, // avanzamento della camminata per ciclo di 8 fotogrammi
  alignSpeed: 72, // su/s per i piccoli aggiustamenti all'arrivo
};
// Sequenza della transizione (ms). Le fasi compatibili si sovrappongono:
// discesa, salita della destinazione e spostamento partono dalla richiesta.
const TIMING = {
  lower: 360,      // discesa completa del piano
  rise: 420,       // salita completa del piano
  activate: 240,   // accensione di schermi e proiezioni
  minTravel: 120,  // mantiene leggibili anche brevi inversioni/riallineamenti
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const root = document.documentElement;
const pages = $$('.page');
const navLinks = $$('.site-nav a');
const avatar = $('#avatar');
const strip = $('.journey-strip');
const track = $('.bridge-track');
const storage = $('.set-storage');
const stationNodes = STATIONS.map(station => $(`[data-station="${station.id}"]`));
const dialog = $('#detail');
const grid = $('#projects-grid');
const journeyQuery = matchMedia('(min-width: 900px) and (min-height: 640px)');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

let current = Math.max(0, SECTIONS.indexOf(location.hash.slice(1)));
let reduced = reduceQuery.matches;
let restTimer;
let stationTimer;
let activeStation = null;
let interactionFrame = 0;
let phase = 'waiting';
const FRAME_MS = 400;
const ALIGN_MS = 100;
const RADIO_MIN_MS = 30000;
const RADIO_MAX_MS = 45000;
const RADIO_FRAME_MS = 250;
const RADIO_SCAN = [1, 2, 3, 4, 5, 6, 7, 0, 1];
let radioTimer;
const radio = $('.station-contact .station-equipment');

// In Viaggio la parabola esiste solo nell'area Contact: niente timer per un
// allestimento chiuso nel vano, né durante transizioni e lavoro di Frank.
function radioAvailable() {
  return !reduced && !document.hidden && (!isJourney() || (current === 3 && phase === 'waiting'));
}

function scheduleRadio() {
  clearTimeout(radioTimer);
  radio.style.setProperty('--radio-frame', 1);
  radio.dataset.state = 'resting';
  if (!radioAvailable()) return;
  const delay = RADIO_MIN_MS + Math.random() * (RADIO_MAX_MS - RADIO_MIN_MS);
  radioTimer = setTimeout(() => scanRadio(0), delay);
}

function scanRadio(index) {
  if (!radioAvailable()) { scheduleRadio(); return; }
  if (index === RADIO_SCAN.length) { scheduleRadio(); return; }
  radio.dataset.state = 'scanning';
  radio.style.setProperty('--radio-frame', RADIO_SCAN[index]);
  radioTimer = setTimeout(() => scanRadio(index + 1), RADIO_FRAME_MS);
}

stationNodes.forEach((node, index) => {
  const station = STATIONS[index];
  node.style.setProperty('--floor-y', station.floor);
  node.style.setProperty('--bay-x', station.bay);
  if (station.equipment) {
    node.style.setProperty('--equipment-x', station.equipment[0]);
    node.style.setProperty('--equipment-y', station.equipment[1]);
  }
});

const pad = n => String(n).padStart(2, '0');
const isJourney = () => root.classList.contains('journey');

$('.progress').innerHTML = SECTIONS
  .map(id => `<a href="#${id}" aria-label="Vai a ${id}"></a>`)
  .join('');
const progressDots = $$('.progress a');

function setActiveNav(index) {
  [...navLinks, ...progressDots].forEach(link => {
    const active = link.hash === `#${SECTIONS[index]}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

/* ---------- Modalità ---------- */

function savedMode() {
  try { return localStorage.getItem(MODE_KEY); } catch { return null; }
}

function setMode(mode, { save = false } = {}) {
  if (save) {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage non disponibile */ }
  }
  const journey = mode === 'journey';
  director.cancel();
  cancelStation();
  root.classList.toggle('journey', journey);
  placeStations(journey);
  setViews(journey);
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

  if (journey) {
    show(current, { instant: true });
    // Reading can change the active section without changing the hash. Keep
    // both in sync when switching modes so clicking the old anchor still works.
    if (save) history.replaceState(history.state, '', `#${SECTIONS[current]}`);
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
    $$('.scenic').forEach(node => { node.inert = false; });
    root.style.setProperty('--step', 0);
    document.title = 'Francesco Spina — Space Journey';
    setActiveNav(current);
    if (save) pages[current].scrollIntoView({ block: 'start', behavior: 'instant' });
    updateReadProgress();
  }
  scheduleRadio();
}

$$('[data-mode]').forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode, { save: true }));
});

journeyQuery.addEventListener('change', e => {
  if (!savedMode()) setMode(e.matches ? 'journey' : 'read');
});

/* ---------- Viaggio: ponte, vani e allestimenti ---------- */

function setPhase(next) {
  phase = next;
  strip.dataset.phase = next;
  projectCarousel.controls();
}

function unit() { return avatar.offsetWidth / 128; }

// Camera position (su) that places bay k under the area's composition.
const restCam = (k, index) => k * STAGE.bay + STATIONS[index].focus - STATIONS[index].bay;
const restActor = index => STATIONS[index].stop[0] - STATIONS[index].focus;
// Consecutive stations occupy neighbouring bridge modules. Text slides have
// their own responsive pitch, projected from this same camera.
const STATION_BAYS = 1;
const SLIDE_GAP = 40; // minimum px between panels; preserve the viewport gutter at rest
const stationBays = new Map();

function translateOf(node, axis) {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
  return axis === 'y' ? matrix.m42 : matrix.m41;
}

// Bays: identical modules of the bridge. Each one owns its shaft, plate, rods and
// cylinders. An area's equipment ("set") is mounted on one bay's plate at a time.
const bays = [];
function buildBays() {
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

const bayOfSet = index => bays.find(bay => bay.set === index) || null;
const bayAt = k => bays.find(bay => bay.k === k);
// The equipment darkens as it sinks and fades out in the lowest part of the
// shaft; plate, rods and cylinders belong to the bay and stay visible.
const shade = level => {
  const depth = Math.min(1, Math.max(0, level / STAGE.drop));
  return {
    filter: depth < .005 ? 'none' : `brightness(${(1 - .7 * depth).toFixed(3)})`,
    opacity: Math.min(1, (1 - depth) / .35).toFixed(3),
  };
};

function liftLevel(bay) {
  if (!bay.lift.getAnimations().length) return bay.level;
  return translateOf(bay.lift, 'y') / unit();
}

// Rigid move of plate, rods and equipment together; returns when it stops.
function moveLift(bay, level, duration, easing) {
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

function mountSet(bay, index) {
  const previous = bayOfSet(index);
  if (previous && previous !== bay) previous.set = null;
  if (bay.set !== null && bay.set !== index) unmountSet(bay);
  bay.set = index;
  bay.mount.append(stationNodes[index]);
}

function unmountSet(bay) {
  if (bay.set === null) return;
  if (stationNodes[bay.set].parentNode === bay.mount) storage.append(stationNodes[bay.set]);
  bay.set = null;
}

function setCam(cam, duration = 0) {
  track.style.transition = duration ? `transform ${duration}ms linear` : 'none';
  track.style.setProperty('--cam', cam);
  if (!duration) void track.offsetWidth;
}
function currentCam() {
  // At rest the authored value is exact. Serialising a large CSS matrix rounds
  // its translation, which otherwise leaves subpixel drift after normalization.
  return track.getAnimations().length ? -translateOf(track, 'x') / unit()
    : Number(track.style.getPropertyValue('--cam'));
}

// Station anchors map the rendered camera to one continuous strip of slides.
// This keeps trips short at a natural gait without overlapping wide panels.
const contentPositions = new Map();
let contentFrame = 0;
let renderedCam = 0;
let journeyGait = 'walking';
function contentProgress(cam) {
  let index = 0;
  while (index < pages.length - 2 && cam > contentPositions.get(index + 1)) index++;
  const start = contentPositions.get(index);
  const end = contentPositions.get(index + 1);
  return index + (cam - start) / (end - start);
}
function positionContent() {
  if (!isJourney() || !contentPositions.size) return;
  const cam = currentCam();
  renderedCam = cam;
  const progress = contentProgress(cam);
  const main = $('main');
  const gutter = parseFloat(getComputedStyle(main).paddingLeft);
  const width = main.clientWidth - 2 * gutter;
  const pitch = width + Math.max(SLIDE_GAP, gutter);
  const left = main.getBoundingClientRect().left + gutter;
  pages.forEach((page, index) => {
    const x = (index - progress) * pitch;
    // Position before revealing: even an inactive section is rendered whenever
    // its scrollport intersects the main viewport. Navigation owns only inert.
    page.style.setProperty('--content-x', `${x}px`);
    page.hidden = index !== current && (left + x + width <= 0 || left + x >= innerWidth);
  });
  // Distant scenery samples this same camera, at its existing slower ratios.
  setParallax((cam - contentPositions.get(0)) / (STATION_BAYS * STAGE.bay));
}
function followContent() {
  cancelAnimationFrame(contentFrame);
  const update = () => {
    positionContent();
    if (poweredStation !== null) placeLinks(poweredStation);
    contentFrame = isJourney() && !reduced && !document.hidden && ['leaving', 'approaching', 'arriving'].includes(phase)
      ? requestAnimationFrame(update) : 0;
  };
  update();
}

function setActor(offset, duration = 0) {
  avatar.style.transition = duration ? `transform ${duration}ms linear` : 'none';
  avatar.style.setProperty('--actor-x', offset);
}
function currentActor() { return translateOf(avatar, 'x') / unit(); }

function setParallax(index, duration = 0) {
  root.style.setProperty('--travel-ms', `${duration}ms`);
  root.style.setProperty('--step', index);
}

// Bridge texture shifts with normalisation so the periodic modules never jump.
let textureOffset = 0;
function normalize() {
  const cam = currentCam();
  const shift = Math.round(cam / STAGE.bay);
  if (!shift || bays.some(bay => bay.lift.getAnimations().length)) return;
  const span = 2 * STAGE.bays + 1;
  bays.forEach(bay => {
    let k = bay.k - shift;
    if (k < -STAGE.bays || k > STAGE.bays) {
      // Recycled out of view: always closed and empty.
      k += k < 0 ? span : -span;
      unmountSet(bay);
      moveLift(bay, STAGE.drop, 0);
    }
    setBayIndex(bay, k);
  });
  textureOffset += shift * STAGE.bay;
  track.style.setProperty('--texture-x', textureOffset);
  contentPositions.forEach((anchor, index) => contentPositions.set(index, anchor - shift * STAGE.bay));
  stationBays.forEach((k, index) => stationBays.set(index, k - shift));
  setCam(cam - shift * STAGE.bay);
  positionContent();
}

/* ---------- Regia delle transizioni ---------- */

// One owner of the stage. Every request supersedes the previous one: pending
// timers and awaits of older requests return early, animations are retargeted
// from their current values, so nothing queues up or freezes midway.
const director = {
  run: 0,
  timers: new Set(),
  requested: current,
  cancel() {
    // Commit the rendered values before removing a transition. In particular,
    // CSS reversal shortening must not change the selected ground speed.
    if (isJourney()) {
      setCam(currentCam());
      setActor(currentActor());
      void avatar.offsetWidth;
    }
    this.run++;
    cancelAnimationFrame(contentFrame);
    contentFrame = 0;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  },
  wait(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.timers.delete(timer); resolve(); }, Math.max(0, ms));
      this.timers.add(timer);
    });
  },
};

async function stageTo(target, { instant = false, resume = false } = {}) {
  director.cancel();
  const run = director.run;
  const alive = () => run === director.run && isJourney();
  const from = director.requested;
  director.requested = target;
  clearTimeout(stationTimer);
  cancelStation();
  clearRest();
  powerDown();
  setStageContent(target, false);

  if (instant || reduced || document.hidden) { settle(target); return; }

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
    if (SECTIONS[target] !== 'projects') powerUp(target);
    await lift;
  })();

  // 4. Adjacent sections use the walking row; jumps use the running row.
  // Use the previous request so rapid changes immediately select the new gait.
  const gait = resume ? journeyGait : Math.abs(target - from) > 1 ? 'running' : 'walking';
  journeyGait = gait;
  const speed = gait === 'running' ? STAGE.runSpeed : STAGE.walkSpeed;
  const camFrom = currentCam();
  const camTo = restCam(k, target);
  // Ground speed under the feet = bridge motion relative to the character,
  // so the stop offset he covers on screen is part of the synchronised gait.
  const ground = (camTo + restActor(target)) - (camFrom + currentActor());
  const travel = Math.abs(camTo - camFrom) > .5
    ? Math.max(TIMING.minTravel, Math.round(Math.max(Math.abs(ground), Math.abs(camTo - camFrom)) / speed * 1000)) : 0;
  let walk = 0;
  if (travel) {
    setPhase('approaching');
    // Near a reversal the actor can already be at the target world coordinate
    // while the camera still needs to reframe it. Keep that camera move smooth,
    // and synchronise the stride to the actual (possibly zero) ground speed.
    if (Math.abs(ground) > .5) moveAvatar(gait, ground, Math.abs(ground) / travel * 1000);
    else stopAvatar();
    setCam(camTo, travel);
    setActor(restActor(target), travel);
  } else {
    // Same shaft (a quick return): only a short local walk to the stop.
    const offset = restActor(target) - currentActor();
    if (Math.abs(offset) > 2) {
      moveAvatar('walking', offset, STAGE.alignSpeed);
    }
    walk = Math.abs(offset) / STAGE.alignSpeed * 1000;
    setActor(restActor(target), walk);
  }

  followContent();
  // Wait for the journey while both sets are already moving on their lifts.
  if (travel || walk) {
    const motion = (travel ? track : avatar).getAnimations()[0];
    // Wait for the actual CSS endpoint, rather than a wall-clock timer that
    // can precede the last rendered frame. Cancellation releases this await.
    await (motion ? motion.finished.catch(() => {}) : director.wait(travel || walk));
    if (!alive()) return;
  }
  // Commit the exact endpoint before recycling bridge modules.
  setCam(camTo);
  setActor(restActor(target));
  avatar.classList.remove('running', 'walking');
  avatar.style.removeProperty('--cycle-ms');
  setPhase('arriving');
  await Promise.all([rising, ...lowering.values()]);
  if (!alive()) return;

  // Coordinates and lifts are settled before enabling the Projects projection.
  normalize();
  positionContent();
  setStageContent(target, true);
  if (SECTIONS[target] === 'projects') powerUp(target);
  else placeLinks(target);
  arrive();
}

// Stable, complete composition without travel (load, mode switch, reduced motion).
function settle(target) {
  director.requested = target;
  showPage(target);
  bays.forEach(bay => {
    bay.lift.getAnimations().forEach(animation => animation.cancel());
    unmountSet(bay);
  });
  const shift = Math.round(currentCam() / STAGE.bay);
  bays.forEach(bay => {
    let k = bay.k - shift;
    const span = 2 * STAGE.bays + 1;
    while (k < -STAGE.bays) k += span;
    while (k > STAGE.bays) k -= span;
    setBayIndex(bay, k);
    moveLift(bay, STAGE.drop, 0);
  });
  textureOffset += shift * STAGE.bay;
  track.style.setProperty('--texture-x', textureOffset);
  const centre = bayAt(0);
  mountSet(centre, target);
  moveLift(centre, 0, 0);
  setCam(restCam(0, target));
  contentPositions.clear();
  stationBays.clear();
  pages.forEach((page, index) => {
    const k = (index - target) * STATION_BAYS;
    stationBays.set(index, k);
    contentPositions.set(index, restCam(k, index));
  });
  positionContent();
  setActor(restActor(target));
  avatar.classList.remove('running', 'walking');
  setStageContent(target, true);
  powerUp(target, { instant: true });
  arrive();
}

/* ---------- Contenuti scenici, schermi e proiezioni ---------- */

function setStageContent(index, on) {
  // Mechanical state is useful to the director, but never gates semantic text.
  pages[index].dataset.stage = on ? 'on' : 'off';
}

function showPage(index) {
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

const links = Object.fromEntries($$('.scene-link').map(node => [node.dataset.link, node]));
let poweredStation = null;

function powerDown() {
  poweredStation = null;
  stationNodes[2].dataset.power = 'off';
  projectCarousel.power(false);
  Object.values(links).forEach(node => {
    node.style.transitionDelay = '0ms';
    node.classList.remove('on');
  });
}

function powerUp(index, { instant = false } = {}) {
  if (!isJourney()) return;
  poweredStation = index;
  if (SECTIONS[index] === 'projects') {
    stationNodes[2].dataset.power = 'on';
    projectCarousel.power(true);
  }
  placeLinks(index);
  const names = { projects: ['feature'] }[SECTIONS[index]] || [];
  names.forEach(name => {
    links[name].style.transitionDelay = instant || reduced ? '0ms' : `${SECTIONS[index] === 'projects' ? TIMING.activate / 2 : 0}ms`;
    links[name].classList.add('on');
  });
}

// Connectors are measured from the real panels and equipment, so they follow
// both the travelling camera and the rising lift, as well as layout changes.
function placeLinks(index) {
  const id = SECTIONS[index];
  const node = stationNodes[index];
  const box = target => target.getBoundingClientRect();
  if (id === 'projects') {
    // Measure the stable canvas, not the child's power-on transform.
    [['feature', $('.project-carousel')]].forEach(([name, panel]) => {
      const emitter = box($(`[data-emitter="${name}"]`, node));
      const target = box(panel);
      const panelBottom = target.top + target.height * .82;
      const lensY = emitter.top + emitter.height * .22;
      const lensL = emitter.left + emitter.width * .3;
      const lensR = emitter.right - emitter.width * .3;
      // Keep the light cone well inside the HUD (60% of the canvas width).
      const screenL = target.left + target.width * .2;
      const screenR = target.right - target.width * .2;
      const left = Math.min(lensL, screenL);
      const right = Math.max(lensR, screenR);
      const width = right - left;
      const height = Math.max(1, lensY - panelBottom);
      const pct = x => `${((x - left) / width * 100).toFixed(2)}%`;
      Object.assign(links[name].style, {
        left: `${left}px`, top: `${panelBottom}px`, width: `${width}px`, height: `${height}px`,
        clipPath: `polygon(${pct(screenL)} 0, ${pct(screenR)} 0, ${pct(lensR)} 100%, ${pct(lensL)} 100%)`,
      });
    });
  }
}

/* ---------- Viaggio: personaggio e interazioni ---------- */

function placeStations(journey) {
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

function cancelStation() {
  clearTimeout(stationTimer);
  // Exit from the authored pose's foot anchor, even if interrupted mid-sequence.
  if (activeStation !== null && isJourney()) {
    const station = STATIONS[activeStation];
    setActor(station.actorX[interactionFrame] - station.focus);
    avatar.classList.toggle('back', station.id === 'about');
  }
  stationNodes.forEach(node => node.classList.remove('interaction-active'));
  avatar.classList.remove('station-owned');
  activeStation = null;
}

function moveAvatar(gait, direction, speed) {
  avatar.classList.remove('walking', 'running');
  avatar.classList.add(gait);
  avatar.classList.toggle('back', direction < 0);
  const stride = gait === 'running' ? STAGE.runStride : STAGE.walkStride;
  avatar.style.setProperty('--cycle-ms', `${Math.round(stride / speed * 1000)}ms`);
}

function stopAvatar() {
  avatar.classList.remove('walking', 'running');
  avatar.style.removeProperty('--cycle-ms');
  clearRest();
}

function arrive() {
  stopAvatar();
  if (!isJourney()) return;
  const station = STATIONS[current];
  if (!station.frames) {
    avatar.classList.remove('back');
    setPhase('waiting');
    if (current === 0) scheduleRest();
    scheduleRadio();
    return;
  }
  // Orient before replacing the walking pair with the actor layer.
  avatar.classList.toggle('back', station.id === 'about');
  setPhase('aligning');
  if (reduced || document.hidden) startInteraction(true);
  else stationTimer = setTimeout(() => startInteraction(false), ALIGN_MS);
}

function startInteraction(staticPose) {
  activeStation = current;
  const station = STATIONS[current];
  interactionFrame = staticPose ? station.staticFrame : 0;
  const node = stationNodes[current];
  node.style.setProperty('--frame', interactionFrame);
  node.classList.add('interaction-active');
  avatar.classList.add('station-owned');
  setPhase(staticPose ? 'waiting' : 'interacting');
  scheduleRadio();
  if (!staticPose) stationTimer = setTimeout(advanceInteraction, FRAME_MS);
}

function advanceInteraction() {
  if (activeStation === null || reduced || document.hidden || !isJourney()) return;
  const station = STATIONS[activeStation];
  if (interactionFrame === station.frames - 1) {
    setPhase('waiting');
    if (!station.loop) { scheduleRadio(); return; } // Setup and stand-up play once.
  }
  interactionFrame = (interactionFrame + 1) % station.frames;
  stationNodes[activeStation].style.setProperty('--frame', interactionFrame);
  stationTimer = setTimeout(advanceInteraction, FRAME_MS);
}

function clearRest() {
  clearTimeout(restTimer);
  $$('.avatar').forEach(node => node.classList.remove('petting'));
}

function scheduleRest() {
  clearRest();
  if (reduced || document.hidden || (isJourney() && (current !== 0 || phase !== 'waiting'))) return;
  restTimer = setTimeout(() => {
    const restingAvatar = isJourney() ? avatar : $('.bridge .avatar');
    restingAvatar.classList.add('petting');
    restTimer = setTimeout(scheduleRest, PET_MS);
  }, REST_MS);
}

document.addEventListener('visibilitychange', () => {
  clearRest();
  clearTimeout(stationTimer);
  if (document.hidden) {
    // Never leave a transfer or a lift halfway in a hidden document.
    if (isJourney() && !['waiting', 'interacting', 'aligning'].includes(phase)) {
      director.cancel();
      settle(current);
    }
  } else if (activeStation !== null) {
    const station = STATIONS[activeStation];
    if (!reduced && (station.loop || interactionFrame < station.frames - 1)) {
      stationTimer = setTimeout(advanceInteraction, FRAME_MS);
    }
  } else if (isJourney() && phase === 'aligning') arrive();
  else scheduleRest();
  scheduleRadio();
});

let resizeFrame;
window.addEventListener('resize', () => {
  const cam = renderedCam;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!isJourney()) return;
    if (['waiting', 'interacting', 'aligning'].includes(phase)) {
      // Pixel values depend on the scene unit: re-apply them, keep the pose.
      bays.forEach(bay => moveLift(bay, bay.level, 0));
      positionContent();
      placeLinks(current);
    } else {
      // A scale/layout change reflows the world around its last rendered camera,
      // then resumes the same request. Never jump to the destination on resize.
      setCam(cam);
      positionContent();
      stageTo(current, { resume: true });
    }
  });
});

function show(index, { instant = false } = {}) {
  index = Math.max(0, Math.min(SECTIONS.length - 1, index));
  current = index;

  showPage(index);
  setActiveNav(index);
  stageTo(index, { instant });

  $('#counter').textContent = `${pad(index + 1)} / ${pad(SECTIONS.length)}`;
  $('#prev').disabled = index === 0;
  $('#next').disabled = index === SECTIONS.length - 1;
  const name = SECTIONS[index];
  document.title = `${name[0].toUpperCase() + name.slice(1)} — Francesco Spina`;
}

function go(index) {
  if (index >= 0 && index < SECTIONS.length && index !== current) location.hash = SECTIONS[index];
}

window.addEventListener('hashchange', () => {
  if (!isJourney()) return;
  const index = SECTIONS.indexOf(location.hash.slice(1));
  show(index < 0 ? 0 : index);
  $('h1, h2', pages[current]).focus({ preventScroll: true });
});

$('#prev').addEventListener('click', () => go(current - 1));
$('#next').addEventListener('click', () => go(current + 1));

window.addEventListener('keydown', e => {
  if (!isJourney() || dialog.open || e.defaultPrevented || e.target.closest('.project-carousel, button, input, textarea, select, [role="tab"]')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
});

// La rotella cambia tappa solo quando il contenuto corrente è già a fine corsa.
let wheelAmount = 0;
let lastWheel = 0;
window.addEventListener('wheel', e => {
  if (!isJourney() || dialog.open || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const direction = Math.sign(e.deltaY);
  const scroller = e.target.closest?.('.page, .scroll-area');
  if (scroller && pages[current].contains(scroller)) {
    const canScrollDown = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 3;
    const canScrollUp = scroller.scrollTop > 3;
    if ((direction > 0 && canScrollDown) || (direction < 0 && canScrollUp)) return;
  }

  e.preventDefault();
  const now = Date.now();
  if (now - lastWheel < WHEEL_COOLDOWN_MS) return;
  if (Math.sign(wheelAmount) !== direction) wheelAmount = 0;
  wheelAmount += e.deltaY;
  if (Math.abs(wheelAmount) > 85) {
    go(current + direction);
    lastWheel = now;
    wheelAmount = 0;
  }
}, { passive: false });

let touchX, touchY;
$('main').addEventListener('touchstart', e => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
}, { passive: true });
$('main').addEventListener('touchend', e => {
  if (!isJourney() || dialog.open || e.target.closest('.projects-grid, .project-carousel')) return;
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
}, { passive: true });

/* ---------- Viste: progetto in evidenza (solo Viaggio) ---------- */

const projectCarousel = new ProjectCarousel({
  canNavigate: () => isJourney() && current === 2 && phase === 'waiting'
    && poweredStation === 2 && !dialog.open && !document.hidden,
  reduced: () => reduced,
  onChange: () => placeLinks(2),
});

function setViews(journey) {
  projectCarousel.mode(journey);
}

/* ---------- Lettura: sezione attiva e progresso ---------- */

const sectionObserver = new IntersectionObserver(entries => {
  if (isJourney()) return;
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    current = pages.indexOf(entry.target);
    setActiveNav(current);
  });
}, { rootMargin: '-40% 0px -55% 0px' });
pages.forEach(page => sectionObserver.observe(page));

let progressFrame;
function updateReadProgress() {
  if (isJourney()) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
  root.style.setProperty('--progress', progress);
  // Lo sfondo scorre lentamente insieme alla pagina, come in Viaggio
  if (!reduced) root.style.setProperty('--step', progress * (SECTIONS.length - 1));
}
window.addEventListener('scroll', () => {
  cancelAnimationFrame(progressFrame);
  progressFrame = requestAnimationFrame(updateReadProgress);
}, { passive: true });

/* ---------- Movimento ridotto ---------- */

function setReduced(value) {
  reduced = value;
  projectCarousel.cancel();
  document.body.classList.toggle('reduced', value);
  const button = $('#motion');
  button.setAttribute('aria-pressed', String(value));
  button.title = value ? 'Riattiva movimento' : 'Riduci movimento';
  if (isJourney() && bays.length) {
    if (value) { director.cancel(); cancelStation(); settle(current); }
    else if (activeStation !== null && STATIONS[activeStation].loop) {
      clearTimeout(stationTimer);
      stationTimer = setTimeout(advanceInteraction, FRAME_MS);
    } else scheduleRest();
  } else scheduleRest();
  scheduleRadio();
}
$('#motion').addEventListener('click', () => setReduced(!reduced));
reduceQuery.addEventListener('change', e => setReduced(e.matches));

/* ---------- Dialog e interazioni ---------- */

function openDetail(...nodes) {
  $('#detail-content').replaceChildren(...nodes);
  dialog.showModal();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// In Viaggio il caso di studio si apre nel dialog;
// in Lettura il <details> si espande sul posto.
grid.addEventListener('click', e => {
  const project = e.target.closest('.project');
  if (!isJourney() || !project || e.target.closest('a')) return;
  // Desktop: only the explicit command opens it; the projection is for reading.
  if (!e.target.closest('summary') && matchMedia('(min-width: 761px)').matches) return;
  e.preventDefault();
  const title = el('h2', '', $('h3', project).textContent);
  title.id = 'detail-title';
  openDetail(
    el('p', 'eyebrow', 'Caso di studio'),
    title,
    $('.project-media', project).cloneNode(true),
    $('.summary', project).cloneNode(true),
    $('.stack', project).cloneNode(true),
    ...[...$('.case-body', project).children].map(node => node.cloneNode(true)),
  );
});

$('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
});


$('#year').textContent = new Date().getFullYear();

/* ---------- Avvio ---------- */

buildBays();
setReduced(reduced);
setMode(isJourney() ? 'journey' : 'read');
