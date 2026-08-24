'use strict';
// ---------------------------------------------------------------- utilities

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function dist2(ax, ay, az, bx, by, bz) {
  const dx = ax - bx, dy = ay - by, dz = az - bz;
  return dx * dx + dy * dy + dz * dz;
}

// Mulberry32 seeded PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D lattice hash -> [0,1)
function hash2(seed, x, y) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hash3(seed, x, y, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// smooth value noise
function noise2(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi);
  const a = hash2(seed, xi, yi), b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1), d = hash2(seed, xi + 1, yi + 1);
  return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
}
function noise3(seed, x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi), zf = smoothstep(z - zi);
  const c000 = hash3(seed, xi, yi, zi), c100 = hash3(seed, xi + 1, yi, zi);
  const c010 = hash3(seed, xi, yi + 1, zi), c110 = hash3(seed, xi + 1, yi + 1, zi);
  const c001 = hash3(seed, xi, yi, zi + 1), c101 = hash3(seed, xi + 1, yi, zi + 1);
  const c011 = hash3(seed, xi, yi + 1, zi + 1), c111 = hash3(seed, xi + 1, yi + 1, zi + 1);
  return lerp(
    lerp(lerp(c000, c100, xf), lerp(c010, c110, xf), yf),
    lerp(lerp(c001, c101, xf), lerp(c011, c111, xf), yf), zf);
}
// fractal noise, returns roughly [0,1]
function fbm2(seed, x, y, octaves, lacunarity, gain) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(seed + i * 1013, x * freq, y * freq);
    norm += amp; amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- matrices (column-major 4x4)
const Mat4 = {
  identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect; out[5] = f;
    out[10] = (far + near) / (near - far); out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    return out;
  },
  multiply(out, a, b) {
    const r = new Float32Array(16);
    for (let c = 0; c < 4; c++)
      for (let ro = 0; ro < 4; ro++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + ro] * b[c * 4 + k];
        r[c * 4 + ro] = s;
      }
    out.set(r); return out;
  },
  // view matrix from position + pitch/yaw
  fpsView(out, x, y, z, pitch, yaw) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    // camera basis
    const xa = [cy, 0, -sy];
    const ya = [sy * sp, cp, cy * sp];
    const za = [sy * cp, -sp, cy * cp];
    out.set([
      xa[0], ya[0], za[0], 0,
      xa[1], ya[1], za[1], 0,
      xa[2], ya[2], za[2], 0,
      -(xa[0] * x + xa[1] * y + xa[2] * z),
      -(ya[0] * x + ya[1] * y + ya[2] * z),
      -(za[0] * x + za[1] * y + za[2] * z), 1]);
    return out;
  },
};

// frustum culling: extract planes from proj*view
function frustumPlanes(m) {
  const p = [];
  const row = (i) => [m[i], m[4 + i], m[8 + i], m[12 + i]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const add = (a, b, sgn) => p.push([r3[0] + sgn * a[0], r3[1] + sgn * a[1], r3[2] + sgn * a[2], r3[3] + sgn * a[3]].map((v, i) => v));
  add(r0, r3, 1); add(r0, r3, -1);
  add(r1, r3, 1); add(r1, r3, -1);
  add(r2, r3, 1); add(r2, r3, -1);
  return p;
}
function boxInFrustum(planes, x0, y0, z0, x1, y1, z1) {
  for (const pl of planes) {
    const px = pl[0] > 0 ? x1 : x0;
    const py = pl[1] > 0 ? y1 : y0;
    const pz = pl[2] > 0 ? z1 : z0;
    if (pl[0] * px + pl[1] * py + pl[2] * pz + pl[3] < 0) return false;
  }
  return true;
}
