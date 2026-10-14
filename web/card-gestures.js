// Pointer lifecycle and swipe thresholds shared by Explore and Trending.
// Cancellation, lost capture and multiple fingers never submit an action.
function bindSwipeSurface(card, handlers) {
  let gesture = null;
  const cancel = () => {
    if (!gesture) return;
    const id = gesture.id;
    gesture = null;
    card.classList.remove('is-dragging');
    if (card.hasPointerCapture?.(id)) card.releasePointerCapture(id);
    handlers.cancel();
  };
  card.addEventListener('pointerdown', event => {
    if (gesture || event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (event.target.closest('button, a, [data-stop-click]') || !handlers.canStart(event)) return;
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, time:performance.now(), dx:0, dy:0};
    card.classList.add('is-dragging');
    try { card.setPointerCapture(event.pointerId); } catch (_) { cancel(); return; }
    handlers.start?.();
  });
  card.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.dx = event.clientX - gesture.x;
    gesture.dy = event.clientY - gesture.y;
    handlers.move(gesture.dx, gesture.dy);
  });
  card.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const {id, dx, dy, time} = gesture;
    gesture = null;
    card.classList.remove('is-dragging');
    if (card.hasPointerCapture?.(id)) card.releasePointerCapture(id);
    handlers.end?.();
    const distance = Math.hypot(dx, dy), elapsed = performance.now() - time;
    if (distance < 8 && elapsed < 300) { handlers.tap(); return; }
    const velocity = elapsed > 0 ? distance / elapsed : 0;
    const fast = velocity > .65, tx = fast ? 50 : 95, ty = fast ? 42 : 85;
    let action;
    if (Math.abs(dx) > tx && Math.abs(dx) > Math.abs(dy)) action = dx < 0 ? 'dismiss' : 'save';
    else if (Math.abs(dy) > ty && Math.abs(dy) > Math.abs(dx) * .8) action = dy < 0 ? 'priority' : 'read';
    if (action) handlers.swipe(action, velocity); else handlers.cancel();
  });
  const cancelPointer = event => { if (gesture?.id === event.pointerId) cancel(); };
  card.addEventListener('pointercancel', cancelPointer);
  card.addEventListener('lostpointercapture', cancelPointer);
  return cancel;
}
