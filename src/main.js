import * as THREE from 'three';
import { createScene } from './scene.js';
import { makeMaterials } from './textures.js';
import { makeCar } from './car.js';
import {
  createWorld,
  randomizeSegment,
  disableRidge,
  resetOverheadCar,
  collide,
  collectOrbs,
  SEG_LEN,
  TOTAL,
  PILLAR_Z,
  X_CLAMP,
} from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const BEST_KEY = 'gakaura-best';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { renderer, scene, camera, camLight } = createScene(document.getElementById('game'));
const mats = makeMaterials();
const { segments, pools, traffic } = createWorld(scene, mats);
const hud = createHud();
const audio = createAudio();
const input = createInput(() => {
  if (state !== 'run') start();
});

/* player */
const player = makeCar(mats, 0x333846);
scene.add(player);
const headLight = new THREE.PointLight(0xfff2d0, 25, 26, 2);
headLight.position.set(0, 1.4, -7);
player.add(headLight);

/* ---------- state ---------- */
let state = 'title';
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

function start() {
  audio.init();
  state = 'run';
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

  segments.forEach((s, i) => {
    s.position.z = -i * SEG_LEN;
    randomizeSegment(s);
  });
  /* clear hazards near the start so the first seconds are safe */
  for (const s of segments) {
    if (s.position.z + PILLAR_Z > -45) disableRidge(s);
  }
  traffic.forEach((t, i) => resetOverheadCar(t, -20 - i * 40));
  pools.forEach((p, i) => {
    p.position.z = -i * 50 - 15;
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
    dist += speed * dt;

    /* steering — slightly looser in the air */
    const grip = grounded ? 7 : 3.5;
    pvx += (input.steer() * 10.5 - pvx) * Math.min(dt * grip, 1);
    px += pvx * dt;
    if (px < -X_CLAMP) { px = -X_CLAMP; pvx = 0; }
    if (px > X_CLAMP) { px = X_CLAMP; pvx = 0; }

    /* floaty inverted-gravity jump */
    if (input.consumeJump() && grounded) {
      vy = 6.8;
      grounded = false;
      audio.blip(220, 480, 0.22, 0.18, 'triangle');
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

    /* world scroll */
    const dz = speed * dt;
    for (const s of segments) {
      s.position.z += dz;
      if (s.position.z > SEG_LEN) {
        s.position.z -= TOTAL;
        randomizeSegment(s);
      }
    }
    for (const p of pools) {
      p.position.z += dz;
      if (p.position.z > 20) p.position.z -= 300;
    }
    for (const tr of traffic) {
      tr.mesh.position.z += (speed - tr.dir * tr.speed) * dt;
      if (tr.mesh.position.z > 20) resetOverheadCar(tr, tr.mesh.position.z - TOTAL - Math.random() * 40);
    }

    /* collisions & pickups */
    if (collide(segments, px, py)) {
      gameOver();
    } else {
      const taken = collectOrbs(segments, px, py);
      if (taken > 0) {
        dist += 25 * taken;
        audio.blip(700, 1180, 0.14, 0.14, 'sine');
      }
    }

    audio.setEngine(speed, state === 'run');
    hud.setSpeed(speed * 3.6);
    hud.setDist(dist);
  }

  /* player transform */
  player.position.set(px, py, 0);
  player.rotation.y = -pvx * 0.03;
  player.rotation.z = pvx * 0.012;
  player.rotation.x = grounded ? 0 : THREE.MathUtils.clamp(-vy * 0.045, -0.3, 0.35);
  const sq = 1 - squash * 0.18;
  player.scale.set(1 + squash * 0.12, sq, 1);

  /* camera */
  let camX = px * 0.55;
  const bob = reducedMotion ? 0 : Math.sin(t * 9) * 0.014 * (speed / 44) * (grounded ? 1 : 0);
  if (shake > 0) {
    camShakeT += dt * 30;
    camX += Math.sin(camShakeT * 13) * shake * 0.4;
    shake = Math.max(0, shake - dt * 2);
  }
  camera.position.set(camX, 2.7 + py * 0.35 + bob, 7.2);
  camera.lookAt(px * 0.8, 1.8 + py * 0.45, -12);
  camLight.position.set(px, 4, 2);

  renderer.render(scene, camera);
}
step();
