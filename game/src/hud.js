// Heads-up display and screens for Skylark Run: lit instruments, compass and
// speed/altitude tapes, fuel and damage, mission banner, menus and overlays.
// Everything is drawn on the same canvas as the world.

import { clamp, radToDeg, wrapAngle } from './util.js';
import { knots, feetAlt } from './aircraft.js';
import { missionObjective, formatTime } from './missions.js';

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(10, 18, 30, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 200, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function gaugeLabel(ctx, x, y, text, color = '#9fd0ff') {
  ctx.fillStyle = color;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function bigReadout(ctx, x, y, value, unit, align = 'left') {
  ctx.textAlign = align;
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(String(value), x, y);
  ctx.fillStyle = '#9fd0ff';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(unit, align === 'left' ? x + ctx.measureText(String(value)).width + 6 : x - ctx.measureText(String(value)).width - 6, y);
  ctx.textAlign = 'left';
}

export function drawHud(ctx, cam, plane, mission, nowMs) {
  const w = cam.width;
  const h = cam.height;

  // Compass tape across the top: heading readout on its own line above the ticks.
  const headingDeg = (radToDeg(wrapAngle(plane.heading)) + 360) % 360;
  panel(ctx, w / 2 - 190, 10, 380, 56);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(headingDeg)).padStart(3, '0') + '°', w / 2, 27);
  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - 190, 32, 380, 34);
  ctx.clip();
  ctx.fillStyle = '#9fd0ff';
  ctx.font = '600 12px system-ui, sans-serif';
  for (let d = -60; d <= 60; d += 10) {
    const hd = Math.round((headingDeg + d) / 10) * 10;
    const off = ((hd - headingDeg + 540) % 360) - 180;
    const x = w / 2 + off * 2.6;
    const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[((hd % 360) + 360) % 360];
    ctx.fillText(label || String(((hd % 360) + 360) % 360), x, 60);
    ctx.fillRect(x - 0.5, 36, 1, label ? 10 : 6);
  }
  ctx.restore();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(w / 2, 32); ctx.lineTo(w / 2 - 6, 42); ctx.lineTo(w / 2 + 6, 42);
  ctx.closePath(); ctx.fill();
  ctx.textAlign = 'left';

  // Airspeed, left.
  panel(ctx, 12, 12, 132, 74);
  gaugeLabel(ctx, 24, 30, 'AIRSPEED');
  bigReadout(ctx, 24, 62, knots(plane), 'KT');
  const vs = plane.verticalSpeed;
  ctx.fillStyle = vs >= 0 ? '#37d67a' : '#ff8f3c';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText((vs >= 0 ? '+' : '') + vs.toFixed(1) + ' m/s', 24, 78);

  // Altitude, right.
  panel(ctx, w - 144, 12, 132, 74);
  gaugeLabel(ctx, w - 132, 30, 'ALTITUDE');
  bigReadout(ctx, w - 132, 62, Math.max(0, Math.round(plane.y)), 'M');
  ctx.fillStyle = '#9fd0ff';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(feetAlt(plane) + ' FT', w - 132, 78);

  // Mission banner under the compass.
  panel(ctx, w / 2 - 210, 74, 420, 30, 0.6);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${mission.def.name}  ·  ${missionObjective(mission)}`, w / 2, 94);
  ctx.textAlign = 'left';

  // Attitude ball, bottom centre.
  const ax = w / 2;
  const ay = h - 78;
  const ar = 46;
  ctx.save();
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-plane.bank);
  ctx.translate(0, plane.pitch * 220);
  ctx.fillStyle = '#3f7fb8';
  ctx.fillRect(-ar, -ar * 2, ar * 2, ar * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-ar, 0, ar * 2, ar * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-ar, 0); ctx.lineTo(ar, 0); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(200,230,255,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ax, ay, ar, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.fillRect(ax - 16, ay - 2, 12, 4);
  ctx.fillRect(ax + 4, ay - 2, 12, 4);
  ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.fill();

  // Throttle + fuel + damage, bottom left.
  panel(ctx, 12, h - 118, 210, 106);
  gaugeLabel(ctx, 24, h - 98, 'THROTTLE');
  bar(ctx, 24, h - 92, 186, 10, plane.throttle, '#37b6ff');
  gaugeLabel(ctx, 24, h - 66, 'FUEL');
  bar(ctx, 24, h - 60, 186, 10, plane.fuel / 100, plane.fuel < 20 ? '#ff5a4a' : '#37d67a');
  gaugeLabel(ctx, 24, h - 34, 'DAMAGE');
  bar(ctx, 24, h - 28, 186, 10, plane.damage / 100, '#ff8f3c');
  if (plane.fuel < 20 && Math.floor(nowMs / 500) % 2 === 0) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('LOW FUEL', 24, h - 124);
  }

  // Gear / flaps / wind / time, bottom right, one row each.
  panel(ctx, w - 222, h - 136, 210, 124);
  statusLight(ctx, w - 210, h - 110, 'GEAR', plane.gearDown ? 'DOWN' : 'UP', plane.gearDown);
  statusLight(ctx, w - 210, h - 84, 'FLAPS', plane.flaps ? 'ON' : 'OFF', plane.flaps);
  ctx.fillStyle = '#9fd0ff';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`WIND ${Math.round(Math.hypot(plane.windX, plane.windZ))} m/s`, w - 210, h - 58);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText(`TIME ${formatTime(mission.time)}`, w - 210, h - 34);
  ctx.fillStyle = '#ffc93c';
  ctx.fillText(`SCORE ${mission.score}`, w - 210, h - 16);

  // Centre flash message.
  if (mission.message && nowMs - mission.messageAt < 2200) {
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,18,30,0.55)';
    const tw = ctx.measureText(mission.message).width;
    ctx.fillRect(w / 2 - tw / 2 - 18, h * 0.30 - 34, tw + 36, 48);
    ctx.fillStyle = '#ffc93c';
    ctx.fillText(mission.message, w / 2, h * 0.30);
    ctx.textAlign = 'left';
  }

  // Stall warning.
  if (plane.airborne && plane.speed < 34 && Math.floor(nowMs / 400) % 2 === 0) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, THROTTLE UP', w / 2, h * 0.22);
    ctx.textAlign = 'left';
  }
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

function statusLight(ctx, x, y, label, value, on) {
  ctx.fillStyle = on ? '#37d67a' : '#5a6a7a';
  ctx.beginPath(); ctx.arc(x + 5, y - 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(`${label} ${value}`, x + 16, y);
}

export function drawMenu(ctx, cam, selected, timeMs) {
  ctx.fillStyle = 'rgba(8, 16, 30, 0.45)';
  ctx.fillRect(0, 0, cam.width, cam.height);
  const cx = cam.width / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 58px system-ui, sans-serif';
  ctx.fillText('SKYLARK RUN', cx, 150);
  ctx.fillStyle = '#ffc93c';
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('A little jet, a chain of islands, and rings to thread.', cx, 186);
  ctx.fillStyle = '#cfe6ff';
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillText('W / S throttle · A D or arrows steer · mouse steers too · Space brake · G gear · F flaps · R restart', cx, 216);

  const names = ['1 · Ring Run', '2 · Canyon Slalom', '3 · Island Hop'];
  const tags = [
    'Take off, thread 6 rings, land home.',
    'Low and fast through the canyon. Fuel is tight.',
    'Land on two island strips, then come home.',
  ];
  names.forEach((name, i) => {
    const y = 268 + i * 86;
    const hot = i === selected;
    ctx.fillStyle = hot ? 'rgba(255, 201, 60, 0.92)' : 'rgba(10, 18, 30, 0.72)';
    ctx.beginPath();
    ctx.roundRect(cx - 260, y, 520, 68, 12);
    ctx.fill();
    ctx.fillStyle = hot ? '#1a2432' : '#eaf6ff';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(name, cx, y + 28);
    ctx.fillStyle = hot ? '#3a2f10' : '#9fd0ff';
    ctx.font = '400 14px system-ui, sans-serif';
    ctx.fillText(tags[i], cx, y + 52);
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 17px system-ui, sans-serif';
  const pulse = 0.65 + 0.35 * Math.sin(timeMs / 400);
  ctx.globalAlpha = pulse;
  ctx.fillText('Press ENTER or click to fly', cx, 268 + 3 * 86 + 22);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawOverlay(ctx, cam, title, lines, accent = '#ffc93c') {
  ctx.fillStyle = 'rgba(8, 16, 30, 0.62)';
  ctx.fillRect(0, 0, cam.width, cam.height);
  const cx = cam.width / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText(title, cx, cam.height / 2 - 60);
  ctx.fillStyle = '#eaf6ff';
  ctx.font = '400 18px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, cx, cam.height / 2 - 16 + i * 30));
  ctx.fillStyle = '#9fd0ff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Press R to fly again · M to change mission', cx, cam.height / 2 + 30 + lines.length * 30);
  ctx.textAlign = 'left';
}
