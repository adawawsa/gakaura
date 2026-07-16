import * as THREE from 'three';
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
  SEG_LEN,
  SEG_COUNT,
  DECK_Y,
  X_CLAMP,
} from './world.js';
import { frame, arcDelta, LOOP_LEN } from './path.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const BEST_KEY = 'gakaura-best';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { renderer, scene, camera, camLight } = createScene(document.getElementById('game'));
const mats = makeMaterials();
/* keep the panel grid crisp at grazing angles */
mats.deckFloor.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const { segments, pools, traffic } = createWorld(scene, mats);
const hud = createHud();
const audio = createAudio();
const input = createInput(() => {
  if (state !== 'run') start();
});

/* player — an inverted giant sprinting along the deck underside */
const player = new THREE.Group();
const giant = makeGiant();
const giantRig = new THREE.Group();
giantRig.rotation.z = Math.PI;
giantRig.add(giant.group);
player.add(giantRig);
scene.add(player);
/* a warm wash so the giant and the deck ahead stay readable */
const headLight = new THREE.PointLight(0xffe2b0, 12, 26, 2);
headLight.position.set(0, -2.6, -8);
player.add(headLight);
/* contact shadow on the deck, so the giant reads as attached */
const contactShadow = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: mats.glow.map, color: 0x000000, depthWrite: false, opacity: 0.5 })
);
contactShadow.scale.set(3.0, 2.2, 1);
scene.add(contactShadow);

/* run-cycle state */
const STRIDE = 7; /* meters covered by one full leg cycle */
let runPhase = 0;
let airPose = 0;
let lastStep = 0;

/* scratch frames (avoid per-frame allocation) */
const fPlayer = {};
const fCam = {};
const fLook = {};
const fMisc = {};

/* ---------- state ---------- */
let state = 'title';
let S = 0; /* arc position along the real C1 loop */
let firstSlot = 0;
let px = -6;
let pvx = 0;
let py = 0;
let vy = 0;
let grounded = true;
let speed = 0;
let dist = 0;
let topSpeed = 0;
let shake = 0;
let squash = 0;

let best = 0;
try {
  best = parseFloat(localStorage.getItem(BEST_KEY) || '0');
} catch { /* private mode */ }
hud.setBest(best);

function segForSlot(slot) {
  return segments[((slot % SEG_COUNT) + SEG_COUNT) % SEG_COUNT];
}

function layoutSegments() {
  for (let k = 0; k < SEG_COUNT; k++) {
    const slot = firstSlot + k;
    assignSegment(segForSlot(slot), slot, slot < 6);
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
  speed = 15;
  dist = 0;
  topSpeed = 0;
  shake = 0;
  squash = 0;
  input.consumeJump();

  firstSlot = -3;
  layoutSegments();
  traffic.forEach((t, i) => {
    resetStreetCar(t, 40 + i * 40);
    placeStreetCar(t);
  });
  hud.hideOverlay();
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

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let camShakeT = 0;

function step() {
  requestAnimationFrame(step);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state === 'run') {
    let target = Math.min(15 + dist * 0.009, 44);
    if (input.boost()) target = Math.min(target + 7, 48);
    if (input.brake()) target *= 0.55;
    speed += (target - speed) * Math.min(dt * 1.6, 1);
    topSpeed = Math.max(topSpeed, speed);
    S += speed * dt;
    dist += speed * dt;

    /* steering — slightly looser in the air */
    const grip = grounded ? 7 : 3.5;
    pvx += (input.steer() * 10.5 - pvx) * Math.min(dt * grip, 1);
    px += pvx * dt;
    if (px < -X_CLAMP) { px = -X_CLAMP; pvx = 0; }
    if (px > X_CLAMP) { px = X_CLAMP; pvx = 0; }

    /* floaty inverted-gravity leap */
    if (input.consumeJump() && grounded) {
      vy = 6.8;
      grounded = false;
      audio.blip(180, 420, 0.25, 0.18, 'triangle');
    }
    if (!grounded) {
      const g = input.jumpHeld() && vy > -2 ? 7 : 13;
      vy -= g * dt;
      py += vy * dt;
      if (py <= 0) {
        py = 0;
        vy = 0;
        grounded = true;
        squash = 1;
        audio.blip(150, 70, 0.12, 0.12, 'sine');
      }
    }
    squash = Math.max(0, squash - dt * 5);

    /* recycle segments that fell behind onto slots ahead */
    while ((firstSlot + 1) * SEG_LEN < S - 25) {
      assignSegment(segForSlot(firstSlot + SEG_COUNT), firstSlot + SEG_COUNT);
      firstSlot++;
    }

    /* street traffic along the same alignment */
    for (const tr of traffic) {
      tr.s += tr.dir * tr.speed * dt;
      const d = arcDelta(tr.s, S);
      if (d < -40 || d > 340) resetStreetCar(tr, S + 60 + Math.random() * 260);
      placeStreetCar(tr);
    }

    /* sodium pools trailing the player down the track */
    pools.forEach((p, i) => {
      frame(S + 15 + i * 52, fMisc);
      const lat = i % 2 === 0 ? 7 : -7;
      p.position.set(fMisc.x + fMisc.nx * lat, 4, fMisc.z + fMisc.nz * lat);
    });

    /* collisions & pickups */
    if (collide(segments, S, px, py)) {
      gameOver();
    } else {
      const taken = collectOrbs(segments, S, px, py);
      if (taken > 0) {
        dist += 25 * taken;
        audio.blip(700, 1180, 0.14, 0.14, 'sine');
      }
    }

    /* run cycle: phase follows distance; footfalls thud twice per cycle */
    runPhase += (speed / STRIDE) * Math.PI * 2 * dt;
    if (grounded) {
      const stepN = Math.floor(runPhase / Math.PI);
      if (stepN !== lastStep) {
        lastStep = stepN;
        audio.blip(95, 45, 0.1, 0.13, 'sine');
      }
    }

    audio.setEngine(speed, state === 'run');
    hud.setSpeed(speed * 3.6);
    hud.setDist(dist);
  } else {
    /* idle jog on the title / crash screen */
    runPhase += dt * 5;
  }
  airPose += ((grounded ? 0 : 1) - airPose) * Math.min(dt * 9, 1);
  poseGiant(giant, runPhase, airPose, Math.min(1, Math.max(0, (speed - 15) / 29)));

  /* player transform on the real curve — py is the drop off the deck */
  frame(S, fPlayer);
  player.position.set(fPlayer.x + fPlayer.nx * px, DECK_Y - py, fPlayer.z + fPlayer.nz * px);
  player.rotation.y = fPlayer.yaw + pvx * 0.03;
  player.rotation.z = -pvx * 0.012;
  player.rotation.x = grounded ? 0 : THREE.MathUtils.clamp(vy * 0.03, -0.25, 0.2);
  const sq = 1 - squash * 0.18;
  player.scale.set(1 + squash * 0.12, sq, 1);
  contactShadow.position.set(player.position.x, DECK_Y - 0.06, player.position.z);
  contactShadow.material.opacity = Math.max(0, 0.5 - py * 0.16);

  /* camera rides the curve behind the giant */
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
