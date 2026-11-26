// Chase camera for Skylark Run: sits behind and above the aircraft, rolls
// gently with its bank, and projects world points onto the canvas.

import { clamp } from './util.js';

export function makeCamera(width, height) {
  return { width, height, focal: Math.min(width, height) * 0.92 };
}

export function cameraBasis(plane) {
  const cp = Math.cos(plane.pitch);
  const fwd = {
    x: Math.sin(plane.heading) * cp,
    y: Math.sin(plane.pitch),
    z: Math.cos(plane.heading) * cp,
  };
  // Camera sits behind the jet and a little above it.
  const pos = {
    x: plane.x - fwd.x * 17,
    y: plane.y - fwd.y * 17 + 5.2,
    z: plane.z - fwd.z * 17,
  };
  const look = {
    x: plane.x + fwd.x * 34,
    y: plane.y + fwd.y * 34 + 1.5,
    z: plane.z + fwd.z * 34,
  };
  let f = norm({
    x: look.x - pos.x,
    y: look.y - pos.y,
    z: look.z - pos.z,
  });
  // Right = forward x world-up, then up = right x forward.
  let r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  let u = cross(r, f);
  // Roll the camera with a third of the jet's bank so the horizon tilts.
  const roll = plane.bank * 0.35;
  const cos = Math.cos(roll);
  const sin = Math.sin(roll);
  const r2 = {
    x: r.x * cos + u.x * sin,
    y: r.y * cos + u.y * sin,
    z: r.z * cos + u.z * sin,
  };
  const u2 = {
    x: u.x * cos - r.x * sin,
    y: u.y * cos - r.y * sin,
    z: u.z * cos - r.z * sin,
  };
  return { pos, fwd: f, right: r2, up: u2 };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// Project a world point. Returns null when it is behind the camera.
export function project(cam, basis, wx, wy, wz) {
  const dx = wx - basis.pos.x;
  const dy = wy - basis.pos.y;
  const dz = wz - basis.pos.z;
  const cz = dx * basis.fwd.x + dy * basis.fwd.y + dz * basis.fwd.z;
  if (cz < 1.5) return null;
  const cx = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
  const cy = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
  const scale = cam.focal / cz;
  return {
    x: cam.width / 2 + cx * scale,
    y: cam.height / 2 - cy * scale,
    scale,
    depth: cz,
  };
}

export function horizonY(cam, basis) {
  // Where the sea plane meets the sky: project a far point at sea level.
  const far = project(cam, basis, basis.pos.x + basis.fwd.x * 4000, 0, basis.pos.z + basis.fwd.z * 4000);
  return far ? clamp(far.y, -40, cam.height + 40) : cam.height * 0.42;
}
