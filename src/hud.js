export function createHud() {
  const speed = document.getElementById('speed');
  const dist = document.getElementById('dist');
  const best = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overTitle = document.getElementById('over-title');
  const overSub = document.getElementById('over-sub');
  const overStats = document.getElementById('over-stats');
  const toast = document.getElementById('toast');
  const status = document.getElementById('status');
  const xpbar = document.getElementById('xpbar');
  const lvl = document.getElementById('lvl');
  const cards = document.getElementById('cards');
  const cardsRow = document.getElementById('cards-row');
  let toastTimer = 0;

  return {
    setXp(frac, level) {
      xpbar.style.width = `${Math.min(100, frac * 100)}%`;
      lvl.textContent = `Lv ${level + 1}`;
    },
    setStatus(shield, charges) {
      status.textContent = `${'🛡'.repeat(shield)}${shield && charges ? ' ' : ''}${'✊'.repeat(charges)}`;
    },
    showCards(options, levels, onPick) {
      cardsRow.innerHTML = '';
      options.forEach((u, i) => {
        const lv = levels[u.id] || 0;
        const btn = document.createElement('button');
        btn.className = 'card';

        const art = document.createElement('span');
        art.className = 'cardimg';
        const img = document.createElement('img');
        img.src = `cards/${u.id}.svg`;
        img.alt = '';
        img.decoding = 'async';
        img.addEventListener('error', () => art.remove(), { once: true });
        art.appendChild(img);

        const meta = document.createElement('span');
        meta.className = 'cl';
        meta.textContent = `${i + 1} ｜ Lv ${lv} → ${lv + 1}`;

        const title = document.createElement('h3');
        title.textContent = u.name;

        const desc = document.createElement('p');
        desc.textContent = u.desc[lv];

        btn.append(art, meta, title, desc);
        btn.addEventListener('click', () => onPick(u));
        cardsRow.appendChild(btn);
      });
      cards.classList.remove('hidden');
    },
    hideCards() {
      cards.classList.add('hidden');
    },
    setSpeed(kmh) {
      speed.textContent = `${Math.floor(kmh)} km/h`;
    },
    setDist(m, lap = 0) {
      dist.textContent = lap > 0 ? `LAP ${lap + 1} · ${Math.floor(m)} m` : `${Math.floor(m)} m`;
    },
    showToast(text) {
      toast.textContent = text;
      toast.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.add('hidden'), 2600);
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
