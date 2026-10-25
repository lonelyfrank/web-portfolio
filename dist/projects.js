// The generated semantic catalogue is the presentation model in both modes.
// Selection and transition state live here; the Journey director owns travel.
class ProjectCarousel {
  constructor({ canNavigate, reduced, onChange }) {
    this.canNavigate = canNavigate;
    this.reduced = reduced;
    this.onChange = onChange;
    this.root = document.querySelector('.project-carousel');
    this.section = document.querySelector('#projects');
    this.information = document.querySelector('#projects-grid');
    this.powered = false;
    this.projection = this.root.querySelector('.holo-projection');
    this.card = this.root.querySelector('.holo-card');
    this.image = this.root.querySelector('#project-image');
    this.items = [...document.querySelectorAll('#projects-grid .project')].map(panel => ({
      panel, image: panel.querySelector('.project-media img'), title: panel.querySelector('h3').textContent,
    }));
    this.activeProjectIndex = 0;
    this.generation = 0;
    this.busy = false;
    this.buttons = [...this.root.querySelectorAll('button')];
    this.buttons.forEach((button, i) => button.addEventListener('click', () => this.move(i ? 1 : -1)));
    this.root.addEventListener('keydown', event => {
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();
      this.move(direction);
    });
    document.addEventListener('visibilitychange', () => {
      this.root.classList.toggle('paused', document.hidden);
      if (document.hidden) this.cancel();
    });
    this.render();
  }

  render(announce = false) {
    const item = this.items[this.activeProjectIndex];
    this.items.forEach(({ panel }, i) => { panel.hidden = this.journey && i !== this.activeProjectIndex; });
    this.image.src = item.image.getAttribute('src');
    this.image.alt = item.image.alt;
    this.root.dataset.project = item.panel.id;
    if (announce) this.root.querySelector('#project-status').textContent = `${this.activeProjectIndex + 1} di ${this.items.length}: ${item.title}`;
  }

  controls() {
    const unavailable = this.busy || !this.canNavigate();
    this.buttons.forEach(button => button.setAttribute('aria-disabled', String(unavailable)));
  }

  cancel() {
    this.generation++;
    this.animation?.cancel();
    this.busy = false;
    this.root.removeAttribute('aria-busy');
    this.controls();
  }

  mode(journey) {
    this.cancel();
    this.journey = journey;
    this.syncPower();
    this.render();
  }

  power(on) {
    if (!on) this.cancel();
    this.powered = on;
    this.projection.dataset.power = on ? 'on' : 'off';
    this.section.dataset.projectPower = on ? 'on' : 'off';
    this.syncPower();
    this.controls();
  }

  syncPower() {
    // The left introduction stays visible; only the projection and its details
    // belong to the powered station. Reading keeps the full catalogue usable.
    this.root.inert = this.journey && !this.powered;
    this.information.inert = this.journey && !this.powered;
  }

  async animate(frames, duration) {
    this.animation = this.card.animate(frames, { duration, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    await this.animation.finished;
    this.animation.cancel();
  }

  async move(direction) {
    if (this.busy || !this.canNavigate()) return;
    this.busy = true;
    this.controls();
    this.root.setAttribute('aria-busy', 'true');
    const generation = ++this.generation;
    const next = (this.activeProjectIndex + direction + this.items.length) % this.items.length;
    try {
      // Decode just the requested asset before dimming the current projection.
      const asset = new Image();
      asset.src = this.items[next].image.getAttribute('src');
      await asset.decode();
      if (generation !== this.generation || !this.canNavigate()) return;
      if (!this.reduced()) await this.animate([
        { transform: 'translateX(0)', opacity: 1 },
        { transform: `translateX(${-direction * 14}px)`, opacity: .24 },
      ], 150);
      if (generation !== this.generation || !this.canNavigate()) return;
      this.activeProjectIndex = next;
      this.render(true);
      this.onChange();
      if (!this.reduced()) await this.animate([
        { transform: `translateX(${direction * 14}px)`, opacity: .24 },
        { transform: 'translateX(0)', opacity: 1 },
      ], 190);
    } catch (error) {
      // Cancellation is expected on departure, mode changes and reduced motion.
      if (generation === this.generation && error.name !== 'AbortError') {
        this.root.querySelector('#project-status').textContent = 'Immagine non disponibile. Riprova a cambiare progetto.';
      }
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        this.root.removeAttribute('aria-busy');
        this.controls();
      }
    }
  }
}
