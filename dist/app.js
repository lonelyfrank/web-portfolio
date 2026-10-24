// Francesco Spina — Space Journey
// Due modalità: "read" (pagina che scorre, default su mobile e senza JS)
// e "journey" (tappe a schermo intero, l'omino cammina lungo la strada).

const SECTIONS = ['home', 'about', 'projects', 'contact'];
// Local coordinates use the exported 144 × 136 canvas (floor y=132).
// Footprints and controls are explicit: never infer them from frame alpha bounds.
const STATIONS = [
  { id: 'home', at: 20, floor: 132, stop: [72, 132], equipment: null, companion: [28, 112, 92, 20], hands: null },
  { id: 'about', at: 39, floor: 132, stop: [91, 132], equipment: [68, 129], companion: [36, 108, 96, 24], hands: [68, 82], frames: 8, loop: true, staticFrame: 0, actorX: [91, 91, 91, 91, 91, 91, 91, 91] },
  { id: 'projects', at: 60, floor: 132, stop: [48, 132], equipment: [104, 132], companion: [8, 112, 64, 20], hands: null },
  { id: 'contact', at: 79, floor: 132, stop: [61, 132], equipment: [111, 131], companion: [8, 98, 80, 34], hands: [87, 111], controls: { panel: [87, 111], tuner: [123, 103] }, frames: 8, loop: false, staticFrame: 7, actorX: [61, 64, 62, 99, 98, 59, 60, 60] },
];
const STOPS = STATIONS.map(station => station.at);
const MODE_KEY = 'fs-mode';
const WALK_MS = 1050;
const RUN_SPEED = 1.8; // velocità relativa alla camminata per salti di più tappe
const REST_MS = 6400; // due giri della gatta prima della carezza
const PET_MS = 3200;
const WHEEL_COOLDOWN_MS = 800;

const SKILLS = {
  'HTML / CSS': 'Struttura, layout e interfacce responsive: parte della formazione full stack.',
  'JavaScript': 'Interazioni e logica frontend nel percorso di sviluppo web.',
  'Vue': 'Framework frontend affrontato durante la formazione Boolean.',
  'PHP / Laravel': 'Sviluppo backend nel percorso di formazione full stack.',
  'AEM': 'Gestione di contenuti web nell’esperienza in agenzia.',
  'WordPress': 'Gestione di siti e contenuti digitali nell’esperienza lavorativa.',
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const root = document.documentElement;
const pages = $$('.page');
const navLinks = $$('.site-nav a');
const avatar = $('#avatar');
const world = $('.journey-world');
const stationNodes = STATIONS.map(station => $(`[data-station="${station.id}"]`));
const dialog = $('#detail');
const grid = $('#projects-grid');
const journeyQuery = matchMedia('(min-width: 900px) and (min-height: 640px)');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

let current = Math.max(0, SECTIONS.indexOf(location.hash.slice(1)));
let reduced = reduceQuery.matches;
let walkTimer;
let restTimer;
let stationTimer;
let activeStation = null;
let interactionFrame = 0;
let phase = 'waiting';
let travel = null;
const FRAME_MS = 400;
const ALIGN_MS = 100;
const RADIO_MIN_MS = 30000;
const RADIO_MAX_MS = 45000;
const RADIO_FRAME_MS = 250;
const RADIO_SCAN = [1, 2, 3, 4, 5, 6, 7, 0, 1];
let radioTimer;
const radio = $('.station-contact .station-equipment');

function radioAvailable() {
  return !reduced && !document.hidden && !(isJourney() && current === 3 &&
    ['approaching', 'aligning', 'interacting'].includes(phase));
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
  cancelStation();
  root.classList.toggle('journey', journey);
  placeStations(journey);
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

  if (journey) {
    show(current, { instant: true });
    // il salto all'ancora del caricamento può aver spostato il documento
    window.scrollTo(0, 0);
  } else {
    stopAvatar();
    scheduleRest();
    pages.forEach(page => { page.hidden = false; page.classList.remove('active'); });
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

/* ---------- Viaggio: tappe e omino ---------- */

function setPhase(next) {
  phase = next;
  world.dataset.phase = next;
}

function unit() { return avatar.offsetWidth / 128; }
function stopX(index) {
  const station = STATIONS[index];
  return world.clientWidth * station.at / 100 + (station.stop[0] - 72) * unit();
}

function placeStations(journey) {
  stationNodes.forEach((node, index) => {
    node.classList.remove('interaction-active');
    node.style.setProperty('--frame', STATIONS[index].staticFrame || 0);
    // Move the same node; no duplicate radio, desk, Frank or cat in hidden tabs.
    if (journey || !STATIONS[index].frames) world.insertBefore(node, avatar);
    else {
      pages[index].append(node);
      node.classList.add('interaction-active');
    }
  });
  layoutRoute(true);
}

function layoutRoute(instant = false) {
  const scale = unit();
  const width = world.clientWidth;
  const viewport = $('.journey-strip').clientWidth;
  // Small screens pan over the same world, without scaling actors separately.
  const camera = Math.min(0, Math.max(viewport - width, viewport / 2 - stopX(current)));
  world.style.transition = instant || reduced ? 'none' : '';
  world.style.setProperty('--camera-x', `${camera}px`);
  const rails = $('.route-rails');
  let start = 0;
  rails.replaceChildren();
  [...STATIONS, { at: 100 + 92 * scale / width * 100 }].forEach(station => {
    const end = Math.min(width, width * station.at / 100 - 92 * scale);
    if (end > start) {
      const segment = document.createElement('div');
      segment.className = 'route-rail';
      segment.style.left = `${start}px`;
      segment.style.width = `${end - start}px`;
      rails.append(segment);
    }
    start = width * station.at / 100 + 92 * scale;
  });
}

function cancelStation() {
  clearTimeout(stationTimer);
  // Exit from the authored pose's foot anchor, even if interrupted mid-sequence.
  if (activeStation !== null && isJourney()) {
    const station = STATIONS[activeStation];
    avatar.style.transition = 'none';
    avatar.style.left = `${world.clientWidth * station.at / 100 + (station.actorX[interactionFrame] - 72) * unit()}px`;
    avatar.classList.toggle('back', station.id === 'about');
  }
  stationNodes.forEach(node => node.classList.remove('interaction-active'));
  avatar.classList.remove('station-owned');
  activeStation = null;
}

function stopAvatar() {
  clearTimeout(walkTimer);
  travel = null;
  avatar.classList.remove('walking', 'running');
  clearRest();
}

function moveAvatar(index, previous, instant) {
  cancelStation();
  // Freeze the interpolated position before retargeting rapid tab changes.
  const from = parseFloat(getComputedStyle(avatar).left) || stopX(previous);
  stopAvatar();
  setPhase('exiting');
  avatar.style.transition = 'none';
  avatar.style.left = `${from}px`;
  void avatar.offsetWidth;
  const target = stopX(index);
  const distance = Math.abs(target - from);
  const running = Math.abs(index - previous) > 1;
  const spacing = world.clientWidth * .2;
  const duration = Math.max(120, Math.round(WALK_MS * distance / spacing / (running ? RUN_SPEED : 1)));
  avatar.style.setProperty('--travel-ms', `${duration}ms`);
  world.style.setProperty('--travel-ms', `${duration}ms`);
  avatar.classList.toggle('back', target < from);
  avatar.style.transition = instant || reduced ? 'none' : '';
  avatar.style.left = `${target}px`;
  layoutRoute(instant);
  if (!instant && !reduced && distance > 1) {
    setPhase('approaching');
    avatar.classList.add(running ? 'running' : 'walking');
    travel = { index, previous };
    walkTimer = setTimeout(arrive, duration);
  } else arrive();
  scheduleRadio();
}

function arrive() {
  stopAvatar();
  if (!isJourney()) return;
  const station = STATIONS[current];
  avatar.style.left = `${stopX(current)}px`;
  if (!station.frames) {
    setPhase('waiting');
    if (current === 0) scheduleRest();
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
    // Never let a delayed arrival start an interaction in a hidden document.
    if (travel) { avatar.style.transition = 'none'; avatar.style.left = `${stopX(current)}px`; arrive(); }
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
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!isJourney()) return;
    layoutRoute(true);
    if (travel) moveAvatar(current, travel.previous, false);
    else { avatar.style.transition = 'none'; avatar.style.left = `${stopX(current)}px`; }
  });
});

function show(index, { instant = false } = {}) {
  index = Math.max(0, Math.min(SECTIONS.length - 1, index));
  const previous = current;
  current = index;

  root.style.setProperty('--step', index);
  root.style.setProperty('--origin-x', `${STOPS[index]}%`);
  pages.forEach((page, i) => {
    page.hidden = i !== index;
    page.classList.toggle('active', i === index);
  });
  setActiveNav(index);
  moveAvatar(index, previous, instant);

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
  if (!isJourney() || dialog.open || e.target.closest('button, input, textarea, select')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
});

// La rotella cambia tappa solo quando la pagina corrente è già a fine corsa.
let wheelAmount = 0;
let lastWheel = 0;
window.addEventListener('wheel', e => {
  if (!isJourney() || dialog.open || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  const page = pages[current];
  const direction = Math.sign(e.deltaY);
  const canScrollDown = page.scrollTop + page.clientHeight < page.scrollHeight - 3;
  const canScrollUp = page.scrollTop > 3;
  if ((direction > 0 && canScrollDown) || (direction < 0 && canScrollUp)) return;

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
  if (!isJourney() || dialog.open || e.target.closest('.projects-grid')) return;
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current + (dx < 0 ? 1 : -1));
}, { passive: true });

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
  document.body.classList.toggle('reduced', value);
  const button = $('#motion');
  button.setAttribute('aria-pressed', String(value));
  button.title = value ? 'Riattiva movimento' : 'Riduci movimento';
  if (isJourney()) {
    if (value) moveAvatar(current, current, true);
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

// In Viaggio la scheda progetto apre il caso di studio nel dialog;
// in Lettura il <details> si espande sul posto.
grid.addEventListener('click', e => {
  const project = e.target.closest('.project');
  if (!isJourney() || !project || e.target.closest('a')) return;
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

$$('[data-placeholder]').forEach(button => {
  button.addEventListener('click', () => {
    const title = el('h2', '', button.dataset.placeholder);
    title.id = 'detail-title';
    openDetail(
      el('p', 'eyebrow', 'Prototipo visivo'),
      title,
      el('p', '', 'Questo collegamento sarà configurato con i dati professionali verificati prima della pubblicazione del portfolio definitivo.'),
    );
  });
});

$('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
});

$$('[data-skill]').forEach(button => {
  button.addEventListener('click', () => {
    $$('[data-skill]').forEach(b => b.classList.toggle('selected', b === button));
    $('#skill-info').textContent = SKILLS[button.dataset.skill];
    $('#workbench-skill').textContent = button.dataset.skill;
  });
});

$('#project-prev').addEventListener('click', () => grid.scrollBy({ left: -grid.clientWidth * .9, behavior: reduced ? 'instant' : 'smooth' }));
$('#project-next').addEventListener('click', () => grid.scrollBy({ left: grid.clientWidth * .9, behavior: reduced ? 'instant' : 'smooth' }));

$('#year').textContent = new Date().getFullYear();

/* ---------- Avvio ---------- */

setReduced(reduced);
setMode(isJourney() ? 'journey' : 'read');
