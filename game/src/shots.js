// Screenshot poses for Skylark Run: `?shot=` places the jet in a good spot
// with the engine running so a still frame shows the live game mid-flight.
// The game itself keeps running from the pose; nothing is staged or drawn over.

import { newAircraft } from './aircraft.js';
import { startMission } from './missions.js';

export function readShotPreset() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  return shot;
}

// Returns { plane, missionIndex } for the named pose, or null.
export function applyShotPreset(shot) {
  if (shot === 'cover') {
    const plane = newAircraft();
    plane.x = -10; plane.y = 62; plane.z = 180;
    plane.heading = 0.05; plane.pitch = 0.03; plane.bank = 0.12;
    plane.speed = 62; plane.throttle = 0.72; plane.airborne = true;
    return { plane, missionIndex: 0 };
  }
  if (shot === 'takeoff') {
    const plane = newAircraft();
    plane.x = 0; plane.y = 8; plane.z = -60;
    plane.speed = 44; plane.throttle = 1; plane.pitch = 0.1;
    return { plane, missionIndex: 0 };
  }
  if (shot === 'canyon') {
    const plane = newAircraft();
    plane.x = -18; plane.y = 55; plane.z = 640;
    plane.heading = -0.06; plane.pitch = 0.02; plane.bank = -0.18;
    plane.speed = 68; plane.throttle = 0.8; plane.airborne = true;
    plane.windX = 2;
    const mission = startMission(1);
    mission.rings[0].passed = true;
    mission.ringsDone = 1;
    mission.nextRing = 1;
    mission.score = 1000;
    return { plane, missionIndex: 1, mission };
  }
  if (shot === 'landing') {
    const plane = newAircraft();
    plane.x = 4; plane.y = 42; plane.z = -420;
    plane.heading = 0; plane.pitch = -0.05; plane.bank = 0.03;
    plane.speed = 48; plane.throttle = 0.32; plane.airborne = true;
    plane.gearDown = true; plane.flaps = true;
    const mission = startMission(0);
    for (const r of mission.rings) r.passed = true;
    mission.ringsDone = mission.rings.length;
    mission.nextRing = mission.rings.length;
    mission.score = 6000;
    mission.time = 118;
    return { plane, missionIndex: 0, mission };
  }
  if (shot === 'menu') return { plane: null, missionIndex: 0 };
  return null;
}
