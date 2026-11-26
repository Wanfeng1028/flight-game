// World model for Skylark Run: an island chain in open sea, a home runway,
// two island airstrips, a canyon channel, and the ring geometry missions fly.
// All distances in metres, heights in metres above sea level (sea = 0).

import { clamp, lerp, smoothstep, valueNoise } from './util.js';

export const SEA_LEVEL = 0;
export const RUNWAY_ELEV = 8;

// Island bumps: gaussian hills rising out of the sea.
const ISLANDS = [
  { x: 0, z: 0, radius: 300, peak: 30 }, // home island
  { x: -300, z: 430, radius: 210, peak: 44 },
  { x: 330, z: 720, radius: 250, peak: 58 },
  { x: -140, z: 1020, radius: 190, peak: 34 },
  { x: 180, z: 1300, radius: 230, peak: 48 },
  { x: -420, z: 900, radius: 170, peak: 38 },
  { x: 520, z: 250, radius: 160, peak: 26 },
  { x: -160, z: -420, radius: 200, peak: 36 },
  { x: 260, z: -380, radius: 180, peak: 30 },
];

// Runways: flat strips carved into the terrain. Heading 0 means along +Z.
export const RUNWAYS = {
  home: { name: 'Skylark Field', x: 0, z: 0, heading: 0, length: 340, width: 26, elev: RUNWAY_ELEV },
  north: { name: 'North Strip', x: 330, z: 720, heading: 0, length: 230, width: 20, elev: 14 },
  west: { name: 'West Strip', x: -140, z: 1020, heading: 0, length: 230, width: 20, elev: 12 },
};

function islandHeight(x, z) {
  let h = -5; // sea floor
  for (const isl of ISLANDS) {
    const dx = (x - isl.x) / isl.radius;
    const dz = (z - isl.z) / isl.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < 4) h += isl.peak * Math.exp(-d2 * 1.6);
  }
  return h;
}

function canyonHeight(x, z) {
  // Two long rock walls with a flyable channel between them, z 560..1260.
  const along = smoothstep(520, 620, z) * (1 - smoothstep(1180, 1290, z));
  if (along <= 0) return 0;
  const wall = Math.exp(-Math.pow((Math.abs(x) - 105) / 52, 2));
  return 74 * wall * along;
}

function flattenNearRunway(h, x, z) {
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const dx = Math.abs(x - r.x);
    const dz = Math.abs(z - r.z);
    const inside = smoothstep(r.width / 2 + 55, r.width / 2 + 8, dx) * smoothstep(r.length / 2 + 55, r.length / 2 + 8, dz);
    if (inside > 0) h = lerp(h, r.elev, inside);
  }
  return h;
}

export function terrainHeight(x, z) {
  let h = islandHeight(x, z) + canyonHeight(x, z);
  const landMask = clamp(h / 12, 0, 1);
  h += valueNoise(x, z) * 5 * landMask;
  h = flattenNearRunway(h, x, z);
  return h;
}

export function isWater(x, z) {
  return terrainHeight(x, z) < 0.5;
}

// Which runway (if any) the point is over, and the lateral offset from its centreline.
export function runwayUnder(x, z) {
  for (const key of Object.keys(RUNWAYS)) {
    const r = RUNWAYS[key];
    const dx = Math.abs(x - r.x);
    const dz = Math.abs(z - r.z);
    if (dx < r.width / 2 + 2 && dz < r.length / 2) return { key, runway: r, lateral: x - r.x };
  }
  return null;
}

// A ring is a glowing hoop in a vertical plane. normal points along the approach.
export function makeRing(x, y, z, radius, nx, nz) {
  const len = Math.hypot(nx, nz) || 1;
  return { x, y, z, radius, nx: nx / len, nz: nz / len, passed: false };
}

// Signed distance of a point from a ring's plane; crossing zero = passing through.
export function ringPlaneDistance(ring, px, py, pz) {
  return (px - ring.x) * ring.nx + (pz - ring.z) * ring.nz;
}

export function ringMissDistance(ring, px, py, pz) {
  const dx = px - ring.x;
  const dy = py - ring.y;
  const dz = pz - ring.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
