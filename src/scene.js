import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e12);
  scene.fog = new THREE.Fog(0x0a0e12, 30, 140);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 400);

  /* Physical light units (r155+): point lights fall off with 1/d²,
     so their intensities are far larger than the ambient ones. */
  scene.add(new THREE.HemisphereLight(0x4a5a78, 0x241d12, 2.6));
  scene.add(new THREE.AmbientLight(0x38301f, 2.2));

  const camLight = new THREE.PointLight(0xffb35c, 40, 46, 2);
  camLight.position.set(0, 4, 4);
  scene.add(camLight);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, camLight };
}
