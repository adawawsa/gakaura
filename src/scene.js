import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e12);
  scene.fog = new THREE.Fog(0x0a0e12, 40, 300);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 400);

  /* Physical light units (r155+): point lights fall off with 1/d²,
     so their intensities are far larger than the ambient ones. */
  scene.add(new THREE.HemisphereLight(0x4a5a78, 0x241d12, 2.6));
  scene.add(new THREE.AmbientLight(0x38301f, 2.2));

  const camLight = new THREE.PointLight(0xffb35c, 26, 46, 2);
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

  const baseBg = new THREE.Color(0x0a0e12);
  const fastBg = new THREE.Color(0x030b18);
  const plasmaBg = new THREE.Color(0x160718);
  const lookColor = new THREE.Color();

  function setVelocityLook(kmh, stage) {
    const fast = Math.min(1, Math.max(0, (kmh - 200) / 2800));
    const plasma = Math.min(1, Math.max(0, (kmh - 3000) / 7000));
    lookColor.copy(baseBg).lerp(fastBg, fast).lerp(plasmaBg, plasma * 0.72);
    scene.background.copy(lookColor);
    scene.fog.color.copy(lookColor);
    scene.fog.near = 40 + stage * 12;
    scene.fog.far = Math.min(380, 300 + stage * 16);
    const targetFov = 68 + Math.min(25, Math.log2(Math.max(1, kmh / 180)) * 5.5);
    camera.fov += (targetFov - camera.fov) * 0.08;
    camera.updateProjectionMatrix();
  }

  return { renderer, scene, camera, camLight, setVelocityLook };
}
