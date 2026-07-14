import * as THREE from 'three';
import { makeBuildingTexture } from './textures.js';
import { makeCar } from './car.js';

export const SEG_LEN = 30;
export const SEG_COUNT = 12;
export const TOTAL = SEG_LEN * SEG_COUNT;
export const STREET_Y = 7; /* the real street hangs this far "above" us */
export const PILLAR_Z = -13; /* local z of pillar within a segment */
export const RIDGE_Z = 2; /* local z of the jumpable joint ridge */
export const X_CLAMP = 11.3;

const BODY_COLORS = [0x2b2f38, 0x3a3f4a, 0x54585f, 0x6e3030, 0x2e4a3a, 0x8a8f96];

export function createWorld(scene, mats) {
  const segments = [];
  const pools = [];
  const traffic = [];

  /* ---------- segments ---------- */
  const floorGeo = new THREE.PlaneGeometry(26, SEG_LEN);
  const streetGeo = new THREE.PlaneGeometry(20, SEG_LEN);
  const fasciaGeo = new THREE.BoxGeometry(0.7, 2.2, SEG_LEN);
  const seamGeo = new THREE.BoxGeometry(0.5, 0.1, SEG_LEN);
  const ridgeGeo = new THREE.BoxGeometry(25, 1, 0.9);
  const walkGeo = new THREE.BoxGeometry(3, 0.25, SEG_LEN);
  const shaftGeo = new THREE.BoxGeometry(2.2, STREET_Y - 1.05, 1.6);
  const capGeo = new THREE.BoxGeometry(6.4, 1.1, 2.0);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 5.4, 6);
  const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.22);
  const orbGeo = new THREE.SphereGeometry(0.22, 10, 8);

  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = new THREE.Group();
    seg.position.z = -i * SEG_LEN;

    /* our floor: the deck underside */
    const floor = new THREE.Mesh(floorGeo, mats.deckFloor);
    floor.rotation.x = -Math.PI / 2;
    seg.add(floor);

    /* green fascia walls at the deck edges */
    for (const x of [-12.6, 12.6]) {
      const f = new THREE.Mesh(fasciaGeo, mats.girder);
      f.position.set(x, 1.1, 0);
      seg.add(f);
    }
    /* flat girder seams you roll over */
    for (const x of [-8, -3, 3, 8]) {
      const s = new THREE.Mesh(seamGeo, mats.girder);
      s.position.set(x, 0.05, 0);
      seg.add(s);
    }

    /* pillar: hammerhead cap sits on our floor, shaft rises to the street */
    const cap = new THREE.Mesh(capGeo, mats.concrete);
    cap.position.set(0, 0.55, PILLAR_Z);
    seg.add(cap);
    const shaft = new THREE.Mesh(shaftGeo, mats.concrete);
    shaft.position.set(0, 1.05 + (STREET_Y - 1.05) / 2, PILLAR_Z);
    seg.add(shaft);

    /* expansion-joint ridge to jump, with marker glows */
    const ridge = new THREE.Mesh(ridgeGeo, mats.concrete);
    ridge.position.set(0, 0, RIDGE_Z);
    seg.add(ridge);
    const markers = [];
    for (const x of [-8, 0, 8]) {
      const m = new THREE.Sprite(mats.glow);
      m.scale.set(1.6, 1.6, 1);
      m.position.set(x, 1.1, RIDGE_Z);
      seg.add(m);
      markers.push(m);
    }

    /* the street hanging overhead, with sidewalks */
    const street = new THREE.Mesh(streetGeo, mats.street);
    street.rotation.x = Math.PI / 2;
    street.position.y = STREET_Y;
    seg.add(street);
    for (const x of [-11, 11]) {
      const wSide = new THREE.Mesh(walkGeo, mats.walk);
      wSide.position.set(x, STREET_Y + 0.05, 0);
      seg.add(wSide);
    }

    /* sodium lamp hanging down from the street into our space */
    const side = i % 2 === 0 ? 1 : -1;
    const pole = new THREE.Mesh(poleGeo, mats.rail);
    pole.position.set(side * 9.8, STREET_Y - 2.7, -SEG_LEN / 2 + 9);
    seg.add(pole);
    const head = new THREE.Mesh(headGeo, mats.lampHead);
    head.position.set(side * 9.8, STREET_Y - 5.4, -SEG_LEN / 2 + 9);
    seg.add(head);
    const lampGlow = new THREE.Sprite(mats.glow);
    lampGlow.scale.set(4.5, 4.5, 1);
    lampGlow.position.copy(head.position);
    seg.add(lampGlow);

    /* inverted skyline rising past the street */
    seg.userData.buildings = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ map: makeBuildingTexture() })
      );
      seg.add(b);
      seg.userData.buildings.push({ mesh: b, side: s });
    }

    /* collectible orbs */
    seg.userData.orbs = [];
    for (let oi = 0; oi < 3; oi++) {
      const orb = new THREE.Mesh(orbGeo, mats.orb);
      const og = new THREE.Sprite(mats.glow);
      og.scale.set(1.8, 1.8, 1);
      orb.add(og);
      seg.add(orb);
      seg.userData.orbs.push({ mesh: orb, taken: true });
    }

    seg.userData.ridge = ridge;
    seg.userData.markers = markers;
    seg.userData.hasRidge = true;
    seg.userData.ridgeH = 1;
    randomizeSegment(seg);

    scene.add(seg);
    segments.push(seg);
  }

  /* sodium pools along the way */
  for (let pi = 0; pi < 6; pi++) {
    const pl = new THREE.PointLight(0xff9d2e, 40, 34, 2);
    pl.position.set(pi % 2 === 0 ? 7 : -7, 3.2, -pi * 50 - 15);
    scene.add(pl);
    pools.push(pl);
  }

  /* overhead traffic hanging from the street */
  for (let ti = 0; ti < 8; ti++) {
    const tc = makeCar(mats, BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)]);
    tc.rotation.z = Math.PI;
    scene.add(tc);
    const t = { mesh: tc, speed: 0, dir: 1 };
    traffic.push(t);
    resetOverheadCar(t, -Math.random() * TOTAL);
  }

  return { segments, pools, traffic };
}

export function randomizeSegment(seg) {
  const u = seg.userData;
  for (const bd of u.buildings) {
    const hgt = 10 + Math.random() * 16;
    const dep = 10 + Math.random() * 14;
    const wid = 7 + Math.random() * 6;
    bd.mesh.scale.set(wid, hgt, dep);
    bd.mesh.position.set(
      bd.side * (15 + wid / 2 + Math.random() * 5),
      STREET_Y + hgt / 2,
      -SEG_LEN / 2 + Math.random() * 8
    );
    bd.mesh.material.map = makeBuildingTexture();
    bd.mesh.material.needsUpdate = true;
  }

  u.hasRidge = Math.random() < 0.55;
  u.ridgeH = 0.6 + Math.random() * 0.35;
  u.ridge.visible = u.hasRidge;
  u.ridge.scale.y = u.ridgeH;
  u.ridge.position.y = u.ridgeH / 2;
  for (const m of u.markers) {
    m.visible = u.hasRidge;
    m.position.y = u.ridgeH + 0.5;
  }

  /* orb arc over the ridge, or a low run elsewhere */
  const overRidge = u.hasRidge && Math.random() < 0.75;
  const ox = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5);
  const baseZ = overRidge ? RIDGE_Z : -4 - Math.random() * 6;
  const heights = overRidge ? [1.1, 2.1, 1.1] : [0.7, 0.7, 0.7];
  u.orbs.forEach((ob, k) => {
    ob.taken = overRidge ? false : Math.random() > 0.5; /* low runs appear half the time */
    ob.mesh.visible = !ob.taken;
    ob.mesh.position.set(ox, heights[k], baseZ + (k - 1) * 2.6);
  });
}

export function disableRidge(seg) {
  const u = seg.userData;
  u.hasRidge = false;
  u.ridge.visible = false;
  for (const m of u.markers) m.visible = false;
}

export function resetOverheadCar(t, zPos) {
  t.dir = Math.random() < 0.4 ? -1 : 1;
  const lane = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
  t.mesh.position.set(lane, STREET_Y, zPos);
  t.mesh.rotation.y = t.dir === 1 ? 0 : Math.PI;
  t.speed = 9 + Math.random() * 10;
}

/* Returns 'pillar' | 'ridge' | null for the player box at (px, py). */
export function collide(segments, px, py) {
  for (const seg of segments) {
    const u = seg.userData;

    /* pillar: cap on the floor, shaft up the middle */
    const dzp = seg.position.z + PILLAR_Z;
    if (Math.abs(dzp) < 2.9) {
      if (Math.abs(px) < 4.0 && py < 1.05) return 'pillar';
      if (Math.abs(px) < 1.9 && py + 1.15 > 1.05) return 'pillar';
    }

    /* joint ridge: jump it */
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
      if (Math.abs(wz) < 1.6 && Math.abs(op.x - px) < 1.25 && Math.abs(op.y - (py + 0.7)) < 1.0) {
        ob.taken = true;
        ob.mesh.visible = false;
        taken++;
      }
    }
  }
  return taken;
}
