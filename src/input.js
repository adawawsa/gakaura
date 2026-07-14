export function createInput(onAction) {
  const keys = {};
  let jumpQueued = false;
  let touchSteer = 0;
  let touchJumpHeld = false;

  window.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.key === ' ' && !keys[' ']) jumpQueued = true;
    keys[e.key.toLowerCase()] = true;
    keys[e.key] = true;
    if (e.key === ' ' || e.key.toLowerCase() === 'r' || e.key === 'Enter') onAction();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.key] = false;
  });

  function readTouches(ev) {
    touchSteer = 0;
    touchJumpHeld = false;
    for (const t of ev.touches) {
      if (t.clientY > window.innerHeight * 0.45) {
        touchSteer = t.clientX < window.innerWidth / 2 ? -1 : 1;
      } else {
        touchJumpHeld = true;
      }
    }
  }
  window.addEventListener(
    'touchstart',
    (ev) => {
      for (const t of ev.changedTouches) {
        if (t.clientY <= window.innerHeight * 0.45) jumpQueued = true;
      }
      readTouches(ev);
      onAction();
    },
    { passive: true }
  );
  window.addEventListener('touchmove', readTouches, { passive: true });
  window.addEventListener('touchend', readTouches, { passive: true });

  return {
    steer() {
      let s = 0;
      if (keys['arrowleft'] || keys['a']) s -= 1;
      if (keys['arrowright'] || keys['d']) s += 1;
      if (touchSteer !== 0) s = touchSteer;
      return s;
    },
    boost: () => !!(keys['arrowup'] || keys['w']),
    brake: () => !!(keys['arrowdown'] || keys['s']),
    jumpHeld: () => !!(keys[' '] || touchJumpHeld),
    consumeJump() {
      const q = jumpQueued;
      jumpQueued = false;
      return q;
    },
  };
}
