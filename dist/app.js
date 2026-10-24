// Francesco Spina — Space Journey
// Due modalità: "read" (pagina che scorre, default su mobile e senza JS)
// e "journey" (tappe a schermo intero, l'omino cammina lungo la strada).

const SECTIONS = ['home', 'about', 'projects', 'contact'];
const STOPS = [20, 39, 60, 79]; // posizione dell'omino sulla strada per ogni tappa, in %
const MODE_KEY = 'fs-mode';
const WALK_MS = 1050;
const RUN_SPEED = 1.8; // velocità relativa alla camminata per salti di più tappe
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
const dialog = $('#detail');
const grid = $('#projects-grid');
const journeyQuery = matchMedia('(min-width: 900px) and (min-height: 640px)');
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');

let current = Math.max(0, SECTIONS.indexOf(location.hash.slice(1)));
let reduced = reduceQuery.matches;
let walkTimer;

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
  root.classList.toggle('journey', journey);
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));

  if (journey) {
    show(current, { instant: true });
    // il salto all'ancora del caricamento può aver spostato il documento
    window.scrollTo(0, 0);
  } else {
    stopAvatar();
    pages.forEach(page => { page.hidden = false; page.classList.remove('active'); });
    root.style.setProperty('--step', 0);
    document.title = 'Francesco Spina — Space Journey';
    setActiveNav(current);
    if (save) pages[current].scrollIntoView({ block: 'start', behavior: 'instant' });
    updateReadProgress();
  }
}

$$('[data-mode]').forEach(button => {
  button.addEventListener('click', () => setMode(button.dataset.mode, { save: true }));
});

journeyQuery.addEventListener('change', e => {
  if (!savedMode()) setMode(e.matches ? 'journey' : 'read');
});

/* ---------- Viaggio: tappe e omino ---------- */

function moveAvatar(index, previous, instant) {
  const distance = Math.abs(index - previous);
  const running = distance > 1;
  const duration = running ? Math.round(WALK_MS * distance / RUN_SPEED) : WALK_MS;
  avatar.style.setProperty('--travel-ms', `${duration}ms`);
  avatar.style.transition = instant || reduced ? 'none' : '';
  avatar.style.left = `${STOPS[index]}%`;
  if (index !== previous) avatar.classList.toggle('back', index < previous);

  stopAvatar();
  if (!instant && !reduced && distance > 0) {
    avatar.classList.add(running ? 'running' : 'walking');
    walkTimer = setTimeout(stopAvatar, duration);
  }
}

function stopAvatar() {
  clearTimeout(walkTimer);
  avatar.classList.remove('walking', 'running');
}

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
  if (value) stopAvatar();
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
  });
});

$('#project-prev').addEventListener('click', () => grid.scrollBy({ left: -grid.clientWidth * .9, behavior: reduced ? 'instant' : 'smooth' }));
$('#project-next').addEventListener('click', () => grid.scrollBy({ left: grid.clientWidth * .9, behavior: reduced ? 'instant' : 'smooth' }));

$('#year').textContent = new Date().getFullYear();

/* ---------- Avvio ---------- */

setReduced(reduced);
setMode(isJourney() ? 'journey' : 'read');
