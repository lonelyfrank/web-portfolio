// Caso di studio: in Viaggio si apre nel dialog; in Lettura il <details>
// si espande sul posto.
import { $, dialog, el } from './dom.js';
import { isJourney } from './state.js';

const grid = $('#projects-grid');
const content = $('#detail-content');

function openDetail(...nodes) {
  content.replaceChildren(...nodes);
  dialog.showModal();
}

export function initDetail() {
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

  $('.close', dialog).addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
}
