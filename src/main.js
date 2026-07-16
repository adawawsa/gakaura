import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createScene } from './scene.js';
import { makeMaterials } from './textures.js';
import { makeGiant, poseGiant } from './giant.js';
import {
  createWorld,
  assignSegment,
  resetStreetCar,
  placeStreetCar,
  collectOrbs,
  SEG_LEN,
  SEG_COUNT,
  DECK_Y,
  X_CLAMP,
} from './world.js';
import { frame, arcDelta, curvatureAt, LOOP_LEN } from './path.js';
import { createCity } from './city.js';
import { createFx } from './fx.js';
import { pickThree } from './upgrades.js';
import landmarks from './c1landmarks.json';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const BEST_KEY = 'gakaura-best';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { renderer, scene, camera, camLight, setVelocityLook } = createScene(document.getElementById('game'));
const mats = makeMaterials();
mats.deckFloor.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const { segments, pools, traffic } = createWorld(scene, mats);
const city = createCity(scene);
const fx = createFx(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput(() => {
  if (state === 'title') start();
});

/* player — an inverted giant sprinting along the deck underside */
const player = new THREE.Group();
const giant = makeGiant();
const giantRig = new THREE.Group();
giantRig.rotation.z = Math.PI;
giantRig.add(giant.group);
player.add(giantRig);
scene.add(player);

new GLTFLoader().load('giant.glb', (gltf) => {
  const root = gltf.scene;
  const j = (n) => root.getObjectByName(n);
  if (!j('HipL') || !j('Torso')) return; /* unexpected rig — keep the box giant */
  root.rotation.y = Math.PI; /* Blender's -Y forward arrives as +Z; face -Z */
  giantRig.remove(giant.group);
  giant.group = root;
  giant.torso = j('Torso');
  giant.pelvis = j('Pelvis');
  giant.head = j('Head');
  giant.legL = { hip: j('HipL'), knee: j('KneeL') };
  giant.legR = { hip: j('HipR'), knee: j('KneeR') };
  giant.armL = { shoulder: j('ShoulderL'), elbow: j('ElbowL') };
  giant.armR = { shoulder: j('ShoulderR'), elbow: j('ElbowR') };
  giantRig.add(root);
});

const headLight = new THREE.PointLight(0xffe2b0, 12, 26, 2);
headLight.position.set(0, -2.6, -8);
player.add(headLight);
const contactShadow = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: mats.glow.map, color: 0x000000, depthWrite: false, opacity: 0.5 })
);
contactShadow.scale.set(3.0, 2.2, 1);
scene.add(contactShadow);

/* run-cycle state */
let runPhase = 0;
let airPose = 0;
let lastStep = 0;

const fPlayer = {};
const fCam = {};
const fLook = {};
const fMisc = {};

/* ---------- state ---------- */
let state = 'title'; /* title | run | choose */
let S = 0;
let firstSlot = 0;
let px = -6;
let pvx = 0;
let py = 0;
let vy = 0;
let grounded = true;
let slamming = false;
let speed = 0;
let dist = 0;
let shake = 0;
let squash = 0;

/* survivors-loop state */
let xp = 0;
let level = 0;
let xpNext = 3;
let upLevels = {};

function xpForLevel(lv) {
  return Math.ceil(3 * 1.25 ** lv);
}

const SLAM_R = [0, 12, 22, 34];
const FLOAT_G = [7, 5.5, 4.5, 3.5];

const SPEED_PHASES = [
  { kmh: 0, label: 'CITY SPEED', toast: '' },
  { kmh: 200, label: 'FLOW — 交通を置き去りにする', toast: '200 km/h — 交通が止まって見える' },
  { kmh: 400, label: 'LIGHT CITY — 都市が光になる', toast: '400 km/h — 東京が光の流れに変わる' },
  { kmh: 1000, label: 'TRANSONIC — 音速接近', toast: '1,000 km/h — 音速の壁が見えた' },
  { kmh: 1235, label: 'SUPERSONIC — 音を追い越す', toast: 'SONIC BOOM — 音速突破' },
  { kmh: 3000, label: 'HYPERSONIC — 空気が燃える', toast: '3,000 km/h — 極超音速領域' },
  { kmh: 10000, label: 'LIGHT LOOP — 東京は光の環', toast: '10,000 km/h — C1が光の環になった' },
];

function speedPhase(kmh) {
  let stage = 0;
  for (let i = 1; i < SPEED_PHASES.length; i++) {
    if (kmh >= SPEED_PHASES[i].kmh) stage = i;
  }
  return stage;
}

let sync = 1;
let recovery = 0;
let velocityStage = 0;
let highestVelocityStage = 0;
const sonicFlash = document.getElementById('sonic-flash');

let best = 0;
try {
  best = parseFloat(localStorage.getItem(BEST_KEY) || '0');
} catch { /* private mode */ }
hud.setBest(best);
let lastSavedBest = best;

function saveBest() {
  if (best <= lastSavedBest) return;
  try {
    localStorage.setItem(BEST_KEY, String(best));
    lastSavedBest = best;
  } catch { /* private mode */ }
}
window.addEventListener('pagehide', saveBest);

/* landmark toasts + lap counting */
let lap = 0;
let nextLm = 0;
function checkLandmarks() {
  if (nextLm >= landmarks.length) {
    if (S >= (lap + 1) * LOOP_LEN) {
      lap++;
      nextLm = 0;
      hud.showToast(`LAP ${lap + 1} — 都心環状線を一周した`);
    }
    return;
  }
  const [ls, name] = landmarks[nextLm];
  if (S >= ls + lap * LOOP_LEN) {
    hud.showToast(`${name} 通過`);
    nextLm++;
  }
}

function segForSlot(slot) {
  return segments[((slot % SEG_COUNT) + SEG_COUNT) % SEG_COUNT];
}

function layoutSegments() {
  for (let k = 0; k < SEG_COUNT; k++) {
    const slot = firstSlot + k;
    assignSegment(segForSlot(slot), slot, slot < firstSlot + 8);
  }
}

function start() {
  audio.init();
  state = 'run';
  S = 0;
  px = -6;
  pvx = 0;
  py = 0;
  vy = 0;
  grounded = true;
  slamming = false;
  speed = 15;
  sync = 1;
  recovery = 0;
  velocityStage = 0;
  highestVelocityStage = 0;
  document.body.dataset.speedStage = '0';
  dist = 0;
  shake = 0;
  squash = 0;
  xp = 0;
  level = 0;
  xpNext = 3;
  upLevels = {};
  lap = 0;
  nextLm = 0;
  input.consumeJump();
  city.reset();

  firstSlot = -3;
  layoutSegments();
  traffic.forEach((t, i) => {
    resetStreetCar(t, 40 + i * 40);
    placeStreetCar(t);
  });
  hud.hideOverlay();
  hud.hideCards();
  hud.setXp(0, 0);
  hud.setStatus(0, 0);
  hud.setSync(1);
  hud.setVelocityStage(SPEED_PHASES[0].label);
}

/* ---------- growth ---------- */
function gainXp(n) {
  xp += n;
  if (xp >= xpNext && state === 'run') openCards();
  hud.setXp(xp / xpNext, level);
}

function openCards() {
  const options = pickThree(upLevels);
  if (options.length === 0) {
    xp -= xpNext;
    level++;
    xpNext = xpForLevel(level);
    return;
  }
  state = 'choose';
  audio.setEngine(0, false);
  audio.blip(520, 1040, 0.3, 0.2, 'triangle');
  hud.showCards(options, upLevels, applyUpgrade);
  window.__cardOptions = options; /* keyboard 1-3 */
}

function applyUpgrade(u) {
  upLevels[u.id] = (upLevels[u.id] || 0) + 1;
  xp -= xpNext;
  level++;
  xpNext = xpForLevel(level);
  hud.hideCards();
  hud.setXp(Math.max(0, xp) / xpNext, level);
  hud.setStatus(0, 0);
  state = 'run';
  if (xp >= xpNext) openCards();
}

window.addEventListener('keydown', (e) => {
  if (state !== 'choose') return;
  const i = ['1', '2', '3'].indexOf(e.key);
  if (i >= 0 && window.__cardOptions && window.__cardOptions[i]) applyUpgrade(window.__cardOptions[i]);
});

function doSlamImpact() {
  const lvS = upLevels.smash || 0;
  squash = 1.4;
  if (!reducedMotion) shake = Math.max(shake, 0.35);
  audio.blip(75, 26, 0.45, 0.32, 'sawtooth');
  const r = SLAM_R[lvS];
  if (r <= 0) return;
  fx.shock(player.position.x, DECK_Y - 0.25, player.position.z, r);
  /* level 3: real buildings crumble into XP */
  if (lvS >= 3) {
    const hits = city.smashAt(player.position.x, player.position.z, r * 1.15);
    if (hits.length > 0) {
      for (const e of hits.slice(0, 6)) fx.burst(e.x, Math.min(8, e.h), e.z, 8);
      gainXp(hits.length);
      hud.showToast(`ビル ${hits.length} 棟 粉砕`);
      audio.blip(50, 20, 0.6, 0.3, 'sawtooth');
    }
  }
}

/* debug hooks for tests */
window.__gaku = {
  setS(v) {
    S = v;
    dist = v;
    firstSlot = Math.floor(v / SEG_LEN) - 3;
    layoutSegments();
  },
  addXp(n) {
    gainXp(n);
  },
  give(id, lv) {
    upLevels[id] = lv;
    hud.setStatus(0, 0);
  },
  setSpeedKmh(kmh) {
    const value = Math.max(54, Number(kmh) || 54);
    upLevels.speed = Math.max(upLevels.speed || 0, 12);
    dist = Math.max(dist, (value - 54) / 0.0324);
    speed = value / 3.6;
  },
  pick(i) {
    if (state === 'choose' && window.__cardOptions[i]) applyUpgrade(window.__cardOptions[i]);
  },
};

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let camShakeT = 0;

function step() {
  requestAnimationFrame(step);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state === 'run') {
    const speedLevel = upLevels.speed || 0;
    const maxKmh = 200 * 1.42 ** speedLevel;
    const maxSpd = maxKmh / 3.6;
    let target = Math.min((54 + dist * 0.0324) / 3.6, maxSpd);
    if (input.boost()) target = Math.min(target * 1.12 + 3, maxSpd * 1.04);
    if (input.brake() && grounded) target *= 0.55;
    if (recovery > 0) {
      recovery = Math.max(0, recovery - dt);
      target *= 0.48 + 0.52 * (1 - recovery / 4);
    }
    speed += (target - speed) * Math.min(dt * 1.6, 1);
    S += speed * dt;
    dist += speed * dt;

    const kmh = speed * 3.6;
    velocityStage = speedPhase(kmh);
    const grip = grounded ? 7 : 3.5;
    const steer = input.steer();
    const curve = curvatureAt(S + Math.min(80, speed * 0.16));
    const curveForce = velocityStage > 0
      ? Math.sign(curve) * Math.min(13, Math.abs(curve) * speed * speed * 0.005)
      : 0;
    pvx += (steer * 10.5 - pvx) * Math.min(dt * grip, 1);
    pvx += curveForce * dt;
    px += pvx * dt;
    if (px < -X_CLAMP) { px = -X_CLAMP; pvx = 0; }
    if (px > X_CLAMP) { px = X_CLAMP; pvx = 0; }

    /* At extreme velocity the curve pushes the giant toward the edge.
       Missing the line costs momentum, never the run itself. */
    const edge = Math.abs(px) / X_CLAMP;
    if (velocityStage === 0) {
      sync += dt * 0.55;
    } else {
      const stageStress = Math.min(1, (kmh - 180) / 1800);
      const danger = Math.max(0, (edge - 0.52) / 0.48);
      const centered = edge < 0.34 ? 0.18 : 0.06;
      sync += dt * (centered - danger * (0.5 + stageStress * 0.85));
    }
    sync = Math.max(0, Math.min(1, sync));
    if (sync <= 0 && recovery <= 0) {
      speed *= 0.58;
      recovery = 4;
      sync = 0.55;
      px *= 0.2;
      pvx = 0;
      py = Math.max(py, 2.6);
      vy = -5;
      grounded = false;
      slamming = false;
      shake = reducedMotion ? 0 : 0.7;
      audio.crash();
      hud.showToast('GRAVITY SYNC LOST — 速度低下');
    }

    /* jump / float / slam */
    if (input.consumeJump() && grounded) {
      vy = 6.8 + 0.4 * (upLevels.float || 0);
      grounded = false;
      audio.blip(180, 420, 0.25, 0.18, 'triangle');
    }
    if (!grounded) {
      if (input.brake() && !slamming && py > 0.5) {
        slamming = true;
        vy = -15;
        audio.blip(400, 90, 0.2, 0.2, 'triangle');
      }
      const g = input.jumpHeld() && vy > -2 && !slamming ? FLOAT_G[upLevels.float || 0] : 13;
      vy -= g * dt;
      py += vy * dt;
      if (py <= 0) {
        py = 0;
        vy = 0;
        grounded = true;
        squash = 1;
        audio.blip(150, 70, 0.12, 0.12, 'sine');
        if (slamming) {
          slamming = false;
          doSlamImpact();
        }
      }
    }
    squash = Math.max(0, squash - dt * 5);

    if (state === 'run') {
      const reach = (upLevels.magnet || 0) * 1.5;
      const sweep = Math.min(150, speed * dt + 2);
      const taken = collectOrbs(segments, S, px, py, reach, sweep);
      if (taken > 0) {
        dist += 25 * taken;
        gainXp(taken);
        audio.blip(700, 1180, 0.14, 0.14, 'sine');
      }
    }

    while ((firstSlot + 1) * SEG_LEN < S - 25) {
      assignSegment(segForSlot(firstSlot + SEG_COUNT), firstSlot + SEG_COUNT);
      firstSlot++;
    }

    for (const tr of traffic) {
      tr.s += tr.dir * tr.speed * dt;
      const d = arcDelta(tr.s, S);
      if (d < -40 || d > 340) resetStreetCar(tr, S + 60 + Math.random() * 260);
      placeStreetCar(tr);
    }

    pools.forEach((p, i) => {
      frame(S + 15 + i * 52, fMisc);
      const lat = i % 2 === 0 ? 7 : -7;
      p.position.set(fMisc.x + fMisc.nx * lat, 4, fMisc.z + fMisc.nz * lat);
    });

    if (state === 'run') {
      const cadence = 2.35 + Math.max(0, Math.log2(Math.max(1, speed * 3.6 / 100))) * 0.48;
      runPhase += cadence * Math.PI * 2 * dt;
      if (grounded) {
        const stepN = Math.floor(runPhase / Math.PI);
        if (stepN !== lastStep) {
          lastStep = stepN;
          audio.blip(95, 45, 0.1, 0.13, 'sine');
          if (velocityStage >= 2) {
            fx.shock(player.position.x, DECK_Y - 0.2, player.position.z, 2.5 + velocityStage * 1.6);
          }
        }
      }

      checkLandmarks();
      audio.setEngine(speed, true);
      hud.setSpeed(speed * 3.6);
      hud.setDist(dist, lap);
      if (dist > best) {
        best = dist;
        hud.setBest(best);
        if (best - lastSavedBest >= 250) saveBest();
      }
    }
  } else {
    runPhase += dt * 5;
  }

  const liveKmh = speed * 3.6;
  velocityStage = speedPhase(liveKmh);
  if (velocityStage > highestVelocityStage) {
    highestVelocityStage = velocityStage;
    hud.showToast(SPEED_PHASES[velocityStage].toast);
    audio.blip(120, Math.min(1600, 260 + velocityStage * 210), 0.65, 0.24, 'sawtooth');
    if (velocityStage === 4) {
      audio.crash();
      sonicFlash.classList.remove('boom');
      void sonicFlash.offsetWidth;
      sonicFlash.classList.add('boom');
    }
  }
  document.body.dataset.speedStage = String(velocityStage);
  document.documentElement.style.setProperty(
    '--velocity-intensity',
    String(reducedMotion ? 0 : Math.min(0.82, Math.max(0, (Math.log10(Math.max(1, liveKmh)) - 2.18) / 2.0)))
  );
  hud.setVelocityStage(SPEED_PHASES[velocityStage].label);
  hud.setSync(sync);
  setVelocityLook(liveKmh, velocityStage);
  city.setVelocity(liveKmh, velocityStage);

  airPose += ((grounded ? 0 : 1) - airPose) * Math.min(dt * 9, 1);
  poseGiant(giant, runPhase, airPose, Math.min(1, velocityStage / 4 + Math.max(0, liveKmh - 54) / 1500));
  fx.update(dt);
  city.update(dt);

  /* player transform */
  frame(S, fPlayer);
  player.position.set(fPlayer.x + fPlayer.nx * px, DECK_Y - py, fPlayer.z + fPlayer.nz * px);
  player.rotation.y = fPlayer.yaw + pvx * 0.03;
  player.rotation.z = -pvx * 0.012;
  player.rotation.x = grounded ? 0 : THREE.MathUtils.clamp(vy * 0.03, -0.25, 0.2);
  const sq = 1 - squash * 0.18;
  player.scale.set(1 + squash * 0.12, sq, 1);
  player.visible = true;
  contactShadow.position.set(player.position.x, DECK_Y - 0.06, player.position.z);
  contactShadow.material.opacity = Math.max(0, 0.5 - py * 0.16);

  /* camera */
  let camX = px * 0.55;
  const bob = reducedMotion ? 0 : Math.sin(t * 9) * 0.014 * (speed / 44) * (grounded ? 1 : 0);
  if (shake > 0) {
    camShakeT += dt * 30;
    camX += Math.sin(camShakeT * 13) * shake * 0.4;
    shake = Math.max(0, shake - dt * 2);
  }
  const camBack = 7.2 + velocityStage * 8;
  const lookAhead = 12 + velocityStage * 16;
  frame(S - camBack, fCam);
  frame(S + lookAhead, fLook);
  const fastLift = velocityStage * 0.32;
  camera.position.set(fCam.x + fCam.nx * camX, 3.0 + fastLift - py * 0.25 + bob, fCam.z + fCam.nz * camX);
  camera.lookAt(fLook.x + fLook.nx * px * 0.8, 4.6 + fastLift * 0.35 - py * 0.4, fLook.z + fLook.nz * px * 0.8);
  camLight.position.set(fCam.x + fCam.nx * camX, 3.6, fCam.z + fCam.nz * camX);

  renderer.render(scene, camera);
}
layoutSegments();
step();
