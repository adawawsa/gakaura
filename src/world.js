import * as THREE from 'three';
import { makeBuildingTexture } from './textures.js';
import { makeCar } from './car.js';

export const SEG_LEN = 30;
export const SEG_COUNT = 12;
export const TOTAL = SEG_LEN * SEG_COUNT;
export const DECK_Y = 6.5; /* underside of the expressway deck — our "road" */
export const PILLAR_Z = -13; /* local z of pillar within a segment */
export const RIDGE_Z = 2; /* local z of the joint ridge hanging from the deck */
export const X_CLAMP = 11.3;

const BODY_COLORS = [0x2b2f38, 0x3a3f4a, 0x54585f, 0x6e3030, 0x2e4a3a, 0x8a8f96];

export const DECK_W = 400; /* the panel ceiling runs to the horizon */

export function createWorld(scene, mats) {
  const segments = [];
  const pools = [];
  const traffic = [];

  /* the deck texture tiles 8 panels (13 m) per repeat across the width */
  mats.deckFloor.map.repeat.set(DECK_W / 13, 2);

  /* ---------- segments ---------- */
  const streetGeo = new THREE.PlaneGeometry(26, SEG_LEN);
  const groundGeo = new THREE.PlaneGeometry(DECK_W, SEG_LEN);
  const deckGeo = new THREE.PlaneGeometry(DECK_W, SEG_LEN);
  const seamGeo = new THREE.BoxGeometry(0.5, 0.1, SEG_LEN);
  const ribGeo = new THREE.BoxGeometry(0.3, 0.18, SEG_LEN);
  const jointGeo = new THREE.BoxGeometry(DECK_W, 0.22, 0.5);
  const farShaftGeo = new THREE.BoxGeometry(2.2, DECK_Y, 1.6);
  const ridgeGeo = new THREE.BoxGeometry(25, 1, 0.9);
  const walkGeo = new THREE.BoxGeometry(3, 0.25, SEG_LEN);
  const shaftGeo = new THREE.BoxGeometry(2.2, DECK_Y - 1.05, 1.6);
  const capGeo = new THREE.BoxGeometry(6.4, 1.1, 2.0);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.4, 6);
  const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.22);
  const orbGeo = new THREE.SphereGeometry(0.22, 10, 8);

  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = new THREE.Group();
    seg.position.z = -i * SEG_LEN;

    /* dark ground stretching out below, with the detailed street at center */
    const ground = new THREE.Mesh(groundGeo, mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    seg.add(ground);
    const street = new THREE.Mesh(streetGeo, mats.street);
    street.rotation.x = -Math.PI / 2;
    seg.add(street);
    for (const x of [-11, 11]) {
      const wSide = new THREE.Mesh(walkGeo, mats.walk);
      wSide.position.set(x, 0.12, 0);
      seg.add(wSide);
    }

    /* the deck underside overhead — one slab of panels to the horizon */
    const deck = new THREE.Mesh(deckGeo, mats.deckFloor);
    deck.rotation.x = Math.PI / 2;
    deck.position.y = DECK_Y;
    seg.add(deck);

    /* girder seams near the play area, thinner ribs marching outward */
    for (const x of [-8, -3, 3, 8]) {
      const s = new THREE.Mesh(seamGeo, mats.girderPlain);
      s.position.set(x, DECK_Y - 0.05, 0);
      seg.add(s);
    }
    for (const x of [-16, 16, -28, 28, -45, 45, -70, 70, -110, 110]) {
      const r = new THREE.Mesh(ribGeo, mats.girderPlain);
      r.position.set(x, DECK_Y - 0.09, 0);
      seg.add(r);
    }

    /* every segment: the expansion joint runs right across the slab */
    const jointLine = new THREE.Mesh(jointGeo, mats.girderPlain);
    jointLine.position.set(0, DECK_Y - 0.11, RIDGE_Z);
    seg.add(jointLine);

    /* column forest marching to the horizon on both sides */
    for (const [fx, fz] of [[-22, 0], [22, 3], [-40, -4], [40, 1], [-65, 2], [65, -3], [-95, -1], [95, 4]]) {
      const c = new THREE.Mesh(farShaftGeo, mats.concrete);
      c.position.set(fx, DECK_Y / 2, PILLAR_Z + fz);
      seg.add(c);
    }

    /* pillar: shaft rises from the street, hammerhead cap meets the deck */
    const cap = new THREE.Mesh(capGeo, mats.capConcrete);
    cap.position.set(0, DECK_Y - 0.55, PILLAR_Z);
    seg.add(cap);
    const shaft = new THREE.Mesh(shaftGeo, mats.concrete);
    shaft.position.set(0, (DECK_Y - 1.05) / 2, PILLAR_Z);
    seg.add(shaft);

    /* expansion-joint ridge hanging down from the deck, with marker glows */
    const ridge = new THREE.Mesh(ridgeGeo, mats.concrete);
    ridge.position.set(0, DECK_Y, RIDGE_Z);
    seg.add(ridge);
    const markers = [];
    for (const x of [-8, 0, 8]) {
      const m = new THREE.Sprite(mats.glow);
      m.scale.set(1.6, 1.6, 1);
      m.position.set(x, DECK_Y - 1.1, RIDGE_Z);
      seg.add(m);
      markers.push(m);
    }

    /* sodium street lamp rising from the sidewalk */
    const side = i % 2 === 0 ? 1 : -1;
    const pole = new THREE.Mesh(poleGeo, mats.rail);
    pole.position.set(side * 9.8, 2.7, -SEG_LEN / 2 + 9);
    seg.add(pole);
    const head = new THREE.Mesh(headGeo, mats.lampHead);
    head.position.set(side * 9.8, 5.3, -SEG_LEN / 2 + 9);
    seg.add(head);
    const lampGlow = new THREE.Sprite(mats.glow);
    lampGlow.scale.set(4.5, 4.5, 1);
    lampGlow.position.copy(head.position);
    seg.add(lampGlow);

    /* low street-level buildings scattered under the endless slab */
    seg.userData.buildings = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ map: makeBuildingTexture() })
      );
      seg.add(b);
      seg.userData.buildings.push({ mesh: b, side: s });
    }

    /* sodium dots scattered across the far underside */
    seg.userData.farGlows = [];
    for (let gi = 0; gi < 4; gi++) {
      const fg = new THREE.Sprite(mats.glow);
      fg.scale.set(3.2, 3.2, 1);
      seg.add(fg);
      seg.userData.farGlows.push(fg);
    }

    /* collectible orbs (positions measured down from the deck) */
    seg.userData.orbs = [];
    for (let oi = 0; oi < 3; oi++) {
      const orb = new THREE.Mesh(orbGeo, mats.orb);
      const og = new THREE.Sprite(mats.glow);
      og.scale.set(1.8, 1.8, 1);
      orb.add(og);
      seg.add(orb);
      seg.userData.orbs.push({ mesh: orb, taken: true, drop: 0 });
    }

    seg.userData.ridge = ridge;
    seg.userData.markers = markers;
    seg.userData.hasRidge = true;
    seg.userData.ridgeH = 1;
    randomizeSegment(seg);

    scene.add(seg);
    segments.push(seg);
  }

  /* sodium pools between street and deck */
  for (let pi = 0; pi < 6; pi++) {
    const pl = new THREE.PointLight(0xff9d2e, 40, 34, 2);
    pl.position.set(pi % 2 === 0 ? 7 : -7, 4, -pi * 50 - 15);
    scene.add(pl);
    pools.push(pl);
  }

  /* normal traffic on the street below */
  for (let ti = 0; ti < 8; ti++) {
    const tc = makeCar(mats, BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)]);
    scene.add(tc);
    const t = { mesh: tc, speed: 0, dir: 1 };
    traffic.push(t);
    resetStreetCar(t, -Math.random() * TOTAL);
  }

  return { segments, pools, traffic };
}

export function randomizeSegment(seg) {
  const u = seg.userData;
  for (const bd of u.buildings) {
    /* low shops and sheds — nothing tall enough to pierce the slab */
    const hgt = 3 + Math.random() * 2.8;
    const dep = 8 + Math.random() * 12;
    const wid = 8 + Math.random() * 8;
    bd.mesh.visible = Math.random() < 0.7;
    bd.mesh.scale.set(wid, hgt, dep);
    bd.mesh.position.set(
      bd.side * (17 + Math.random() * 34),
      hgt / 2,
      -SEG_LEN / 2 + Math.random() * 8
    );
    bd.mesh.material.map = makeBuildingTexture();
    bd.mesh.material.needsUpdate = true;
  }

  for (const fg of u.farGlows) {
    const side = Math.random() < 0.5 ? -1 : 1;
    fg.position.set(
      side * (16 + Math.random() * 120),
      DECK_Y - 1.1 - Math.random() * 1.5,
      -SEG_LEN / 2 + Math.random() * SEG_LEN
    );
  }

  u.hasRidge = Math.random() < 0.55;
  u.ridgeH = 0.6 + Math.random() * 0.35;
  u.ridge.visible = u.hasRidge;
  u.ridge.scale.y = u.ridgeH;
  u.ridge.position.y = DECK_Y - u.ridgeH / 2;
  for (const m of u.markers) {
    m.visible = u.hasRidge;
    m.position.y = DECK_Y - (u.ridgeH + 0.5);
  }

  /* orb arc under the ridge, or a shallow run elsewhere */
  const overRidge = u.hasRidge && Math.random() < 0.75;
  const ox = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5);
  const baseZ = overRidge ? RIDGE_Z : -4 - Math.random() * 6;
  const drops = overRidge ? [1.1, 2.1, 1.1] : [0.7, 0.7, 0.7];
  u.orbs.forEach((ob, k) => {
    ob.taken = overRidge ? false : Math.random() > 0.5; /* shallow runs appear half the time */
    ob.drop = drops[k];
    ob.mesh.visible = !ob.taken;
    ob.mesh.position.set(ox, DECK_Y - drops[k], baseZ + (k - 1) * 2.6);
  });
}

export function disableRidge(seg) {
  const u = seg.userData;
  u.hasRidge = false;
  u.ridge.visible = false;
  for (const m of u.markers) m.visible = false;
}

export function resetStreetCar(t, zPos) {
  t.dir = Math.random() < 0.4 ? -1 : 1;
  const lane = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
  t.mesh.position.set(lane, 0, zPos);
  t.mesh.rotation.y = t.dir === 1 ? 0 : Math.PI;
  t.speed = 9 + Math.random() * 10;
}

/* py = how far the player has dropped from the deck underside.
   Returns 'pillar' | 'ridge' | null. */
export function collide(segments, px, py) {
  for (const seg of segments) {
    const u = seg.userData;

    /* pillar: hammerhead cap at the deck, shaft down the middle */
    const dzp = seg.position.z + PILLAR_Z;
    if (Math.abs(dzp) < 2.9) {
      if (Math.abs(px) < 4.0 && py < 1.05) return 'pillar';
      if (Math.abs(px) < 1.9 && py + 1.15 > 1.05) return 'pillar';
    }

    /* joint ridge: dip under it */
    if (u.hasRidge) {
      const dzr = seg.position.z + RIDGE_Z;
      if (Math.abs(dzr) < 2.35 && py < u.ridgeH - 0.12) return 'ridge';
    }
  }
  return null;
}

/* Collects any orb touching the player; returns how many were taken. */
export function collectOrbs(segments, px, py) {
  let taken = 0;
  for (const seg of segments) {
    for (const ob of seg.userData.orbs) {
      if (ob.taken) continue;
      const op = ob.mesh.position;
      const wz = seg.position.z + op.z;
      if (Math.abs(wz) < 1.6 && Math.abs(op.x - px) < 1.25 && Math.abs(ob.drop - (py + 0.7)) < 1.0) {
        ob.taken = true;
        ob.mesh.visible = false;
        taken++;
      }
    }
  }
  return taken;
}
