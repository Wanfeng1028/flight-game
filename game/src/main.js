// Skylark Run: bootstrap, game loop and state machine.
// States: menu -> fly -> paused / over (crashed) / done (mission complete).

import { newAircraft, stepAircraft, newControls } from './aircraft.js';
import { newInput, attachInput, consumePressed, readControls } from './input.js';
import { makeCamera, horizonY } from './camera.js';
import { renderWorld } from './render.js';
import { drawHud, drawMenu, drawOverlay } from './hud.js';
import { startMission, updateRings, recordLanding, missionComplete, formatTime } from './missions.js';
import { newAudio, ensureAudio, updateEngineSound, ringChime, thudSound, crashSound, toggleMute } from './audio.js';
import { readShotPreset, applyShotPreset } from './shots.js';
import { clamp } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = newInput();
attachInput(input, canvas);

const audio = newAudio();
let cam = makeCamera(canvas.width, canvas.height);
let plane = newAircraft();
let mission = startMission(0);
let state = 'menu';
let selectedMission = 0;
let overTitle = '';
let overLines = [];
let overAccent = '#ffc93c';
let lastTime = performance.now();
let flashAt = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cam = makeCamera(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function showMessage(text) {
  mission.message = text;
  mission.messageAt = performance.now();
}

function beginMission(index) {
  selectedMission = index;
  plane = newAircraft();
  mission = startMission(index);
  plane.fuel = mission.def.fuel;
  plane.windX = mission.def.windX;
  plane.windZ = mission.def.windZ;
  state = 'fly';
  ensureAudio(audio);
  showMessage(mission.def.name + ' — good luck!');
}

function endFlight(title, lines, accent) {
  overTitle = title;
  overLines = lines;
  overAccent = accent;
  state = 'over';
}

// Screenshot poses jump straight into a live flight from a set position.
const presetName = readShotPreset();
if (presetName) {
  const preset = applyShotPreset(presetName);
  if (preset && preset.plane) {
    plane = preset.plane;
    mission = preset.mission || startMission(preset.missionIndex);
    plane.fuel = mission.def.fuel;
    plane.windX = mission.def.windX;
    plane.windZ = mission.def.windZ;
    selectedMission = preset.missionIndex;
    state = 'fly';
    showMessage(mission.def.name);
  } else if (presetName === 'menu') {
    state = 'menu';
  }
}

function handleKeys(pressed) {
  for (const key of pressed) {
    if (key === 'Enter') {
      if (state === 'menu' || state === 'over') beginMission(selectedMission);
    } else if (key === '1' || key === '2' || key === '3') {
      const idx = Number(key) - 1;
      selectedMission = idx;
      if (state === 'menu') {
        mission = startMission(idx);
      }
    } else if (key === 'r' || key === 'R') {
      if (state !== 'menu') beginMission(selectedMission);
    } else if (key === 'm' || key === 'M') {
      if (state === 'menu') {
        selectedMission = (selectedMission + 1) % 3;
        mission = startMission(selectedMission);
      } else {
        const muted = toggleMute(audio);
        showMessage(muted ? 'Sound off' : 'Sound on');
      }
    } else if (key === 'g' || key === 'G') {
      if (state === 'fly') {
        plane.gearDown = !plane.gearDown;
        showMessage(plane.gearDown ? 'Gear down' : 'Gear up');
      }
    } else if (key === 'f' || key === 'F') {
      if (state === 'fly') {
        plane.flaps = !plane.flaps;
        showMessage(plane.flaps ? 'Flaps down' : 'Flaps up');
      }
    } else if (key === 'p' || key === 'P' || key === 'Escape') {
      if (state === 'fly') state = 'paused';
      else if (state === 'paused') state = 'fly';
    }
  }
  if (input.keys.has('ArrowUp') && state === 'menu') {
    selectedMission = (selectedMission + 2) % 3;
    mission = startMission(selectedMission);
    input.keys.delete('ArrowUp');
  }
  if (input.keys.has('ArrowDown') && state === 'menu') {
    selectedMission = (selectedMission + 1) % 3;
    mission = startMission(selectedMission);
    input.keys.delete('ArrowDown');
  }
}

function handleClick() {
  if (!input.clicked) return;
  const c = input.clicked;
  input.clicked = null;
  if (state === 'menu') {
    const cx = cam.width / 2;
    for (let i = 0; i < 3; i++) {
      const y = 268 + i * 86;
      if (c.x > cx - 260 && c.x < cx + 260 && c.y > y && c.y < y + 68) {
        beginMission(i);
        return;
      }
    }
    beginMission(selectedMission);
  } else if (state === 'over') {
    beginMission(selectedMission);
  }
}

function frame(nowMs) {
  const dt = clamp((nowMs - lastTime) / 1000, 0.001, 0.05);
  lastTime = nowMs;
  handleKeys(consumePressed(input));
  handleClick();

  if (state === 'fly') {
    const controls = readControls(input, nowMs);
    mission.time += dt;
    const result = stepAircraft(plane, controls, dt);
    updateEngineSound(audio, plane, dt);
    const ringHit = updateRings(mission, plane);
    if (ringHit === 'ring') {
      ringChime(audio);
      showMessage(`Ring ${mission.ringsDone}/${mission.rings.length} — +1000`);
    }
    if (result.event === 'landed') {
      thudSound(audio);
      const verdict = recordLanding(mission, result.runway, plane);
      if (verdict.kind === 'complete') {
        state = 'done';
        overTitle = 'MISSION COMPLETE';
        overAccent = '#37d67a';
        overLines = [
          `${mission.def.name} finished in ${formatTime(mission.time)}`,
          `Landing bonus +${verdict.bonus} · time bonus +${verdict.timeBonus}`,
          `Final score: ${mission.score}`,
        ];
      } else if (verdict.kind === 'stop') {
        showMessage(`Touchdown on ${verdict.runway} — +${verdict.bonus}`);
      } else if (verdict.kind === 'early') {
        showMessage('Landed early — rings still to fly!');
      } else {
        showMessage('Wrong strip — check the mission');
      }
    } else if (result.event === 'crash') {
      crashSound(audio);
      endFlight('CRASHED', [
        result.reason || 'the jet came down',
        `Rings flown: ${mission.ringsDone}/${mission.rings.length} · score ${mission.score}`,
        'Throttle discipline and a gentle descent keep you alive.',
      ], '#ff5a4a');
    } else if (result.event === 'roll' && plane.speed > 2) {
      if (Math.floor(nowMs / 700) % 2 === 0 && plane.speed < 42) {
        mission.message = 'Hold W to build speed — rotate at 80 kt';
        mission.messageAt = nowMs;
      }
    }
    if (plane.fuel <= 0 && plane.airborne) {
      mission.message = 'OUT OF FUEL — gliding';
      mission.messageAt = nowMs;
    }
    if (missionComplete(mission) && state === 'fly') {
      state = 'done';
    }
  }

  renderWorld(ctx, cam, plane, mission.rings, mission.nextRing, nowMs);
  if (state === 'menu') {
    drawMenu(ctx, cam, selectedMission, nowMs);
  } else if (state === 'fly' || state === 'paused') {
    drawHud(ctx, cam, plane, mission, nowMs);
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(8, 16, 30, 0.55)';
      ctx.fillRect(0, 0, cam.width, cam.height);
      ctx.fillStyle = '#eaf6ff';
      ctx.font = '800 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', cam.width / 2, cam.height / 2);
      ctx.font = '400 17px system-ui, sans-serif';
      ctx.fillText('Press P to keep flying', cam.width / 2, cam.height / 2 + 34);
      ctx.textAlign = 'left';
    }
  } else if (state === 'over' || state === 'done') {
    drawHud(ctx, cam, plane, mission, nowMs);
    drawOverlay(ctx, cam, overTitle, overLines, overAccent);
  }
  void flashAt;
  void horizonY;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Tiny read-only handle for automated play-testing: exposes live state only.
window.__skylark = {
  get plane() { return plane; },
  get mission() { return mission; },
  get state() { return state; },
};
