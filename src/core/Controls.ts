import { Joystick } from './Joystick';

export interface Tap { x: number; y: number }

const DRAG_PX = 8;

/**
 * 입력 하나로 모음: 키보드 WASD/화살표 + 마우스/터치 탭 + 드래그(카메라 회전) + 터치 조이스틱.
 * UI 요소 위 입력은 무시 (UI는 pointer-events로 따로 받음).
 */
export class Controls {
  private readonly keys = new Set<string>();
  private readonly joy: Joystick;
  private readonly downs = new Map<number, { x: number; y: number; lastX: number; dragging: boolean }>();
  private taps: Tap[] = [];
  /** 이번 프레임까지 쌓인 카메라 회전 드래그(px) */
  private dragDx = 0;
  touchMode = false;
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
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.type === 'keydown') { this.keys.add(e.code); this.touchMode = false; } else this.keys.delete(e.code);
  };

  private readonly onBlur = (): void => this.keys.clear();

  private readonly onDown = (e: PointerEvent): void => {
    this.touchMode = e.pointerType === 'touch';
    if (this.touchMode && e.clientX < window.innerWidth * 0.4 && !this.joy.active) {
      this.joy.begin(e);
      return;
    }
    this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, lastX: e.clientX, dragging: false });
    this.target.setPointerCapture?.(e.pointerId);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) { this.joy.move(e); return; }
    const d = this.downs.get(e.pointerId);
    if (!d) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_PX) d.dragging = true;
    if (d.dragging) {
      this.dragDx += e.clientX - d.lastX;
      d.lastX = e.clientX;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) { this.joy.end(); return; }
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

  /** 키보드·조이스틱 이동 중인지 (클릭 이동 목표 취소용) */
  get steering(): boolean {
    const m = this.move();
    return m.x !== 0 || m.y !== 0;
  }

  drainTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  drainDrag(): number {
    const d = this.dragDx;
    this.dragDx = 0;
    return d;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.joy.el.remove();
  }
}
