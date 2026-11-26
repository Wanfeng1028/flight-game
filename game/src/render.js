// World rendering for Skylark Run: sky, sun and clouds, the sea, a projected
// terrain mesh coloured by height, runways, glowing rings, and the jet itself,
// drawn as layered shapes with shading so it reads as built, not flat.

import { clamp, lerp, smoothstep, makeRng, valueNoise } from './util.js';
import { terrainHeight, RUNWAYS, SEA_LEVEL } from './world.js';
import { project, horizonY, cameraBasis } from './camera.js';

const rng = makeRng(20261126);
const CLOUDS = [];
for (let i = 0; i < 16; i++) {
  CLOUDS.push({
    x: (rng() - 0.5) * 2600,
    y: 180 + rng() * 160,
    z: -300 + rng() * 2200,
    s: 60 + rng() * 90,
  });
}

function skyGradient(ctx, w, h, horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1d4e89');
  g.addColorStop(0.42, '#5f9fd0');
  g.addColorStop(0.58, '#bcd9ea');
  g.addColorStop(0.62, '#e8f2f6');
  g.addColorStop(1, '#7fb3d5');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  void horizon;
}

function drawSun(ctx, cam, basis) {
  const p = project(cam, basis, basis.pos.x + basis.fwd.x * 3000 - 900, 900, basis.pos.z + basis.fwd.z * 3000);
  if (!p) return;
  const r = 46 * p.scale * 0.12 + 26;
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r * 2.6);
  glow.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 220, 130, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, cam, basis) {
  ctx.save();
  for (const c of CLOUDS) {
    const p = project(cam, basis, c.x, c.y, c.z);
    if (!p || p.x < -200 || p.x > cam.width + 200 || p.y < -80 || p.y > cam.height) continue;
    const s = c.s * p.scale * 0.12;
    if (s < 4) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - s * 0.55, p.y + s * 0.1, s * 0.6, s * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + s * 0.55, p.y + s * 0.08, s * 0.65, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function terrainColor(h, slope) {
  if (h < 1.2) return '#d9c48a'; // sand
  if (h < 26) {
    const t = clamp((h - 1.2) / 24, 0, 1);
    return mixColor('#7da95c', '#5d8a48', t, slope);
  }
  if (h < 55) return mixColor('#6f7a68', '#565d52', clamp((h - 26) / 29, 0, 1), slope);
  return mixColor('#8a8f96', '#c9ccd2', clamp((h - 55) / 30, 0, 1), slope);
}

function mixColor(a, b, t, slope) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  let r = lerp((pa >> 16) & 255, (pb >> 16) & 255, t);
  let g = lerp((pa >> 8) & 255, (pb >> 8) & 255, t);
  let bl = lerp(pa & 255, pb & 255, t);
  const shade = 1 - slope * 0.35;
  r *= shade; g *= shade; bl *= shade;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

function drawTerrain(ctx, cam, basis, plane) {
  const step = 34;
  const half = 340;
  const ahead = 760;
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  const rx = Math.cos(plane.heading);
  const rz = -Math.sin(plane.heading);
  const ox = plane.x - fx * 60;
  const oz = plane.z - fz * 60;
  const quads = [];
  const nx = Math.ceil((half * 2) / step);
  const nz = Math.ceil(ahead / step);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * step - 0;
      const b = (ix - nx / 2) * step;
      const corners = [
        [ox + fx * a + rx * b, oz + fz * a + rz * b],
        [ox + fx * a + rx * (b + step), oz + fz * a + rz * (b + step)],
        [ox + fx * (a + step) + rx * (b + step), oz + fz * (a + step) + rz * (b + step)],
        [ox + fx * (a + step) + rx * b, oz + fz * (a + step) + rz * b],
      ];
      const hs = corners.map(([x, z]) => terrainHeight(x, z));
      const hMax = Math.max(...hs);
      if (hMax < 0.4) continue; // open sea: the sea fill shows through
      const cx = ox + fx * (a + step / 2) + rx * (b + step / 2);
      const cz = oz + fz * (a + step / 2) + rz * (b + step / 2);
      const depth = (cx - basis.pos.x) * basis.fwd.x + (cz - basis.pos.z) * basis.fwd.z;
      if (depth < 2) continue;
      const slope = clamp((Math.max(...hs) - Math.min(...hs)) / step, 0, 1);
      quads.push({ corners, hs, hAvg: hs.reduce((s, v) => s + v, 0) / 4, slope, depth });
    }
  }
  quads.sort((p, q) => q.depth - p.depth);
  for (const q of quads) {
    const pts = q.corners.map(([x, z], i) => project(cam, basis, x, q.hs[i], z));
    if (pts.some((p) => !p)) continue;
    ctx.fillStyle = terrainColor(q.hAvg, q.slope);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSea(ctx, cam, basis, horizon) {
  const g = ctx.createLinearGradient(0, horizon, 0, cam.height);
  g.addColorStop(0, '#9fc8dd');
  g.addColorStop(0.35, '#3f7ea6');
  g.addColorStop(1, '#1d4f74');
  ctx.fillStyle = g;
  ctx.fillRect(0, Math.max(0, horizon), cam.width, cam.height - Math.max(0, horizon));
  // Sun glitter on the water.
  ctx.fillStyle = 'rgba(255, 240, 190, 0.10)';
  for (let i = 0; i < 5; i++) {
    const y = horizon + 30 + i * ((cam.height - horizon) / 5);
    ctx.fillRect(cam.width * 0.42, y, cam.width * 0.16, 2);
  }
}

function drawRunway(ctx, cam, basis, runway, label) {
  const halfL = runway.length / 2;
  const halfW = runway.width / 2;
  const fx = Math.sin(runway.heading);
  const fz = Math.cos(runway.heading);
  const rx = Math.cos(runway.heading);
  const rz = -Math.sin(runway.heading);
  const corner = (along, side) => {
    const x = runway.x + fx * along + rx * side;
    const z = runway.z + fz * along + rz * side;
    return project(cam, basis, x, runway.elev + 0.3, z);
  };
  const c1 = corner(-halfL, -halfW);
  const c2 = corner(halfL, -halfW);
  const c3 = corner(halfL, halfW);
  const c4 = corner(-halfL, halfW);
  if (!c1 || !c2 || !c3 || !c4) return;
  ctx.fillStyle = '#2e3238';
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = '#f2f2f2';
  for (let d = -halfL + 12; d < halfL - 8; d += 26) {
    const a = project(cam, basis, runway.x + fx * d, runway.elev + 0.45, runway.z + fz * d);
    const b = project(cam, basis, runway.x + fx * (d + 13), runway.elev + 0.45, runway.z + fz * (d + 13));
    if (!a || !b) continue;
    const wdt = Math.max(1.5, 1.1 * a.scale);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = wdt;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Threshold bars at both ends.
  ctx.strokeStyle = '#f2f2f2';
  ctx.lineWidth = Math.max(1.5, 2.4 * c1.scale);
  for (const end of [-halfL + 6, halfL - 6]) {
    const a = project(cam, basis, runway.x + fx * end + rx * -halfW * 0.8, runway.elev + 0.45, runway.z + fz * end + rz * -halfW * 0.8);
    const b = project(cam, basis, runway.x + fx * end + rx * halfW * 0.8, runway.elev + 0.45, runway.z + fz * end + rz * halfW * 0.8);
    if (!a || !b) continue;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // Name tag floating over the strip when it is near.
  const mid = project(cam, basis, runway.x, runway.elev + 16, runway.z);
  if (mid && mid.depth < 900 && label) {
    ctx.font = `600 ${Math.max(11, Math.min(17, 15 * mid.scale * 0.12 + 9))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(label, mid.x, mid.y);
  }
}

function drawRing(ctx, cam, basis, ring, index, isNext) {
  const pts = [];
  // Circle in the ring's vertical plane: one axis horizontal across, one up.
  const ax = { x: ring.nz, y: 0, z: -ring.nx };
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const wx = ring.x + ax.x * Math.cos(a) * ring.radius;
    const wy = ring.y + Math.sin(a) * ring.radius;
    const wz = ring.z + ax.z * Math.cos(a) * ring.radius;
    const p = project(cam, basis, wx, wy, wz);
    if (!p) return;
    pts.push(p);
  }
  const glow = ring.passed ? '#37d67a' : isNext ? '#ffc93c' : '#ff8f3c';
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(2, 5 * pts[0].scale * 0.1 + 2);
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  // Number tag above the ring.
  const top = project(cam, basis, ring.x, ring.y + ring.radius + 6, ring.z);
  if (top && top.depth < 1200) {
    ctx.font = `700 ${Math.max(12, Math.min(20, 13 * top.scale * 0.1 + 8))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ring.passed ? '#37d67a' : '#ffffff';
    ctx.fillText(String(index + 1), top.x, top.y);
  }
}

// The jet, drawn in screen space from a rear three-quarter chase view: nose
// away from the camera, wings spread, tail fin up, twin exhausts near.
// Layered shapes, shading and lights so it reads as a built machine.
export function drawJet(ctx, cam, plane, timeMs) {
  const cx = cam.width / 2;
  const cy = cam.height * 0.60 + plane.pitch * 160;
  const s = Math.min(cam.width, cam.height) / 720;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.bank);
  ctx.scale(s, s);
  const W = 150; // half wingspan on screen

  // Tail fin, red with white letters.
  ctx.fillStyle = '#c33d2e';
  ctx.beginPath();
  ctx.moveTo(-11, -28); ctx.lineTo(-16, -80); ctx.lineTo(-5, -88); ctx.lineTo(7, -72); ctx.lineTo(11, -28);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SK', 0, -52);

  // Tailplane, small wings near the tail.
  const tail = ctx.createLinearGradient(0, -30, 0, 10);
  tail.addColorStop(0, '#dfe8f2');
  tail.addColorStop(1, '#93a5bb');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(-8, -18); ctx.lineTo(-78, 2); ctx.lineTo(-68, 10); ctx.lineTo(-6, 2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -18); ctx.lineTo(78, 2); ctx.lineTo(68, 10); ctx.lineTo(6, 2);
  ctx.closePath(); ctx.fill();

  // Main wings, swept back toward the camera.
  const wing = ctx.createLinearGradient(0, -10, 0, 60);
  wing.addColorStop(0, '#e6edf5');
  wing.addColorStop(1, '#8ba0b8');
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(-16, -6); ctx.lineTo(-W, 40); ctx.lineTo(-W + 14, 52); ctx.lineTo(-8, 30);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -6); ctx.lineTo(W, 40); ctx.lineTo(W - 14, 52); ctx.lineTo(8, 30);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,60,90,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-90, 26); ctx.lineTo(-40, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(90, 26); ctx.lineTo(40, 8); ctx.stroke();

  // Fuselage: a tapered body, nose far away, tail near the camera.
  const body = ctx.createLinearGradient(-16, 0, 16, 0);
  body.addColorStop(0, '#7d92ab');
  body.addColorStop(0.35, '#eef3f8');
  body.addColorStop(0.7, '#c3d2e2');
  body.addColorStop(1, '#5d7189');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-15, 72);
  ctx.quadraticCurveTo(-17, 10, -11, -62);
  ctx.quadraticCurveTo(-7, -92, 0, -96);
  ctx.quadraticCurveTo(7, -92, 11, -62);
  ctx.quadraticCurveTo(17, 10, 15, 72);
  ctx.quadraticCurveTo(0, 80, -15, 72);
  ctx.closePath(); ctx.fill();
  // Centre spine line.
  ctx.strokeStyle = 'rgba(40,60,90,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -88); ctx.lineTo(0, 70); ctx.stroke();

  // Canopy glass with a glint.
  const glass = ctx.createLinearGradient(-8, -58, 8, -30);
  glass.addColorStop(0, '#bfe6ff');
  glass.addColorStop(0.5, '#3f7fb8');
  glass.addColorStop(1, '#16324a');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -44, 8, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-4, -52); ctx.lineTo(3, -38); ctx.stroke();

  // Twin engine exhausts, glowing harder with throttle.
  for (const side of [-1, 1]) {
    const ex = side * 13;
    const glowA = 0.25 + plane.throttle * 0.6;
    const eg = ctx.createRadialGradient(ex, 74, 2, ex, 74, 24 + plane.throttle * 20);
    eg.addColorStop(0, `rgba(255, 190, 90, ${glowA})`);
    eg.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, 74, 24 + plane.throttle * 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c222c';
    ctx.beginPath(); ctx.arc(ex, 72, 6, 0, Math.PI * 2); ctx.fill();
  }

  // Wingtip navigation lights, red blinking on the left.
  const blink = (timeMs % 900) < 500;
  if (blink) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(-W + 4, 46, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#2fd05a';
  ctx.beginPath(); ctx.arc(W - 4, 46, 4, 0, Math.PI * 2); ctx.fill();

  // Landing gear when down.
  if (plane.gearDown) {
    ctx.strokeStyle = '#2c3644';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, 58); ctx.lineTo(-24, 84);
    ctx.moveTo(18, 58); ctx.lineTo(24, 84);
    ctx.stroke();
    ctx.fillStyle = '#1c222c';
    ctx.beginPath(); ctx.arc(-24, 87, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(24, 87, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function renderWorld(ctx, cam, plane, rings, nextRing, timeMs) {
  const basis = cameraBasis(plane);
  const horizon = horizonY(cam, basis);
  skyGradient(ctx, cam.width, cam.height, horizon);
  drawSun(ctx, cam, basis);
  drawClouds(ctx, cam, basis);
  drawSea(ctx, cam, basis, horizon);
  drawTerrain(ctx, cam, basis, plane);
  drawRunway(ctx, cam, basis, RUNWAYS.home, 'Skylark Field');
  drawRunway(ctx, cam, basis, RUNWAYS.north, 'North Strip');
  drawRunway(ctx, cam, basis, RUNWAYS.west, 'West Strip');
  rings.forEach((ring, i) => drawRing(ctx, cam, basis, ring, i, i === nextRing));
  drawJet(ctx, cam, plane, timeMs);
  void SEA_LEVEL;
  void valueNoise;
  void smoothstep;
}
