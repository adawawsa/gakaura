import * as THREE from 'three';

/* Debris bursts and slam shockwave rings. */
export function createFx(scene) {
  const POOL = 60;
  const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const matConcrete = new THREE.MeshBasicMaterial({ color: 0x9a9488 });
  const matRed = new THREE.MeshBasicMaterial({ color: 0xff5040 });
  const bits = [];
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.Mesh(geo, matConcrete);
    m.visible = false;
    scene.add(m);
    bits.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  let next = 0;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  let ringT = 1e9;
  let ringR = 10;

  return {
    burst(x, y, z, n = 10, red = false) {
      for (let k = 0; k < n; k++) {
        const b = bits[next];
        next = (next + 1) % POOL;
        b.mesh.visible = true;
        b.mesh.material = red ? matRed : matConcrete;
        b.mesh.position.set(x, y, z);
        b.mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 6;
        b.vx = Math.cos(a) * sp;
        b.vz = Math.sin(a) * sp;
        b.vy = -2 - Math.random() * 5; /* debris falls toward the street */
        b.life = 1.1;
      }
    },
    shock(x, y, z, r) {
      ring.position.set(x, y, z);
      ringR = r;
      ringT = 0;
      ring.visible = true;
    },
    update(dt) {
      for (const b of bits) {
        if (!b.mesh.visible) continue;
        b.life -= dt;
        if (b.life <= 0) {
          b.mesh.visible = false;
          continue;
        }
        b.vy -= 9 * dt;
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.y += b.vy * dt;
        b.mesh.position.z += b.vz * dt;
        b.mesh.rotation.x += 4 * dt;
        if (b.mesh.position.y < 0.1) {
          b.mesh.position.y = 0.1;
          b.vy *= -0.3;
        }
      }
      if (ringT < 0.55) {
        ringT += dt;
        const p = Math.min(1, ringT / 0.55);
        const s = 1 + (ringR - 1) * p;
        ring.scale.set(s, s, 1);
        ring.material.opacity = 0.8 * (1 - p);
      } else if (ring.visible) {
        ring.visible = false;
      }
    },
  };
}
