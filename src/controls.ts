import { MoveInput } from './player';

const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

/**
 * Keyboard + mouse: WASD moves, pointer-lock mouse orbits the camera,
 * left click breaks, right click places, 1-0 / wheel pick blocks,
 * E talks, F flies, C crafts, Shift sinks while flying,
 * arrow keys also turn the camera (handy on trackpads).
 */
export class Controls {
  yaw = 0;
  pitch = 0.45; // positive looks down from above
  locked = false;

  onBreak?: () => void;
  onPlace?: () => void;
  onSelect?: (index: number) => void;
  onCycle?: (dir: number) => void;
  onTalk?: () => void;
  onFly?: () => void;
  onCraft?: () => void;
  onEat?: () => void;
  onPatronus?: () => void;

  private keys = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      const digit = DIGITS.indexOf(e.code);
      if (digit >= 0) this.onSelect?.(digit);
      if (e.code === 'KeyE') this.onTalk?.();
      if (e.code === 'KeyF') this.onFly?.();
      if (e.code === 'KeyC') this.onCraft?.();
      if (e.code === 'KeyQ') this.onEat?.();
      if (e.code === 'KeyG') this.onPatronus?.();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) {
        this.lock();
        return;
      }
      if (e.button === 0) this.onBreak?.();
      if (e.button === 2) this.onPlace?.();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0026;
      this.pitch = clampPitch(this.pitch + e.movementY * 0.0026);
    });

    window.addEventListener('wheel', (e) => this.onCycle?.(e.deltaY > 0 ? 1 : -1));
  }

  lock(): void {
    this.canvas.requestPointerLock?.();
  }

  unlock(): void {
    if (this.locked) document.exitPointerLock();
  }

  /** Arrow keys turn the camera; called every frame. */
  updateCamera(dt: number): void {
    const turn = 2.2 * dt;
    if (this.keys.has('ArrowLeft')) this.yaw += turn;
    if (this.keys.has('ArrowRight')) this.yaw -= turn;
    if (this.keys.has('ArrowUp')) this.pitch = clampPitch(this.pitch - turn);
    if (this.keys.has('ArrowDown')) this.pitch = clampPitch(this.pitch + turn);
  }

  input(): MoveInput {
    let x = 0, z = 0;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;
    return {
      x,
      z,
      jump: this.keys.has('Space'),
      down: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }
}

function clampPitch(p: number): number {
  return Math.max(-0.25, Math.min(1.35, p));
}
