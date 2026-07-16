import * as THREE from 'three';
import { makeTowerTexture } from './textures.js';
import data from './buildings.json';

/* Real building massing along the C1 corridor, extracted from Project
   PLATEAU LOD1 (出典: 国土交通省 Project PLATEAU). Rendered as static
   instanced night boxes with our window texture. */
export function createCity(scene) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const POOLS = 3;
  const mats = Array.from({ length: POOLS }, () => new THREE.MeshBasicMaterial({ map: makeTowerTexture() }));
  const counts = new Array(POOLS).fill(0);
  data.forEach((_, i) => counts[i % POOLS]++);
  const meshes = mats.map((m, k) => new THREE.InstancedMesh(geo, m, counts[k]));

  const M = new THREE.Matrix4();
  const idx = new Array(POOLS).fill(0);
  data.forEach(([x, z, w, d, h], i) => {
    const k = i % POOLS;
    M.makeScale(Math.max(w, 3), h, Math.max(d, 3));
    M.setPosition(x, h / 2, z);
    meshes[k].setMatrixAt(idx[k]++, M);
  });

  for (const m of meshes) {
    m.instanceMatrix.needsUpdate = true;
    /* one bounding box spans the whole loop; fog does the distance work */
    m.frustumCulled = false;
    scene.add(m);
  }
}
