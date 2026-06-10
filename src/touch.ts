import { Controls } from './controls';

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

/**
 * On-screen controls for tablets/phones: a joystick on the left,
 * jump/place/break buttons on the right, and drag-anywhere-else to look.
 */
export class TouchControls {
  move = { x: 0, z: 0 };
  jump = false;
  down = false;

  constructor(
    controls: Controls,
    actions: { break: () => void; place: () => void; talk: () => void; fly: () => void },
  ) {
    const ui = document.getElementById('touch-ui')!;
    ui.hidden = false;

    // --- joystick ---
    const stick = document.getElementById('joystick')!;
    const knob = document.getElementById('knob')!;
    const radius = 44;
    let stickId: number | null = null;

    const setKnob = (dx: number, dy: number) => {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
    });
    stick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      const rect = stick.getBoundingClientRect();
      let dx = e.clientX - (rect.left + rect.width / 2);
      let dy = e.clientY - (rect.top + rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      setKnob(dx, dy);
      this.move.x = dx / radius;
      this.move.z = -dy / radius; // push up = walk forward
    });
    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== stickId) return;
      stickId = null;
      this.move.x = 0;
      this.move.z = 0;
      setKnob(0, 0);
    };
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);

    // --- look: drag anywhere that isn't a control ---
    const lookZone = document.getElementById('look-zone')!;
    const lookLast = new Map<number, { x: number; y: number }>();
    lookZone.addEventListener('pointerdown', (e) => {
      lookLast.set(e.pointerId, { x: e.clientX, y: e.clientY });
      lookZone.setPointerCapture(e.pointerId);
    });
    lookZone.addEventListener('pointermove', (e) => {
      const last = lookLast.get(e.pointerId);
      if (!last) return;
      controls.yaw -= (e.clientX - last.x) * 0.006;
      controls.pitch = Math.max(-0.25, Math.min(1.35, controls.pitch + (e.clientY - last.y) * 0.006));
      lookLast.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const endLook = (e: PointerEvent) => lookLast.delete(e.pointerId);
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    // --- buttons ---
    const hold = (id: string, action: () => void) => {
      const btn = document.getElementById(id)!;
      let timer: number | undefined;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        action();
        timer = window.setInterval(action, 280);
      });
      const stop = () => { if (timer) { clearInterval(timer); timer = undefined; } };
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointercancel', stop);
      btn.addEventListener('pointerleave', stop);
    };
    hold('btn-break', actions.break);
    hold('btn-place', actions.place);

    const jumpBtn = document.getElementById('btn-jump')!;
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jump = true; });
    const jumpUp = () => { this.jump = false; };
    jumpBtn.addEventListener('pointerup', jumpUp);
    jumpBtn.addEventListener('pointercancel', jumpUp);

    const downBtn = document.getElementById('btn-down')!;
    downBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.down = true; });
    const downUp = () => { this.down = false; };
    downBtn.addEventListener('pointerup', downUp);
    downBtn.addEventListener('pointercancel', downUp);

    document.getElementById('btn-talk')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions.talk();
    });
    document.getElementById('btn-fly')!.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      actions.fly();
    });
  }
}
