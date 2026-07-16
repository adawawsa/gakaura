import * as THREE from 'three';
import { frame, arcDelta } from './path.js';

const _f = {};

/* Anti-giant drones: they spawn ahead, close in, and home onto the player. */
export function createDrones(scene, mats, count = 8) {
  const drones = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x23262c })
    );
    g.add(body);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.03, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x555a60 })
    );
    rotor.position.y = 0.16;
    g.add(rotor);
    const eye = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: mats.glow.map, color: 0xff3040, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    eye.scale.set(1.6, 1.6, 1);
    g.add(eye);
    g.visible = false;
    scene.add(g);
    drones.push({ mesh: g, rotor, active: false, s: 0, lat: 0, y: 3, wob: Math.random() * 7 });
  }
  return drones;
}

export function spawnDrone(d, S) {
  d.active = true;
  d.s = S + 130 + Math.random() * 70;
  d.lat = (Math.random() - 0.5) * 20;
  d.y = 1.5 + Math.random() * 4;
  d.mesh.visible = true;
}

export function killDrone(d) {
  d.active = false;
  d.mesh.visible = false;
}

/* Returns a drone touching the player, or null. */
export function updateDrones(drones, dt, t, S, px, playerY, speed) {
  let hit = null;
  for (const d of drones) {
    if (!d.active) continue;
    /* closes in at ~13 m/s relative to the player */
    d.s += (speed - 13) * dt;
    const gap = arcDelta(d.s, S);
    if (gap < -30 || gap > 260) {
      killDrone(d);
      continue;
    }
    /* homing */
    const chase = Math.min(1, Math.max(-1, px - d.lat));
    d.lat += chase * 4.5 * dt;
    const ty = playerY + Math.sin(t * 2 + d.wob) * 0.4;
    d.y += Math.min(2.4 * dt, Math.max(-2.4 * dt, ty - d.y));

    frame(d.s, _f);
    d.mesh.position.set(_f.x + _f.nx * d.lat, d.y, _f.z + _f.nz * d.lat);
    d.mesh.rotation.y = _f.yaw;
    d.rotor.rotation.y = t * 25 + d.wob;

    if (Math.abs(gap) < 1.6 && Math.abs(d.lat - px) < 1.4 && Math.abs(d.y - playerY) < 1.6) {
      hit = d;
    }
  }
  return hit;
}
