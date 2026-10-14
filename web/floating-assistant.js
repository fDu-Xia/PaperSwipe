/* Movable assistant: pointer capture keeps touch drags out of page scrolling. */
(() => {
  const button = document.querySelector('#ai-bot-button');
  if (!button) return;
  const parent = button.parentElement;
  let drag, position, restored = false, suppressClick = false;
  const key = () => 'paperswipe-assistant-position-v1' + (window.PAPERSWIPE_USER || '');
  const limits = () => ({x:Math.max(12,parent.clientWidth - 64), y:Math.max(64,parent.clientHeight - 150)});
  function place(x,y) {
    const bounds = limits();
    x = Math.max(12,Math.min(bounds.x,x)); y = Math.max(64,Math.min(bounds.y,y));
    button.style.left = x + 'px'; button.style.top = y + 'px';
    button.style.right = 'auto'; button.style.bottom = 'auto';
    position = {x:(x - 12)/Math.max(1,bounds.x - 12), y:(y - 64)/Math.max(1,bounds.y - 64)};
  }
  function save() { try { localStorage.setItem(key(),JSON.stringify(position)); } catch (_) {} }
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    const box = button.getBoundingClientRect(), container = parent.getBoundingClientRect();
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, left:box.left-container.left, top:box.top-container.top, moved:false};
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<8) return;
    drag.moved = true; button.classList.add('is-dragging');
    place(drag.left+dx,drag.top+dy);
  });
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    if (drag.moved) save();
    drag = null; button.classList.remove('is-dragging');
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  }
  button.addEventListener('pointerup',finish);
  button.addEventListener('pointercancel',finish);
  button.addEventListener('lostpointercapture',finish);
  button.addEventListener('click',event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); }
    suppressClick = false;
  },true);
  button.addEventListener('keydown',event => {
    const moves = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if (!moves[event.key]) return;
    event.preventDefault();
    place(button.offsetLeft + moves[event.key][0],button.offsetTop + moves[event.key][1]); save();
  });
  new ResizeObserver(() => {
    if (!parent.clientWidth || !parent.clientHeight) return;
    if (!restored) {
      restored = true;
      try { const stored = JSON.parse(localStorage.getItem(key())); if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) position = stored; } catch (_) {}
    }
    if (position) { const bounds = limits(); place(12+position.x*(bounds.x-12),64+position.y*(bounds.y-64)); }
  }).observe(parent);
})();
