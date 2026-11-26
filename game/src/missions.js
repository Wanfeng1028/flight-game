// Missions for Skylark Run: three sorties with different goals, each with its
// own rings, wind and fuel budget. Progress is tracked here, not in the loop.

import { makeRing, ringPlaneDistance, ringMissDistance } from './world.js';
import { clamp } from './util.js';

export const MISSIONS = [
  {
    id: 0,
    name: 'Ring Run',
    tag: 'Take off, thread 6 rings over the islands, land home.',
    fuel: 100,
    windX: 0, windZ: 0,
    rings: [
      [0, 55, 260, 20, 0, 1],
      [70, 65, 470, 18, 0.3, 1],
      [-90, 75, 680, 18, -0.4, 1],
      [50, 85, 880, 18, 0.3, 1],
      [-50, 70, 1080, 18, -0.3, 1],
      [0, 55, 1260, 20, 0, 1],
    ],
    landAt: 'home',
    parTime: 150,
  },
  {
    id: 1,
    name: 'Canyon Slalom',
    tag: 'Low and fast: 6 rings through the canyon channel. Fuel is tight.',
    fuel: 85,
    windX: 2, windZ: 0,
    rings: [
      [20, 48, 580, 16, 0, 1],
      [-35, 52, 700, 16, 0, 1],
      [30, 55, 820, 16, 0, 1],
      [-30, 58, 940, 16, 0, 1],
      [25, 55, 1060, 16, 0, 1],
      [0, 52, 1180, 16, 0, 1],
    ],
    landAt: 'home',
    parTime: 135,
  },
  {
    id: 2,
    name: 'Island Hop',
    tag: 'Land on North Strip and West Strip, then bring her home.',
    fuel: 100,
    windX: 3, windZ: 1,
    rings: [
      [180, 60, 480, 18, 0.5, 1],
      [330, 45, 660, 16, 0, 1],
    ],
    landAt: 'home',
    stops: ['north', 'west'],
    parTime: 260,
  },
];

export function startMission(index) {
  const def = MISSIONS[index] || MISSIONS[0];
  return {
    def,
    rings: def.rings.map(([x, y, z, r, nx, nz]) => makeRing(x, y, z, r, nx, nz)),
    nextRing: 0,
    ringsDone: 0,
    stopsDone: [],
    time: 0,
    score: 0,
    prevPlaneDist: null,
    message: '',
    messageAt: 0,
    landedHome: false,
  };
}

export function missionObjective(m) {
  if (m.def.stops) {
    const left = m.def.stops.filter((s) => !m.stopsDone.includes(s));
    if (m.ringsDone < m.rings.length) return `Fly ring ${m.ringsDone + 1}/${m.rings.length}`;
    if (left.length) return `Land on ${left[0] === 'north' ? 'North Strip' : 'West Strip'}`;
    return 'All stops done — land at Skylark Field';
  }
  if (m.ringsDone < m.rings.length) return `Fly ring ${m.ringsDone + 1}/${m.rings.length}`;
  return 'All rings done — land at Skylark Field';
}

// Advance ring progress; returns 'ring' when one is threaded, else null.
export function updateRings(m, plane) {
  if (m.nextRing >= m.rings.length) return null;
  const ring = m.rings[m.nextRing];
  const d = ringPlaneDistance(ring, plane.x, plane.y, plane.z);
  if (m.prevPlaneDist !== null && Math.sign(d) !== Math.sign(m.prevPlaneDist)) {
    const miss = ringMissDistance(ring, plane.x, plane.y, plane.z);
    if (miss < ring.radius + 4) {
      ring.passed = true;
      m.ringsDone++;
      m.nextRing++;
      m.score += 1000;
      m.prevPlaneDist = d;
      return 'ring';
    }
  }
  m.prevPlaneDist = d;
  return null;
}

// Called when the jet touches down on a runway. Returns a landing verdict.
export function recordLanding(m, runwayKey, plane) {
  const softness = clamp(1 - Math.abs(plane.verticalSpeed) / 5.5, 0, 1);
  const bonus = Math.round(400 + softness * 1600);
  if (m.def.stops && m.def.stops.includes(runwayKey) && !m.stopsDone.includes(runwayKey)) {
    m.stopsDone.push(runwayKey);
    m.score += bonus;
    return { kind: 'stop', bonus, runway: runwayKey };
  }
  if (runwayKey === m.def.landAt) {
    const ringsComplete = m.ringsDone >= m.rings.length;
    const stopsComplete = !m.def.stops || m.def.stops.every((s) => m.stopsDone.includes(s));
    if (ringsComplete && stopsComplete) {
      m.landedHome = true;
      const timeBonus = Math.max(0, Math.round((m.def.parTime - m.time) * 8));
      m.score += bonus + timeBonus;
      return { kind: 'complete', bonus, timeBonus };
    }
    return { kind: 'early', bonus: 0 };
  }
  return { kind: 'wrong', bonus: 0 };
}

export function missionComplete(m) {
  return m.landedHome;
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
