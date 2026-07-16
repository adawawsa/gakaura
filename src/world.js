import * as THREE from 'three';
import { makeBuildingTexture, makeTowerTexture } from './textures.js';
import { makeCar } from './car.js';
import { frame, arcDelta, radiusAt, LOOP_LEN } from './path.js';

export const SEG_LEN = 10; /* short slots so segments hug the real curve */
export const SEG_COUNT = 36;
export const DECK_Y = 6.5; /* underside of the expressway deck — our "road" */
export const X_CLAMP = 11.3;
export { LOOP_LEN };

const OVERLAP = 1.2; /* segments overlap a little to hide gaps on curves */

/* Distant parallel expressway lines: [lateral offset, deck height] */
const VIADUCTS = [[-58, 9.2], [58, 9.2], [-88, 12.6], [88, 12.6]];

const BODY_COLORS = [0x2b2f38, 0x3a3f4a, 0x54585f, 0x6e3030, 0x2e4a3a, 0x8a8f96];

const _f = {};

export function createWorld(scene, mats) {
  const segments = [];
  const pools = [];
  const traffic = [];

  mats.deckFloor.map.repeat.set(2, 1);

  /* texture pools so recycling segments never re-renders canvases */
  const towerTexs = Array.from({ length: 8 }, makeTowerTexture);
  const shopTexs = Array.from({ length: 6 }, makeBuildingTexture);

  const L = SEG_LEN + OVERLAP;
  const streetGeo = new THREE.PlaneGeometry(26, L);
  const groundGeo = new THREE.PlaneGeometry(300, L);
  const deckGeo = new THREE.PlaneGeometry(26, L);
  const fasciaGeo = new THREE.BoxGeometry(0.7, 2.2, L);
  const seamGeo = new THREE.BoxGeometry(0.5, 0.1, L);
  const ridgeGeo = new THREE.BoxGeometry(25, 1, 0.9);
  const walkGeo = new THREE.BoxGeometry(3, 0.25, L);
  const shaftGeo = new THREE.BoxGeometry(2.2, DECK_Y - 1.05, 1.6);
  const capGeo = new THREE.BoxGeometry(6.4, 1.1, 2.0);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.4, 6);
  const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.22);
  const orbGeo = new THREE.SphereGeometry(0.22, 10, 8);
  const viaductGeo = new THREE.BoxGeometry(14, 1.5, L + 2);
  const viaductPierGeo = new THREE.BoxGeometry(2.4, 12.6, 2.0);

  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = new THREE.Group();
    const u = seg.userData;

    /* dark ground below with the detailed street at center */
    const ground = new THREE.Mesh(groundGeo, mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03 - (i % 2) * 0.004;
    seg.add(ground);
    const street = new THREE.Mesh(streetGeo, mats.street);
    street.rotation.x = -Math.PI / 2;
    street.position.y = (i % 2) * 0.004;
    seg.add(street);
    for (const x of [-11, 11]) {
      const wSide = new THREE.Mesh(walkGeo, mats.walk);
      wSide.position.set(x, 0.12, 0);
      seg.add(wSide);
    }

    /* the deck underside overhead — our viaduct */
    const deck = new THREE.Mesh(deckGeo, mats.deckFloor);
    deck.rotation.x = Math.PI / 2;
    deck.position.y = DECK_Y + (i % 2) * 0.004;
    seg.add(deck);
    for (const x of [-12.6, 12.6]) {
      const f = new THREE.Mesh(fasciaGeo, mats.girder);
      f.position.set(x, DECK_Y + 0.7, 0);
      seg.add(f);
    }
    for (const x of [-8, -3, 3, 8]) {
      const s = new THREE.Mesh(seamGeo, mats.girderPlain);
      s.position.set(x, DECK_Y - 0.05 - (i % 2) * 0.004, 0);
      seg.add(s);
    }

    /* pillar (visible on pillar slots only) */
    u.cap = new THREE.Mesh(capGeo, mats.capConcrete);
    u.cap.position.set(0, DECK_Y - 0.55, 0);
    seg.add(u.cap);
    u.shaft = new THREE.Mesh(shaftGeo, mats.concrete);
    u.shaft.position.set(0, (DECK_Y - 1.05) / 2, 0);
    seg.add(u.shaft);

    /* joint ridge (visible on ridge slots only) */
    u.ridge = new THREE.Mesh(ridgeGeo, mats.concrete);
    u.ridge.position.set(0, DECK_Y, 0);
    seg.add(u.ridge);
    u.markers = [];
    for (const x of [-8, 0, 8]) {
      const m = new THREE.Sprite(mats.glow);
      m.scale.set(1.6, 1.6, 1);
      m.position.set(x, DECK_Y - 1.6, 0);
      seg.add(m);
      u.markers.push(m);
    }

    /* street lamp */
    u.lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, mats.rail);
    pole.position.y = 2.7;
    u.lamp.add(pole);
    const head = new THREE.Mesh(headGeo, mats.lampHead);
    head.position.y = 5.3;
    u.lamp.add(head);
    const lampGlow = new THREE.Sprite(mats.glow);
    lampGlow.scale.set(4.5, 4.5, 1);
    lampGlow.position.y = 5.3;
    u.lamp.add(lampGlow);
    seg.add(u.lamp);

    /* distant parallel expressway pieces */
    u.viaducts = [];
    for (const [vx, vy] of VIADUCTS) {
      const slab = new THREE.Mesh(viaductGeo, mats.girderPlain);
      slab.position.set(vx, vy, 0);
      seg.add(slab);
      const pier = new THREE.Mesh(viaductPierGeo, mats.concrete);
      pier.position.set(vx, (vy - 0.75) / 2, 3);
      pier.scale.y = (vy - 0.75) / 12.6;
      seg.add(pier);
      u.viaducts.push({ slab, pier });
    }

    /* city buildings */
    u.towerTexs = towerTexs;
    u.shopTexs = shopTexs;
    u.buildings = [];
    for (const s of [-1, 1]) {
      const shop = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: shopTexs[0] }));
      seg.add(shop);
      u.buildings.push({ mesh: shop, side: s, kind: 'shop' });
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: towerTexs[0] }));
      seg.add(tower);
      u.buildings.push({ mesh: tower, side: s, kind: 'tower' });
    }

    /* sodium dots on distant structures */
    u.farGlows = [];
    for (let gi = 0; gi < 2; gi++) {
      const fg = new THREE.Sprite(mats.glow);
      fg.scale.set(3.2, 3.2, 1);
      seg.add(fg);
      u.farGlows.push(fg);
    }

    /* collectible orbs */
    u.orbs = [];
    for (let oi = 0; oi < 3; oi++) {
      const orb = new THREE.Mesh(orbGeo, mats.orb);
      const og = new THREE.Sprite(mats.glow);
      og.scale.set(1.8, 1.8, 1);
      orb.add(og);
      seg.add(orb);
      u.orbs.push({ mesh: orb, taken: true, drop: 0 });
    }

    scene.add(seg);
    segments.push(seg);
  }

  /* sodium pools between street and deck (repositioned every frame) */
  for (let pi = 0; pi < 6; pi++) {
    const pl = new THREE.PointLight(0xff9d2e, 40, 34, 2);
    scene.add(pl);
    pools.push(pl);
  }

  /* traffic on the street below, following the same real alignment */
  for (let ti = 0; ti < 8; ti++) {
    const tc = makeCar(mats, BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)]);
    scene.add(tc);
    traffic.push({ mesh: tc, s: 0, lane: 2, speed: 12, dir: 1 });
  }

  return { segments, pools, traffic };
}

/* Assign a segment to an arc slot: position it on the real curve and
   roll its hazards/props. `safe` suppresses hazards (used near spawn). */
export function assignSegment(seg, slot, safe = false) {
  const u = seg.userData;
  const sc = slot * SEG_LEN + SEG_LEN / 2;
  u.slot = slot;
  u.sCenter = sc;

  frame(sc, _f);
  seg.position.set(_f.x, 0, _f.z);
  seg.rotation.y = _f.yaw;

  /* hazards: a pillar every 3rd slot, ridges scattered between */
  u.hasPillar = !safe && slot % 3 === 0;
  u.cap.visible = u.hasPillar;
  u.shaft.visible = u.hasPillar;

  u.hasRidge = !safe && !u.hasPillar && Math.random() < 0.28;
  u.ridgeH = 0.6 + Math.random() * 0.35;
  u.ridge.visible = u.hasRidge;
  u.ridge.scale.y = u.ridgeH;
  u.ridge.position.y = DECK_Y - u.ridgeH / 2;
  for (const m of u.markers) {
    m.visible = u.hasRidge;
    m.position.y = DECK_Y - (u.ridgeH + 0.5);
  }

  /* lamp on middle slots, alternating sides */
  u.lamp.visible = slot % 3 === 1;
  u.lamp.position.set(slot % 2 === 0 ? 9.8 : -9.8, 0, 0);

  /* distant viaducts can't follow tight corners — hide them there */
  const showViaducts = radiusAt(sc) > 130;
  for (const v of u.viaducts) {
    v.slab.visible = showViaducts;
    v.pier.visible = showViaducts && slot % 3 === 0;
  }

  for (const bd of u.buildings) {
    if (bd.kind === 'shop') {
      const hgt = 2.5 + Math.random() * 1.6;
      bd.mesh.visible = Math.random() < 0.2;
      bd.mesh.scale.set(8 + Math.random() * 6, hgt, 8 + Math.random() * 10);
      bd.mesh.position.set(bd.side * (18 + Math.random() * 12), hgt / 2, 0);
      bd.mesh.material.map = u.shopTexs[Math.floor(Math.random() * u.shopTexs.length)];
    } else {
      const hgt = 10 + Math.random() * 20;
      bd.mesh.visible = Math.random() < 0.3;
      bd.mesh.scale.set(12 + Math.random() * 12, hgt, 12 + Math.random() * 18);
      bd.mesh.position.set(bd.side * (60 + Math.random() * 80), hgt / 2, 0);
      bd.mesh.material.map = u.towerTexs[Math.floor(Math.random() * u.towerTexs.length)];
    }
    bd.mesh.material.needsUpdate = true;
  }

  for (const fg of u.farGlows) {
    if (Math.random() < 0.5) {
      const [vx, vy] = VIADUCTS[Math.floor(Math.random() * VIADUCTS.length)];
      fg.visible = showViaducts;
      fg.position.set(vx + (Math.random() * 10 - 5), vy - 1.2, Math.random() * SEG_LEN - SEG_LEN / 2);
    } else {
      fg.visible = true;
      fg.position.set((Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 90), 4.4, 0);
    }
  }

  /* orbs: an arc under a ridge, or a rare shallow run */
  const overRidge = u.hasRidge && Math.random() < 0.75;
  const showRun = !overRidge && !u.hasPillar && Math.random() < 0.12;
  const ox = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5);
  const drops = overRidge ? [1.1, 2.1, 1.1] : [0.7, 0.7, 0.7];
  u.orbs.forEach((ob, k) => {
    ob.taken = !(overRidge || showRun);
    ob.drop = drops[k];
    ob.mesh.visible = !ob.taken;
    ob.mesh.position.set(ox, DECK_Y - drops[k], (k - 1) * 2.6);
  });
}

export function resetStreetCar(t, s) {
  t.dir = Math.random() < 0.4 ? -1 : 1;
  t.lane = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
  t.s = s;
  t.speed = 9 + Math.random() * 10;
}

export function placeStreetCar(t) {
  frame(t.s, _f);
  t.mesh.position.set(_f.x + _f.nx * t.lane, 0, _f.z + _f.nz * t.lane);
  t.mesh.rotation.y = _f.yaw + (t.dir === 1 ? 0 : Math.PI);
}

/* py = how far the player has dropped from the deck underside.
   Returns 'pillar' | 'ridge' | null. */
export function collide(segments, S, px, py) {
  for (const seg of segments) {
    const u = seg.userData;
    if (!u.hasPillar && !u.hasRidge) continue;
    const d = arcDelta(S, u.sCenter);

    if (u.hasPillar && Math.abs(d) < 2.9) {
      if (Math.abs(px) < 4.0 && py < 1.05) return 'pillar';
      if (Math.abs(px) < 1.9 && py + 1.15 > 1.05) return 'pillar';
    }
    if (u.hasRidge && Math.abs(d) < 2.35 && py < u.ridgeH - 0.12) return 'ridge';
  }
  return null;
}

/* Collects any orb touching the player; returns how many were taken. */
export function collectOrbs(segments, S, px, py) {
  let taken = 0;
  for (const seg of segments) {
    for (const ob of seg.userData.orbs) {
      if (ob.taken) continue;
      const op = ob.mesh.position;
      const d = arcDelta(S, seg.userData.sCenter - op.z);
      if (Math.abs(d) < 1.6 && Math.abs(op.x - px) < 1.25 && Math.abs(ob.drop - (py + 0.7)) < 1.0) {
        ob.taken = true;
        ob.mesh.visible = false;
        taken++;
      }
    }
  }
  return taken;
}
