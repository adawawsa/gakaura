import * as THREE from 'three';
import { makeTowerTexture } from './textures.js';
import data from './buildings.json';

/* Real building massing along the C1 corridor, extracted from Project
   PLATEAU LOD1 (出典: 国土交通省 Project PLATEAU). Rendered as static
   instanced night boxes — and smashable once the giant is strong enough. */
export function createCity(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const POOLS = 3;
  const mats = Array.from({ length: POOLS }, () => new THREE.MeshBasicMaterial({ map: makeTowerTexture() }));
  const counts = new Array(POOLS).fill(0);
  data.forEach((_, i) => counts[i % POOLS]++);
  const meshes = mats.map((m, k) => new THREE.InstancedMesh(geo, m, counts[k]));

  const entries = [];
  const grid = new Map(); /* 60 m cells -> entry indices */
  const M = new THREE.Matrix4();
  const idx = new Array(POOLS).fill(0);

  data.forEach(([x, z, w, d, h], i) => {
    const k = i % POOLS;
    const ii = idx[k]++;
    M.makeScale(Math.max(w, 3), h, Math.max(d, 3));
    M.setPosition(x, h / 2, z);
    meshes[k].setMatrixAt(ii, M);
    const e = { k, ii, x, z, w: Math.max(w, 3), d: Math.max(d, 3), h, alive: true };
    entries.push(e);
    const key = `${Math.floor(x / 60)},${Math.floor(z / 60)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(e);
  });

  for (const m of meshes) {
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    scene.add(m);
  }

  const collapsing = [];

  function setEntryMatrix(e, scaleY, sink) {
    M.makeScale(e.w, Math.max(0.05, e.h * scaleY), e.d);
    M.setPosition(e.x, (e.h * scaleY) / 2 - sink, e.z);
    meshes[e.k].setMatrixAt(e.ii, M);
    meshes[e.k].instanceMatrix.needsUpdate = true;
  }

  return {
    /* Collapse every building within r of (x, z). Returns how many fell. */
    smashAt(x, z, r) {
      const hits = [];
      const c0x = Math.floor((x - r) / 60);
      const c1x = Math.floor((x + r) / 60);
      const c0z = Math.floor((z - r) / 60);
      const c1z = Math.floor((z + r) / 60);
      for (let cx = c0x; cx <= c1x; cx++) {
        for (let cz = c0z; cz <= c1z; cz++) {
          for (const e of grid.get(`${cx},${cz}`) || []) {
            if (!e.alive) continue;
            if ((e.x - x) ** 2 + (e.z - z) ** 2 > r * r) continue;
            e.alive = false;
            collapsing.push({ e, t: 0 });
            hits.push(e);
          }
        }
      }
      return hits;
    },
    update(dt) {
      for (let i = collapsing.length - 1; i >= 0; i--) {
        const c = collapsing[i];
        c.t += dt;
        const p = Math.min(1, c.t / 0.7);
        setEntryMatrix(c.e, 1 - 0.92 * p * p, 0);
        if (p >= 1) collapsing.splice(i, 1);
      }
    },
    reset() {
      collapsing.length = 0;
      for (const e of entries) {
        if (!e.alive) {
          e.alive = true;
          setEntryMatrix(e, 1, 0);
        }
      }
    },
  };
}
