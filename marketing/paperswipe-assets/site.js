(() => {
  'use strict';
  const root = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Feedback follows deliberate activation, including keyboard clicks.
  const presses = new WeakMap();
  document.addEventListener('click', event => {
    const control = event.target.closest('button, a, summary');
    if (!control || reducedMotion.matches || !control.animate) return;
    presses.get(control)?.cancel();
    const animation = control.animate([
      {scale:'1'}, {scale:'.96',offset:.35}, {scale:'1'}
    ], {duration:300,easing:'cubic-bezier(.2,.7,.2,1)'});
    presses.set(control,animation);
    animation.onfinish = () => presses.delete(control);
  });

  // Keep native details semantics; animate both directions and support reversal.
  const accordions = [...document.querySelectorAll('.faq-list details')].map(details => {
    const state = {details, target:details.open, animation:null};
    state.settle = () => {
      state.animation?.cancel(); state.animation = null;
      details.open = state.target;
      details.style.height = ''; details.style.overflow = '';
      details.removeAttribute('data-expanding');
    };
    details.querySelector('summary').addEventListener('click', event => {
      if (reducedMotion.matches || !details.animate) return;
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      state.target = state.animation ? !state.target : !details.open;
      state.animation?.cancel();
      details.open = true;
      details.style.height = '';
      const end = state.target ? details.getBoundingClientRect().height : details.querySelector('summary').getBoundingClientRect().height + 1;
      details.dataset.expanding = String(state.target);
      details.style.overflow = 'hidden';
      state.animation = details.animate([{height:start+'px'},{height:end+'px'}], {
        duration:280,easing:'cubic-bezier(.2,.7,.2,1)'
      });
      state.animation.onfinish = state.settle;
    });
    return state;
  });
  window.addEventListener('resize', () => accordions.forEach(state => {
    if (state.animation) state.settle();
  }));
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      accordions.forEach(state => { if (state.animation) state.settle(); });
      document.getAnimations().forEach(animation => animation.finish());
    }
  });
  const themeButton = document.querySelector('#theme-toggle');
  function applyTheme(theme) {
    root.dataset.theme = theme;
    themeButton.textContent = theme === 'light' ? '深色' : '浅色';
    themeButton.setAttribute('aria-label', theme === 'light' ? '切换到深色模式' : '切换到浅色模式');
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f8f8fc' : '#171720';
  }
  // Match the product's light default. Storage may be unavailable for local files.
  try { applyTheme(localStorage.getItem('paperswipe-marketing-theme') === 'dark' ? 'dark' : 'light'); } catch (_) { applyTheme('light'); }
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(theme);
    try { localStorage.setItem('paperswipe-marketing-theme', theme); } catch (_) { /* Local-file preview remains usable. */ }
  });

  const tabs = [...document.querySelectorAll('[data-preview]')];
  const preview = document.querySelector('#preview-image');
  const caption = document.querySelector('#preview-caption');
  let revision = 0;
  function selectTab(tab) {
    const current = ++revision;
    tabs.forEach(item => { const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; });
    document.querySelector('#explore-preview').setAttribute('aria-labelledby', tab.id);
    const next = new Image();
    next.onload = () => {
      if (current !== revision) return;
      preview.src = next.src; preview.alt = tab.dataset.caption; caption.textContent = tab.dataset.caption;
      preview.classList.remove('is-changing'); void preview.offsetWidth; preview.classList.add('is-changing');
    };
    next.onerror = () => { if (current === revision) caption.textContent = '图片未能加载，请确认 paperswipe-assets 文件夹完整。'; };
    next.src = 'paperswipe-assets/' + tab.dataset.preview;
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') index = (i + 1) % tabs.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') index = (i + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = tabs.length - 1;
      if (index === undefined) return;
      event.preventDefault(); tabs[index].focus(); selectTab(tabs[index]);
    });
  });

  const dialog = document.querySelector('#demo-dialog');
  const video = document.querySelector('#demo-video');
  let opener;
  let dialogMotion;
  let closing = false;
  function closeDemo() {
    if (closing || !dialog.open) return;
    video.pause();
    dialogMotion?.cancel();
    if (reducedMotion.matches || !dialog.animate) { dialog.close(); return; }
    closing = true;
    dialogMotion = dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(10px) scale(.98)'}], {duration:160,easing:'ease-in'});
    dialogMotion.onfinish = () => { dialog.close(); closing = false; };
  }
  document.querySelectorAll('[data-watch]').forEach(button => button.addEventListener('click', () => {
    opener = button;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else { window.open(video.querySelector('source').src, '_blank', 'noopener'); return; }
    document.body.style.overflow = 'hidden';
    if (!reducedMotion.matches) {
      dialogMotion?.cancel();
      dialogMotion = dialog.animate([{opacity:0,transform:'translateY(18px) scale(.97)'},{opacity:1,transform:'translateY(0) scale(1)'}], {duration:320,easing:'cubic-bezier(.2,.7,.2,1)'});
      video.play().catch(() => {});
    }
  }));
  document.querySelector('.dialog-close').addEventListener('click', closeDemo);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDemo(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDemo();
  });
  dialog.addEventListener('close', () => { video.pause(); document.body.style.overflow = ''; opener?.focus({preventScroll:true}); });
  video.addEventListener('error', () => { document.querySelector('#video-error').hidden = false; });

  if ('IntersectionObserver' in window) {
    root.classList.add('js-reveal');
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); }
    }), {threshold:.08});
    document.querySelectorAll('[data-reveal]').forEach(element => reveal.observe(element));
    const links = [...document.querySelectorAll('.nav-links a')];
    const sections = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) links.forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current','true'); else link.removeAttribute('aria-current');
      });
    }), {rootMargin:'-15% 0px -50% 0px'});
    links.forEach(link => { const section = document.querySelector(link.hash); if (section) sections.observe(section); });
  }
})();
