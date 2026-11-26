// Aircraft flight model for Skylark Run: arcade physics with real trade-offs.
// Throttle sets target speed, bank turns the nose, pitch trades speed for height,
// and below stall speed the wing stops flying. Fuel, gear and flaps matter.

import { clamp, lerp } from './util.js';
import { terrainHeight, runwayUnder } from './world.js';

export const STALL_SPEED = 34;
export const MAX_SPEED = 96;
export const TAKEOFF_SPEED = 42;

export function newAircraft() {
  return {
    x: 0, y: 8, z: -120, // parked on the home runway, facing +Z
    heading: 0, // radians, 0 = +Z
    pitch: 0, // radians, positive = nose up
    bank: 0, // radians, positive = right wing down
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    gearDown: true,
    flaps: false,
    airborne: false,
    verticalSpeed: 0,
    windX: 0,
    windZ: 0,
  };
}

// Per-frame control input, all in -1..1 except the toggles.
export function newControls() {
  return {
    throttleDelta: 0, // -1 cut, +1 full
    bankTarget: 0, // -1 left .. +1 right
    pitchTarget: 0, // -1 down .. +1 up
    brake: false,
  };
}

function forwardVector(p) {
  const cp = Math.cos(p.pitch);
  return {
    x: Math.sin(p.heading) * cp,
    y: Math.sin(p.pitch),
    z: Math.cos(p.heading) * cp,
  };
}

export function stepAircraft(p, c, dt) {
  // Throttle and fuel.
  p.throttle = clamp(p.throttle + c.throttleDelta * 0.55 * dt, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;
  const burn = (0.10 + p.throttle * 0.42 + (p.flaps ? 0.05 : 0)) * dt;
  p.fuel = Math.max(0, p.fuel - burn);

  // Speed chases the throttle setting; climbing costs speed, diving gives it back.
  const cruise = 16 + p.throttle * (MAX_SPEED - 16);
  const climbPenalty = Math.sin(p.pitch) * 26;
  const target = Math.max(0, cruise - climbPenalty - (p.flaps ? 6 : 0));
  const accel = p.airborne ? 9 : 16;
  p.speed += clamp(target - p.speed, -accel * dt, accel * dt);
  if (c.brake && !p.airborne) p.speed = Math.max(0, p.speed - 30 * dt);

  // Bank eases toward the pilot's demand; the nose follows the bank.
  const bankGoal = c.bankTarget * 0.96; // ~55 degrees
  p.bank += (bankGoal - p.bank) * Math.min(1, dt * 3.2);
  const stall = STALL_SPEED - (p.flaps ? 6 : 0);
  if (p.airborne && p.speed > stall * 0.6) {
    const turnRate = (Math.tan(p.bank) * 9.8) / Math.max(p.speed, 20);
    p.heading += turnRate * dt;
  }

  // Pitch eases toward demand; a slow wing drops its nose.
  let pitchGoal = c.pitchTarget * 0.42; // ~24 degrees
  if (p.airborne && p.speed < stall) pitchGoal = Math.min(pitchGoal, -0.14);
  if (!p.airborne) pitchGoal = Math.min(pitchGoal, 0.16);
  // Forgiving rotation: a fast jet on the runway lifts its nose on its own
  // unless the pilot is actively holding it down.
  if (!p.airborne && p.speed > 55 && c.pitchTarget >= 0) pitchGoal = 0.14;
  p.pitch += (pitchGoal - p.pitch) * Math.min(1, dt * 2.6);

  const fwd = forwardVector(p);
  const sink = p.airborne ? Math.max(0, stall - p.speed) * 0.30 : 0;
  p.verticalSpeed = fwd.y * p.speed - sink;
  p.x += (fwd.x * p.speed + p.windX) * dt;
  p.z += (fwd.z * p.speed + p.windZ) * dt;
  p.y += p.verticalSpeed * dt;

  // Takeoff: fast enough and nose up on the runway strip.
  const ground = terrainHeight(p.x, p.z);
  if (!p.airborne) {
    p.y = ground;
    if (p.speed > TAKEOFF_SPEED && p.pitch > 0.06) {
      p.airborne = true;
      p.y = ground + 0.5;
    }
    return { event: 'roll', ground };
  }

  // Airborne: ground, water and runway contact.
  const clearance = p.y - ground;
  if (clearance <= 0.4) {
    const strip = runwayUnder(p.x, p.z);
    const gentle = p.verticalSpeed > -5.5 && p.speed < 62 && Math.abs(p.bank) < 0.32;
    if (strip && gentle && p.gearDown) {
      p.airborne = false;
      p.y = ground;
      p.pitch = 0;
      p.bank *= 0.4;
      return { event: 'landed', ground, runway: strip.key };
    }
    if (strip && gentle && !p.gearDown) {
      return { event: 'crash', ground, reason: 'belly landing — gear was up' };
    }
    if (strip && !gentle) {
      return { event: 'crash', ground, reason: 'hard landing on the runway' };
    }
    if (ground < 0.5) {
      return { event: 'crash', ground, reason: 'ditched in the sea' };
    }
    return { event: 'crash', ground, reason: 'flew into terrain' };
  }
  return { event: 'fly', ground };
}

export function applyDamage(p, amount) {
  p.damage = clamp(p.damage + amount, 0, 100);
}

export function knots(p) {
  return Math.round(p.speed * 1.944);
}

export function feetAlt(p) {
  return Math.round(p.y * 3.281);
}
