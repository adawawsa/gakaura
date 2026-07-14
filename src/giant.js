import * as THREE from 'three';

/* A low-poly giant, built standing on y=0 facing -z, with joint pivots
   exposed so the run cycle can be driven procedurally. */
export function makeGiant() {
  const skin = new THREE.MeshLambertMaterial({ color: 0xc7a184 });
  const skinDark = new THREE.MeshLambertMaterial({ color: 0xa07f62 });
  const shorts = new THREE.MeshLambertMaterial({ color: 0x2a2d35 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x241a12 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xffd27a });

  const g = new THREE.Group();

  /* torso + pelvis */
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), shorts);
  pelvis.position.y = 1.85;
  g.add(pelvis);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.95, 0.55), skin);
  torso.position.y = 2.55;
  g.add(torso);

  /* head with hair and glowing eyes */
  const headG = new THREE.Group();
  headG.position.y = 3.25;
  g.add(headG);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.48), skin);
  headG.add(head);
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.22, 0.52), hair);
  hairCap.position.y = 0.2;
  headG.add(hairCap);
  const eyeGeo = new THREE.BoxGeometry(0.09, 0.05, 0.03);
  for (const x of [-0.11, 0.11]) {
    const e = new THREE.Mesh(eyeGeo, eye);
    e.position.set(x, 0.04, -0.25);
    headG.add(e);
  }

  /* legs: hip pivot -> thigh -> knee pivot -> shin + foot */
  function makeLeg(sideX) {
    const hip = new THREE.Group();
    hip.position.set(sideX, 1.7, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.85, 0.4), skinDark);
    thigh.position.y = -0.45;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.9;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.32), skin);
    shin.position.y = -0.4;
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.55), skinDark);
    foot.position.set(0, -0.82, -0.1);
    knee.add(foot);
    g.add(hip);
    return { hip, knee };
  }

  /* arms: shoulder pivot -> upper arm -> elbow pivot -> forearm */
  function makeArm(sideX) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sideX, 2.9, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), skin);
    upper.position.y = -0.35;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.72;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.26), skinDark);
    fore.position.y = -0.32;
    elbow.add(fore);
    g.add(shoulder);
    return { shoulder, elbow };
  }

  const legL = makeLeg(-0.28);
  const legR = makeLeg(0.28);
  const armL = makeArm(-0.68);
  const armR = makeArm(0.68);

  return {
    group: g,
    torso,
    pelvis,
    head: headG,
    legL,
    legR,
    armL,
    armR,
    height: 3.5,
  };
}

/* Drives the giant's pose. phase advances with distance; airPose 0..1
   blends between the run cycle and a mid-air leap pose. */
export function poseGiant(giant, phase, airPose, speedRatio) {
  const swing = 0.72 + 0.3 * speedRatio;
  const sL = Math.sin(phase);
  const sR = Math.sin(phase + Math.PI);

  /* run cycle — knees stay extended through stance (leg vertical, foot on
     the deck) and fold during recovery, just after toe-off */
  const runHipL = swing * sL;
  const runHipR = swing * sR;
  const runKneeL = Math.max(0, Math.sin(phase - 2.2)) * (1.15 + 0.4 * speedRatio);
  const runKneeR = Math.max(0, Math.sin(phase + Math.PI - 2.2)) * (1.15 + 0.4 * speedRatio);
  const runShL = swing * 0.75 * sR;
  const runShR = swing * 0.75 * sL;

  /* leap pose: front leg tucked forward, rear leg trailing, arms thrown */
  const leapHipL = -0.9;
  const leapHipR = 0.7;
  const leapKneeL = 1.5;
  const leapKneeR = 0.3;
  const leapShL = -0.9;
  const leapShR = 1.1;

  const mix = (a, b) => a + (b - a) * airPose;

  /* negative rotation.x swings a limb toward -z (the direction of travel);
     knees fold positive so the heel kicks up behind */
  giant.legL.hip.rotation.x = mix(runHipL, leapHipL);
  giant.legR.hip.rotation.x = mix(runHipR, leapHipR);
  giant.legL.knee.rotation.x = mix(runKneeL, leapKneeL);
  giant.legR.knee.rotation.x = mix(runKneeR, leapKneeR);
  giant.armL.shoulder.rotation.x = mix(runShL, leapShL);
  giant.armR.shoulder.rotation.x = mix(runShR, leapShR);
  giant.armL.elbow.rotation.x = -(1.1 + 0.3 * Math.max(0, -sR));
  giant.armR.elbow.rotation.x = -(1.1 + 0.3 * Math.max(0, -sL));

  /* forward lean and head bob */
  giant.torso.rotation.x = -(0.22 + 0.1 * speedRatio) + airPose * 0.15;
  giant.pelvis.rotation.x = -0.1;
  giant.head.rotation.x = -0.15 + 0.05 * Math.sin(phase * 2);

  /* the flight moments between footfalls read naturally for a sprint,
     so the body height stays put */
  giant.group.position.y = 0;
}
