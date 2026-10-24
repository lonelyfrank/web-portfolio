// Float only visible artwork; links and labels remain stationary.
(() => {
  const section = document.querySelector('#contact');
  const visuals = [...section.querySelectorAll('.contact-visual')];
  const visible = new Set();
  const sync = () => visuals.forEach(node => {
    node.classList.toggle('is-floating', visible.has(node) && !document.hidden && !section.hidden && !section.inert);
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) visible.add(target);
      else visible.delete(target);
    });
    sync();
  });
  visuals.forEach(node => observer.observe(node));
  // Inactive journey pages remain visible while their station crosses the viewport.
  new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  document.addEventListener('visibilitychange', sync);
})();
