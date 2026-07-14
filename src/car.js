import * as THREE from 'three';

export function makeCar(mats, color) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.55, 4.1),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.55;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.5, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x14161a })
  );
  cabin.position.set(0, 1.05, 0.15);
  g.add(cabin);

  const wheelGeo = new THREE.BoxGeometry(0.25, 0.62, 0.62);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) {
    const wh = new THREE.Mesh(wheelGeo, wheelMat);
    wh.position.set(x, 0.31, z);
    g.add(wh);
  }

  const lightGeo = new THREE.BoxGeometry(0.42, 0.14, 0.06);
  for (const x of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(lightGeo, mats.tail);
    tl.position.set(x, 0.62, 2.06);
    g.add(tl);
    const hl = new THREE.Mesh(lightGeo, mats.head);
    hl.position.set(x, 0.6, -2.06);
    g.add(hl);
  }

  return g;
}
