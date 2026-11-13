/**
 * Global input state shared by keyboard, touch joystick and the player controller.
 * Kept outside React so reading it every frame is free.
 */
export const input = {
  keys: new Set<string>(),
  joy: { x: 0, y: 0 }, // touch joystick (-1..1), y>0 = forward
  runToggle: false,
  jumpQueued: false,
  camDelta: { x: 0, y: 0 },
  zoomDelta: 0,
};

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function isMoveKey(code: string) {
  return MOVE_KEYS.has(code);
}

export function clearInput() {
  input.keys.clear();
  input.joy.x = 0;
  input.joy.y = 0;
  input.jumpQueued = false;
}

export function moveAxes() {
  const k = input.keys;
  let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
  let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
  x += input.joy.x;
  y += input.joy.y;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  const run = k.has('ShiftLeft') || k.has('ShiftRight') || input.runToggle || Math.hypot(input.joy.x, input.joy.y) > 0.92;
  return { x, y, run };
}
