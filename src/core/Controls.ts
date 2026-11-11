import { Joystick } from './Joystick';

export interface Tap { x: number; y: number }

const DRAG_PX = 8;

/**
 * 입력 하나로 모음: 키보드 WASD/화살표 + 화면 어디서나 끌기 조이스틱(마우스·터치) + 탭. 카메라는 고정 (회전 입력 없음).
 * UI 요소 위 입력은 무시 (UI는 pointer-events로 따로 받음).
 */
export class Controls {
  private readonly keys = new Set<string>();
  private readonly joy: Joystick;
  private readonly downs = new Map<number, { x: number; y: number; dragging: boolean }>();
  private taps: Tap[] = [];
  touchMode = false;
  /** 광장에서만 켬: 화면 어디든 누르고 끌면 조이스틱 (마우스·터치 공통, 첫 손가락). 끄면 모든 누름 = 탭 */
  joystickEnabled = true;
  private readonly target: HTMLElement;

  constructor(target: HTMLElement, uiLayer: HTMLElement) {
    this.target = target;
    this.joy = new Joystick(uiLayer);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    // iframe 밖에서 마우스를 떼면 pointerup이 안 옴 → 캡처를 잃으면 조이스틱 끝
    target.addEventListener('lostpointercapture', this.onLost);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.type === 'keydown') { this.keys.add(e.code); this.touchMode = false; } else this.keys.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    if (this.joy.active) this.joy.end();
  };

  private readonly onLost = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) this.joy.end();
  };

  private readonly onDown = (e: PointerEvent): void => {
    this.touchMode = e.pointerType === 'touch';
    if (this.joystickEnabled && !this.joy.active) {
      this.joy.begin(e);
      // 캡처: 창 밖으로 끌어도 move/up을 받고, 놓치면 lostpointercapture로 끝냄
      try { this.target.setPointerCapture?.(e.pointerId); } catch { /* 캡처 못 해도 조이스틱은 동작 */ }
      return;
    }
    this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, dragging: false });
    this.target.setPointerCapture?.(e.pointerId);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) { this.joy.move(e); return; }
    const d = this.downs.get(e.pointerId);
    if (!d) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_PX) d.dragging = true;
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) {
      // 끌지 않고 뗀 조이스틱 = 탭 (훈련 중 어디를 눌러도 추가 발사)
      if (this.joy.maxDrag <= DRAG_PX && e.type === 'pointerup') this.taps.push({ x: e.clientX, y: e.clientY });
      this.joy.end();
      return;
    }
    const d = this.downs.get(e.pointerId);
    if (!d) return;
    this.downs.delete(e.pointerId);
    if (!d.dragging && e.type === 'pointerup') this.taps.push({ x: e.clientX, y: e.clientY });
  };

  /** 이동 입력 (화면 기준: x 오른쪽, y 앞쪽) −1..1 */
  move(): { x: number; y: number } {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.joy.active) { x += this.joy.x; y -= this.joy.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  setJoystickEnabled(on: boolean): void {
    this.joystickEnabled = on;
    if (!on && this.joy.active) this.joy.end();
  }

  drainTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.target.removeEventListener('lostpointercapture', this.onLost);
    this.joy.el.remove();
  }
}
