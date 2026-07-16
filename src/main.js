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
  collide,
  collectOrbs,
  destroyHazard,
  setRidgeProbability,
  SEG_LEN,
  SEG_COUNT,
  DECK_Y,
  X_CLAMP,
} from './world.js';
import { frame, arcDelta, LOOP_LEN } from './path.js';
import { createCity } from './city.js';
import { createFx } from './fx.js';
import { createDrones, spawnDrone, killDrone, updateDrones } from './enemies.js';
import { UPGRADES, pickThree } from './upgrades.js';
import landmarks from './c1landmarks.json';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const BEST_KEY = 'gakaura-best';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { renderer, scene, camera, camLight } = createScene(document.getElementById('game'));
const mats = makeMaterials();
mats.deckFloor.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const { segments, pools, traffic } = createWorld(scene, mats);
const city = createCity(scene);
const fx = createFx(scene);
const drones = createDrones(scene, mats);
const hud = createHud();
const audio = createAudio();
const input = createInput(() => {
  if (state === 'title' || state === 'over') start();
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
const STRIDE = 7;
let runPhase = 0;
let airPose = 0;
let lastStep = 0;

const fPlayer = {};
const fCam = {};
const fLook = {};
const fMisc = {};

/* ---------- state ---------- */
let state = 'title'; /* title | run | choose | over */
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
let topSpeed = 0;
let shake = 0;
let squash = 0;

/* survivors-loop state */
let xp = 0;
let level = 0;
let xpNext = 3;
let upLevels = {};
let shield = 0;
let smashCharges = 0;
let smashTimer = 0;
let invuln = 0;
let elapsed = 0;
let wave = 0;
let droneTimer = 3;

const SLAM_R = [0, 12, 22, 34];
const FLOAT_G = [7, 5.5, 4.5, 3.5];

let best = 0;
try {
  best = parseFloat(localStorage.getItem(BEST_KEY) || '0');
} catch { /* private mode */ }
hud.setBest(best);

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
  dist = 0;
  topSpeed = 0;
  shake = 0;
  squash = 0;
  xp = 0;
  level = 0;
  xpNext = 3;
  upLevels = {};
  shield = 0;
  smashCharges = 0;
  smashTimer = 0;
  invuln = 0;
  elapsed = 0;
  wave = 0;
  droneTimer = 3;
  lap = 0;
  nextLm = 0;
  input.consumeJump();
  setRidgeProbability(0.28);
  city.reset();
  drones.forEach(killDrone);

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
}

function gameOver() {
  state = 'over';
  shake = reducedMotion ? 0 : 1;
  audio.crash();
  audio.setEngine(0, false);
  if (dist > best) {
    best = dist;
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch { /* private mode */ }
  }
  hud.showGameOver(dist, topSpeed * 3.6, best);
  hud.setBest(best);
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
    xpNext = 3 + level * 2;
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
  if (u.id === 'shield') {
    shield = Math.min(3, shield + 1);
  }
  if (u.id === 'smash') {
    smashCharges = upLevels.smash;
    smashTimer = 18;
  }
  xp -= xpNext;
  level++;
  xpNext = 3 + level * 2;
  hud.hideCards();
  hud.setXp(Math.max(0, xp) / xpNext, level);
  hud.setStatus(shield, smashCharges);
  state = 'run';
  if (xp >= xpNext) openCards();
}

window.addEventListener('keydown', (e) => {
  if (state !== 'choose') return;
  const i = ['1', '2', '3'].indexOf(e.key);
  if (i >= 0 && window.__cardOptions && window.__cardOptions[i]) applyUpgrade(window.__cardOptions[i]);
});

/* A threat touched us: smash it, tank it, or die. destroyFn removes it. */
function resolveThreat(destroyFn, atX, atY, atZ, red = false) {
  if (smashCharges > 0) {
    smashCharges--;
    smashTimer = 18;
    destroyFn();
    fx.burst(atX, atY, atZ, 14, red);
    audio.blip(120, 36, 0.28, 0.28, 'sawtooth');
    hud.setStatus(shield, smashCharges);
    return;
  }
  if (shield > 0) {
    shield--;
    invuln = 1.6;
    destroyFn();
    speed *= 0.55;
    fx.burst(atX, atY, atZ, 8, red);
    audio.blip(200, 60, 0.3, 0.25, 'square');
    hud.setStatus(shield, smashCharges);
    return;
  }
  gameOver();
}

function doSlamImpact() {
  const lvS = upLevels.smash || 0;
  squash = 1.4;
  if (!reducedMotion) shake = Math.max(shake, 0.35);
  audio.blip(75, 26, 0.45, 0.32, 'sawtooth');
  const r = SLAM_R[lvS];
  if (r <= 0) return;
  fx.shock(player.position.x, DECK_Y - 0.25, player.position.z, r);
  /* hazards + drones in range shatter */
  for (const seg of segments) {
    const u = seg.userData;
    if ((u.hasPillar || u.hasRidge) && Math.abs(arcDelta(S, u.sCenter)) < r * 0.7) {
      destroyHazard(seg);
      fx.burst(seg.position.x, DECK_Y - 1, seg.position.z, 10);
    }
  }
  for (const d of drones) {
    if (d.active && Math.abs(arcDelta(d.s, S)) < r) {
      fx.burst(d.mesh.position.x, d.mesh.position.y, d.mesh.position.z, 8, true);
      killDrone(d);
    }
  }
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
  setElapsed(v) {
    elapsed = v;
  },
  give(id, lv) {
    upLevels[id] = lv;
    if (id === 'smash') smashCharges = lv;
    if (id === 'shield') shield = lv;
    hud.setStatus(shield, smashCharges);
  },
  droneCount() {
    return drones.filter((d) => d.active).length;
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
    elapsed += dt;
    const nw = Math.floor(elapsed / 45);
    if (nw !== wave) {
      wave = nw;
      setRidgeProbability(Math.min(0.5, 0.28 + wave * 0.05));
      hud.showToast(`WAVE ${wave + 1} — ドローン増加`);
      audio.blip(300, 150, 0.4, 0.2, 'square');
    }
    if (wave >= 1) {
      droneTimer -= dt;
      if (droneTimer <= 0) {
        const free = drones.find((d) => !d.active);
        if (free) spawnDrone(free, S);
        droneTimer = Math.max(1.2, 5.5 - wave * 0.7);
      }
    }
    invuln = Math.max(0, invuln - dt);
    if (smashCharges < (upLevels.smash || 0)) {
      smashTimer -= dt;
      if (smashTimer <= 0) {
        smashCharges++;
        smashTimer = 18;
        hud.setStatus(shield, smashCharges);
      }
    }

    const maxSpd = 44 + 5 * (upLevels.speed || 0);
    let target = Math.min(15 + dist * 0.009, maxSpd);
    if (input.boost()) target = Math.min(target + 7, maxSpd + 4);
    if (input.brake() && grounded) target *= 0.55;
    speed += (target - speed) * Math.min(dt * 1.6, 1);
    topSpeed = Math.max(topSpeed, speed);
    S += speed * dt;
    dist += speed * dt;

    const grip = grounded ? 7 : 3.5;
    pvx += (input.steer() * 10.5 - pvx) * Math.min(dt * grip, 1);
    px += pvx * dt;
    if (px < -X_CLAMP) { px = -X_CLAMP; pvx = 0; }
    if (px > X_CLAMP) { px = X_CLAMP; pvx = 0; }

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

    /* threats */
    const playerY = DECK_Y - py - 1.7;
    const droneHit = updateDrones(drones, dt, t, S, px, playerY, speed);
    if (state === 'run' && invuln <= 0) {
      if (droneHit) {
        resolveThreat(
          () => killDrone(droneHit),
          droneHit.mesh.position.x,
          droneHit.mesh.position.y,
          droneHit.mesh.position.z,
          true
        );
      } else {
        const hit = collide(segments, S, px, py);
        if (hit) {
          resolveThreat(() => destroyHazard(hit.seg), player.position.x, DECK_Y - py - 1, player.position.z);
        }
      }
    }

    if (state === 'run') {
      const reach = (upLevels.magnet || 0) * 1.5;
      const taken = collectOrbs(segments, S, px, py, reach);
      if (taken > 0) {
        dist += 25 * taken;
        gainXp(taken);
        audio.blip(700, 1180, 0.14, 0.14, 'sine');
      }

      runPhase += (speed / STRIDE) * Math.PI * 2 * dt;
      if (grounded) {
        const stepN = Math.floor(runPhase / Math.PI);
        if (stepN !== lastStep) {
          lastStep = stepN;
          audio.blip(95, 45, 0.1, 0.13, 'sine');
        }
      }

      checkLandmarks();
      audio.setEngine(speed, true);
      hud.setSpeed(speed * 3.6);
      hud.setDist(dist, lap);
    }
  } else {
    runPhase += dt * 5;
  }
  airPose += ((grounded ? 0 : 1) - airPose) * Math.min(dt * 9, 1);
  poseGiant(giant, runPhase, airPose, Math.min(1, Math.max(0, (speed - 15) / 29)));
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
  player.visible = invuln <= 0 || Math.floor(t * 14) % 2 === 0;
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
  frame(S - 7.2, fCam);
  frame(S + 12, fLook);
  camera.position.set(fCam.x + fCam.nx * camX, 3.0 - py * 0.25 + bob, fCam.z + fCam.nz * camX);
  camera.lookAt(fLook.x + fLook.nx * px * 0.8, 4.6 - py * 0.4, fLook.z + fLook.nz * px * 0.8);
  camLight.position.set(fCam.x + fCam.nx * camX, 3.6, fCam.z + fCam.nz * camX);

  renderer.render(scene, camera);
}
layoutSegments();
step();
