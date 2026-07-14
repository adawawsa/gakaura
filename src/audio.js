export function createAudio() {
  let ctx = null;
  let engine = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      engine = { osc, gain };
    } catch {
      ctx = null;
    }
  }

  function blip(freq0, freq1, dur, vol, type = 'sine') {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq0, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(freq1, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch { /* audio is best-effort */ }
  }

  function crash() {
    if (!ctx) return;
    try {
      const len = ctx.sampleRate * 0.4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    } catch { /* audio is best-effort */ }
  }

  function setEngine(speed, running) {
    if (!ctx || !engine) return;
    engine.gain.gain.setTargetAtTime(running ? 0.035 : 0, ctx.currentTime, running ? 0.1 : 0.05);
    if (running) engine.osc.frequency.setTargetAtTime(40 + speed * 2.6, ctx.currentTime, 0.08);
  }

  return { init, blip, crash, setEngine };
}
