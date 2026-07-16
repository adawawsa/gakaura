import data from './c1path.json';
import terrain from './c1terrain.json';

/* The real Shuto C1 inner-loop alignment, sampled every `step` meters.
   Source: © OpenStreetMap contributors (ODbL). */
const pts = data.points;
const N = pts.length;
const STEP = data.step;
export const LOOP_LEN = N * STEP;

/* per-point unit tangents (central difference over the closed loop) */
const tans = new Array(N);
for (let i = 0; i < N; i++) {
  const p = pts[(i - 1 + N) % N];
  const q = pts[(i + 1) % N];
  const tx = q[0] - p[0];
  const tz = q[1] - p[1];
  const l = Math.hypot(tx, tz) || 1;
  tans[i] = [tx / l, tz / l];
}

/* per-point curve radius over a ~20 m span, for hiding things that
   can't follow tight corners */
const radii = new Array(N);
for (let i = 0; i < N; i++) {
  const a = pts[(i - 2 + N) % N];
  const b = pts[i];
  const c = pts[(i + 2) % N];
  const A = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const B = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const C = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  radii[i] = area > 1e-6 ? (A * B * C) / (4 * area) : 1e9;
}

function wrap(s) {
  return ((s % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
}

/* Signed shortest arc distance from b to a on the loop. */
export function arcDelta(a, b) {
  let d = wrap(a) - wrap(b);
  if (d > LOOP_LEN / 2) d -= LOOP_LEN;
  if (d < -LOOP_LEN / 2) d += LOOP_LEN;
  return d;
}

/* Position + orientation of the track at arc length s.
   `nx/nz` point to the driver's right; `yaw` is the three.js rotation.y
   that aims an object built facing -z along the track. */
export function frame(s, out = {}) {
  const f = wrap(s) / STEP;
  const i = Math.floor(f) % N;
  const t = f - Math.floor(f);
  const a = pts[i];
  const b = pts[(i + 1) % N];
  const ta = tans[i];
  const tb = tans[(i + 1) % N];
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  let tx = ta[0] + (tb[0] - ta[0]) * t;
  let tz = ta[1] + (tb[1] - ta[1]) * t;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  out.tx = tx;
  out.tz = tz;
  out.nx = -tz;
  out.nz = tx;
  out.yaw = Math.atan2(-tx, -tz);
  return out;
}

export function radiusAt(s) {
  return radii[Math.floor(wrap(s) / STEP) % N];
}

/* What lies under the deck at arc s: 0 = street, 1 = water, 2 = bare ground.
   Derived from OSM surface roads and water polygons. */
export function terrainAt(s) {
  return terrain[Math.floor(wrap(s) / STEP) % N];
}
