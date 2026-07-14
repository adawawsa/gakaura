import * as THREE from 'three';

/* Draw with 2D canvas, then copy pixels into a DataTexture immediately —
   canvas backing stores can be purged before the GPU upload happens. */
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const src = g.getImageData(0, 0, w, h).data;
  const flipped = new Uint8Array(src.length);
  for (let row = 0; row < h; row++) {
    flipped.set(src.subarray((h - 1 - row) * w * 4, (h - row) * w * 4), row * w * 4);
  }
  const t = new THREE.DataTexture(flipped, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function makeDeckTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#55684a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const v = Math.random() * 18 - 9;
        g.fillStyle = `rgb(${Math.round(85 + v)},${Math.round(104 + v)},${Math.round(74 + v)})`;
        g.fillRect((x * w) / 8 + 1, (y * h) / 6 + 1, w / 8 - 2, h / 6 - 2);
      }
    }
    g.fillStyle = 'rgba(50,42,25,0.28)';
    for (let i = 0; i < 10; i++) {
      g.fillRect(Math.random() * w, 0, 2 + Math.random() * 4, h);
    }
  });
}

export function makeAsphaltTexture() {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#26282d';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(230,225,205,0.6)';
    g.lineWidth = 2;
    g.setLineDash([70, 90]);
    for (const fx of [0.335, 0.665]) {
      g.beginPath();
      g.moveTo(w * fx, 0);
      g.lineTo(w * fx, h);
      g.stroke();
    }
  });
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeConcreteTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#8a8578';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
    g.fillStyle = 'rgba(70,60,35,0.3)';
    for (let j = 0; j < 4; j++) {
      g.fillRect(Math.random() * w, h * 0.2, 2 + Math.random() * 3, h * 0.8);
    }
  });
}

export function makeBuildingTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#101318';
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 14;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < 0.28) {
          g.fillStyle = Math.random() < 0.7 ? 'rgba(255,190,110,0.9)' : 'rgba(170,200,255,0.85)';
          g.fillRect((x * w) / cols + 3, (y * h) / rows + 3, w / cols - 6, h / rows - 7);
        }
      }
    }
  });
}

export function makeGlowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,190,90,1)');
    r.addColorStop(0.35, 'rgba(255,150,50,0.45)');
    r.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
}

export function makeMaterials() {
  const glowTex = makeGlowTexture();
  return {
    deckFloor: new THREE.MeshLambertMaterial({ map: makeDeckTexture() }),
    street: new THREE.MeshLambertMaterial({ map: makeAsphaltTexture() }),
    girder: new THREE.MeshLambertMaterial({ color: 0x5a6a45 }),
    concrete: new THREE.MeshLambertMaterial({ map: makeConcreteTexture() }),
    walk: new THREE.MeshLambertMaterial({ color: 0x35373a }),
    rail: new THREE.MeshLambertMaterial({ color: 0x6b7075 }),
    glow: new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }),
    lampHead: new THREE.MeshBasicMaterial({ color: 0xffc27a }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    orb: new THREE.MeshBasicMaterial({ color: 0xffb84d }),
  };
}
