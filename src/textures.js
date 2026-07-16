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

/* 裏面吸音板 (backside sound-absorbing panels): a regular grid of moss-green
   perforated metal panels with thin joint lines, an expansion-joint gap,
   rain-drip streaks and rust tinges — modeled on the real Shuto underside. */
export function makeDeckTexture() {
  const t = canvasTex(1024, 1024, (g, w, h) => {
    const cols = 8;
    const rows = 7;
    const pw = w / cols;
    const ph = h / rows;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        /* per-panel moss green, subtly varied */
        const v = Math.random() * 14 - 7;
        const r = 88 + v;
        const gr = 106 + v;
        const b = 74 + v;
        g.fillStyle = `rgb(${Math.round(r)},${Math.round(gr)},${Math.round(b)})`;
        g.fillRect(x * pw, y * ph, pw, ph);

        /* louver perforation: faint horizontal micro-lines */
        g.fillStyle = 'rgba(0,0,0,0.045)';
        for (let ly = 6; ly < ph - 4; ly += 7) {
          g.fillRect(x * pw + 4, y * ph + ly, pw - 8, 2);
        }

        /* occasional corner rust tinge */
        if (Math.random() < 0.22) {
          g.fillStyle = 'rgba(112,78,40,0.16)';
          g.fillRect(x * pw + (Math.random() < 0.5 ? 2 : pw - 26), y * ph + 2, 24, ph - 4);
        }
      }
    }

    /* thin dark joints between panels */
    g.fillStyle = 'rgba(38,45,30,0.85)';
    for (let x = 0; x <= cols; x++) g.fillRect(x * pw - 1, 0, 3, h);
    for (let y = 0; y <= rows; y++) g.fillRect(0, y * ph - 1, w, 3);

    /* one expansion joint: a wider near-black gap with staining around it */
    const jy = 3 * ph;
    g.fillStyle = 'rgba(28,30,24,0.5)';
    g.fillRect(0, jy - 12, w, 26);
    g.fillStyle = '#171a14';
    g.fillRect(0, jy - 4, w, 9);

    /* rain-drip streaks running along the panels from the joints */
    for (let i = 0; i < 26; i++) {
      const sx = Math.random() * w;
      const sy = Math.floor(Math.random() * rows) * ph;
      const len = ph * (0.4 + Math.random() * 0.6);
      const wob = 2 + Math.random() * 3;
      g.strokeStyle = `rgba(40,48,30,${0.10 + Math.random() * 0.14})`;
      g.lineWidth = 2 + Math.random() * 4;
      g.beginPath();
      g.moveTo(sx, sy);
      g.bezierCurveTo(sx + wob, sy + len * 0.33, sx - wob, sy + len * 0.66, sx + wob * 0.5, sy + len);
      g.stroke();
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

/* Edge girder steel: vertical stiffener ribs, bolt rows, rust weeping from the top. */
export function makeGirderTexture() {
  return canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#4e5f3d';
    g.fillRect(0, 0, w, h);

    /* weathering blotches */
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,36,22' : '120,130,95'},${Math.random() * 0.07})`;
      g.fillRect(Math.random() * w, Math.random() * h, 14, 8);
    }

    /* vertical stiffener ribs (~2 m apart in world space) */
    const ribs = 14;
    for (let i = 0; i < ribs; i++) {
      const x = ((i + 0.5) * w) / ribs;
      g.fillStyle = 'rgba(20,26,14,0.5)';
      g.fillRect(x + 3, 0, 4, h);
      g.fillStyle = 'rgba(150,165,120,0.5)';
      g.fillRect(x - 3, 0, 3, h);
      /* bolt column beside each rib */
      g.fillStyle = 'rgba(24,28,18,0.9)';
      for (let by = 14; by < h - 10; by += 22) {
        g.beginPath();
        g.arc(x + 12, by, 2.4, 0, Math.PI * 2);
        g.fill();
      }
    }

    /* bolt rows along top and bottom flanges */
    g.fillStyle = 'rgba(24,28,18,0.9)';
    for (let bx = 10; bx < w; bx += 18) {
      g.beginPath(); g.arc(bx, 10, 2.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(bx, h - 10, 2.4, 0, Math.PI * 2); g.fill();
    }

    /* rust streaks weeping from the top edge */
    for (let i = 0; i < 16; i++) {
      const sx = Math.random() * w;
      g.strokeStyle = `rgba(122,82,44,${0.12 + Math.random() * 0.2})`;
      g.lineWidth = 2 + Math.random() * 5;
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx + (Math.random() * 8 - 4), h * (0.3 + Math.random() * 0.7));
      g.stroke();
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

/* Pier shaft concrete: lift joints, vertical grooves, an anchor-plate dot grid
   near the top, rust drips from the bearing area and grime at the base. */
export function makeConcreteTexture() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#8f897b';
    g.fillRect(0, 0, w, h);

    /* mottling */
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }

    /* horizontal construction (lift) joints with a slight tone shift */
    for (const fy of [0.28, 0.55, 0.8]) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(0, h * fy - 14, w, 14);
      g.fillStyle = 'rgba(40,36,28,0.45)';
      g.fillRect(0, h * fy, w, 3);
    }

    /* two vertical grooves, shadow + catch-light edge */
    for (const fx of [0.32, 0.68]) {
      g.fillStyle = 'rgba(38,34,26,0.55)';
      g.fillRect(w * fx, 0, 5, h);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(w * fx + 5, 0, 2, h);
    }

    /* anchor-plate dot grid near the top (seismic retrofit plates) */
    g.fillStyle = 'rgba(52,48,40,0.7)';
    for (let ry = 0; ry < 5; ry++) {
      for (let rx = 0; rx < 10; rx++) {
        g.beginPath();
        g.arc(w * 0.12 + rx * (w * 0.076), h * 0.05 + ry * 13, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }

    /* rust drips from the bearing area at the very top */
    for (let i = 0; i < 7; i++) {
      const sx = Math.random() * w;
      g.strokeStyle = `rgba(118,78,40,${0.14 + Math.random() * 0.2})`;
      g.lineWidth = 2 + Math.random() * 4;
      g.beginPath();
      g.moveTo(sx, 0);
      g.lineTo(sx + (Math.random() * 10 - 5), h * (0.25 + Math.random() * 0.45));
      g.stroke();
    }

    /* patch repairs: rectangles in a slightly different tone */
    for (let i = 0; i < 3; i++) {
      const rw = 30 + Math.random() * 40;
      const rh = 24 + Math.random() * 30;
      const rx = Math.random() * (w - rw);
      const ry = h * 0.3 + Math.random() * h * 0.5;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      g.fillRect(rx, ry, rw, rh);
      g.strokeStyle = 'rgba(40,36,28,0.25)';
      g.lineWidth = 1;
      g.strokeRect(rx, ry, rw, rh);
    }

    /* grime gradient at the base */
    const grad = g.createLinearGradient(0, h * 0.75, 0, h);
    grad.addColorStop(0, 'rgba(30,28,22,0)');
    grad.addColorStop(1, 'rgba(30,28,22,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, h * 0.75, w, h * 0.25);

    /* pier number plaque */
    g.fillStyle = '#e8e4d8';
    g.fillRect(w * 0.40, h * 0.44, 52, 30);
    g.strokeStyle = '#2a3550';
    g.lineWidth = 2;
    g.strokeRect(w * 0.40, h * 0.44, 52, 30);
    g.fillStyle = '#22283a';
    g.font = 'bold 17px sans-serif';
    g.textAlign = 'center';
    g.fillText('裏 12', w * 0.40 + 26, h * 0.44 + 21);
  });
}

/* Hammerhead cap: concrete with heavy rust weeping and the row of
   rectangular blocks along the top edge (bearing shelf detail). */
export function makeCapTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#8c8678';
    g.fillRect(0, 0, w, h);

    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }

    /* row of rectangular blocks along the top edge */
    for (let bx = 0; bx < w; bx += 34) {
      g.fillStyle = 'rgba(220,215,200,0.28)';
      g.fillRect(bx + 2, 4, 30, 22);
      g.strokeStyle = 'rgba(40,36,28,0.5)';
      g.lineWidth = 2;
      g.strokeRect(bx + 2, 4, 30, 22);
    }

    /* heavy rust streaks weeping down the face */
    for (let i = 0; i < 14; i++) {
      const sx = Math.random() * w;
      g.strokeStyle = `rgba(116,76,38,${0.16 + Math.random() * 0.26})`;
      g.lineWidth = 3 + Math.random() * 6;
      g.beginPath();
      g.moveTo(sx, 26);
      g.lineTo(sx + (Math.random() * 10 - 5), h * (0.5 + Math.random() * 0.5));
      g.stroke();
    }

    /* grime along the bottom edge */
    g.fillStyle = 'rgba(30,28,22,0.25)';
    g.fillRect(0, h - 18, w, 18);
  });
}

/* Mid-rise tower facades for the skyline beyond the deck edges. */
export function makeTowerTexture() {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#0e1116';
    g.fillRect(0, 0, w, h);
    const cols = 12;
    const rows = 26;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < 0.3) {
          g.fillStyle = Math.random() < 0.7 ? 'rgba(255,190,110,0.9)' : 'rgba(170,200,255,0.85)';
          g.fillRect((x * w) / cols + 3, (y * h) / rows + 3, w / cols - 6, h / rows - 7);
        }
      }
    }
    /* rooftop aviation light */
    if (Math.random() < 0.5) {
      g.fillStyle = 'rgba(255,60,50,0.95)';
      g.fillRect(w / 2 - 3, 2, 6, 6);
    }
  });
}

/* Low street-level buildings: a couple of window rows and a bright
   storefront band, sized for boxes only a few meters tall. */
export function makeBuildingTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#101318';
    g.fillRect(0, 0, w, h);
    const cols = 7;
    const rows = 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.random() < 0.4) {
          g.fillStyle = Math.random() < 0.7 ? 'rgba(255,190,110,0.9)' : 'rgba(170,200,255,0.85)';
          g.fillRect((x * w) / cols + 5, (y * (h * 0.6)) / rows + 8, w / cols - 10, (h * 0.6) / rows - 14);
        }
      }
    }
    /* storefront band with a sign block */
    if (Math.random() < 0.75) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(200,225,255,0.9)' : 'rgba(255,220,150,0.9)';
      g.fillRect(0, h - 34, w, 34);
      g.fillStyle = ['#c04a3a', '#3a6ac0', '#3aa06a', '#c0983a'][Math.floor(Math.random() * 4)];
      const sx = Math.random() * (w - 70);
      g.fillRect(sx, h - 30, 60, 22);
    }
  });
}

/* Night river: near-black water with vertical smears of reflected city light. */
export function makeWaterTexture() {
  const t = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#0a1216';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const len = 40 + Math.random() * 160;
      const y = Math.random() * h;
      const warm = Math.random() < 0.6;
      g.strokeStyle = warm
        ? `rgba(255,180,90,${0.10 + Math.random() * 0.2})`
        : `rgba(160,200,255,${0.08 + Math.random() * 0.16})`;
      g.lineWidth = 1.5 + Math.random() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() * 4 - 2), y + len);
      g.stroke();
    }
    /* faint ripple bands */
    g.fillStyle = 'rgba(255,255,255,0.02)';
    for (let y = 0; y < h; y += 9) g.fillRect(0, y, w, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Bare ground / embankment under sections with no street. */
export function makeBareTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#171a16';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,46,36' : '10,12,10'},${Math.random() * 0.5})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
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
    girder: new THREE.MeshLambertMaterial({ map: makeGirderTexture() }),
    girderPlain: new THREE.MeshLambertMaterial({ color: 0x52633f }),
    concrete: new THREE.MeshLambertMaterial({ map: makeConcreteTexture() }),
    capConcrete: new THREE.MeshLambertMaterial({ map: makeCapTexture() }),
    walk: new THREE.MeshLambertMaterial({ color: 0x35373a }),
    ground: new THREE.MeshLambertMaterial({ color: 0x14161a }),
    /* unlit: the reflected city light should glow regardless of lamps */
    water: new THREE.MeshBasicMaterial({ map: makeWaterTexture() }),
    bare: new THREE.MeshLambertMaterial({ map: makeBareTexture() }),
    rail: new THREE.MeshLambertMaterial({ color: 0x6b7075 }),
    glow: new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false }),
    lampHead: new THREE.MeshBasicMaterial({ color: 0xffc27a }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    head: new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    orb: new THREE.MeshBasicMaterial({ color: 0xffb84d }),
  };
}
