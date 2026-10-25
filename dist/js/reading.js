// Modalità Lettura: sezione attiva e avanzamento dello scorrimento.
import { SECTIONS } from './config.js';
import { pages, root } from './dom.js';
import { isJourney, state } from './state.js';
import { setActiveNav } from './navigation.js';

export function updateReadProgress() {
  if (isJourney()) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
  root.style.setProperty('--progress', progress);
  // Lo sfondo scorre lentamente insieme alla pagina, come in Viaggio
  if (!state.reduced) root.style.setProperty('--step', progress * (SECTIONS.length - 1));
}

export function initReading() {
  const sectionObserver = new IntersectionObserver(entries => {
    if (isJourney()) return;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      state.current = pages.indexOf(entry.target);
      setActiveNav(state.current);
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  pages.forEach(page => sectionObserver.observe(page));

  let progressFrame;
  window.addEventListener('scroll', () => {
    cancelAnimationFrame(progressFrame);
    progressFrame = requestAnimationFrame(updateReadProgress);
  }, { passive: true });
}
