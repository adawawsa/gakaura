export function createHud() {
  const speed = document.getElementById('speed');
  const dist = document.getElementById('dist');
  const best = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('over-title');
  const overSub = document.getElementById('over-sub');
  const overStats = document.getElementById('over-stats');

  return {
    setSpeed(kmh) {
      speed.textContent = `${Math.floor(kmh)} km/h`;
    },
    setDist(m) {
      dist.textContent = `${Math.floor(m)} m`;
    },
    setBest(m) {
      best.textContent = `BEST ${Math.floor(m)} m`;
    },
    hideOverlay() {
      overlay.classList.add('hidden');
    },
    showGameOver(distM, topKmh, bestM) {
      overTitle.textContent = 'CRASH';
      overSub.textContent = 'R キー / タップで再走';
      overStats.innerHTML =
        `<span>${Math.floor(distM)} m</span>` +
        `<span>最高 ${Math.floor(topKmh)} km/h</span>` +
        `<span>BEST ${Math.floor(bestM)} m</span>`;
      overlay.classList.remove('hidden');
    },
  };
}
