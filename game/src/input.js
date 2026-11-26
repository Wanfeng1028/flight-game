// Keyboard and mouse input for Skylark Run.
// Keys drive throttle, bank and pitch; the mouse is a virtual stick when it moves;
// the wheel trims throttle; clicks are reported for menus.

export function newInput() {
  return {
    keys: new Set(),
    mouseX: 0, // -1..1 across the canvas
    mouseY: 0, // -1..1 down the canvas
    mouseActive: false,
    mouseSeenAt: 0,
    wheelDelta: 0,
    clicked: null, // {x, y} in canvas pixels, consumed by the game loop
    pressed: new Set(), // keys pressed since last poll (edge-triggered)
  };
}

const PREVENTED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

export function attachInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (PREVENTED.has(e.key)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    input.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseActive = true;
    input.mouseSeenAt = performance.now();
  });
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.clicked = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.wheelDelta += e.deltaY;
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function consumePressed(input) {
  const out = input.pressed;
  input.pressed = new Set();
  return out;
}

// Fold the raw input state into per-frame aircraft controls.
export function readControls(input, nowMs) {
  const k = input.keys;
  const c = { throttleDelta: 0, bankTarget: 0, pitchTarget: 0, brake: false };
  if (k.has('w')) c.throttleDelta += 1;
  if (k.has('s')) c.throttleDelta -= 1;
  if (k.has(' ')) c.brake = true;

  let bank = 0;
  let pitch = 0;
  if (k.has('a') || k.has('ArrowLeft')) bank -= 1;
  if (k.has('d') || k.has('ArrowRight')) bank += 1;
  if (k.has('ArrowUp')) pitch += 1;
  if (k.has('ArrowDown')) pitch -= 1;

  // Mouse stick: recent movement steers when no arrow key is held.
  const mouseFresh = input.mouseActive && nowMs - input.mouseSeenAt < 2500;
  if (mouseFresh && bank === 0 && pitch === 0) {
    bank = clampStick(input.mouseX);
    pitch = clampStick(-input.mouseY);
  }
  c.bankTarget = bank;
  c.pitchTarget = pitch;

  if (input.wheelDelta !== 0) {
    c.throttleDelta += input.wheelDelta > 0 ? -0.6 : 0.6;
    input.wheelDelta = 0;
  }
  return c;
}

function clampStick(v) {
  const dead = 0.08;
  if (Math.abs(v) < dead) return 0;
  return Math.max(-1, Math.min(1, (v - Math.sign(v) * dead) / (1 - dead)));
}
