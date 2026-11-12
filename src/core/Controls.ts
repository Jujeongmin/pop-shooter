import { Joystick } from './Joystick';

export interface Tap { x: number; y: number }

const DRAG_PX = 8;
/** 시점 돌리기 감도 (rad/px): 손가락 끌기, 마우스 끌기·잠금 이동 */
const TOUCH_LOOK = 0.007;
const MOUSE_LOOK = 0.0045;

/**
 * 입력 하나로 모음 (사용자 2026-11-11, 포키 +1 MMA Fighter 방식).
 * - 모바일: 화면을 네 칸으로 나눴을 때 왼쪽 아래 칸에서 누르면 이동 조이스틱, 나머지는 끌면 시점 돌리기, 안 끌고 떼면 탭.
 * - PC: WASD·방향키 이동, 마우스 끌기로 시점. 처음엔 잠그지 않음(잠그지 않고 하는 사람도 있음, 사용자 2026-11-12), Tab으로 마우스 잠금/풀기 (잠금 중엔 움직이면 시점).
 *   잠금 중 클릭 = 탭. 시설 창이 열리면 잠금을 풀어 버튼을 누를 수 있게 (Panel이 releaseLock 호출).
 * UI 요소 위 입력은 무시 (UI는 pointer-events로 따로 받음).
 */
export class Controls {
  private readonly keys = new Set<string>();
  private readonly joy: Joystick;
  private readonly downs = new Map<number, { x: number; y: number; lx: number; ly: number; dragging: boolean; touch: boolean }>();
  private taps: Tap[] = [];
  private lookX = 0;
  private lookY = 0;
  touchMode = false;
  /** 광장에서만 켬: 이동 조이스틱 + 시점 돌리기. 끄면 모든 누름 = 탭 */
  joystickEnabled = true;
  private readonly target: HTMLElement;
  /** 잠금 상태가 바뀔 때 (안내 문구) */
  onLockChange: ((locked: boolean) => void) | null = null;

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
    // iframe 밖에서 마우스를 떼면 pointerup이 안 옴 → 캡처를 잃으면 끝
    target.addEventListener('lostpointercapture', this.onLost);
    target.addEventListener('contextmenu', this.onContext);
    document.addEventListener('pointerlockchange', this.onLockEvt);
    window.addEventListener('resize', this.placeRest);
    // 터치만 있는 기기(폰·태블릿)는 처음부터 터치 모드: 쉬는 조이스틱 보임, 'Tab: 마우스 고정' 안내 숨김
    try {
      if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) this.setTouchMode(true);
    } catch { /* matchMedia 없음 */ }
  }

  get locked(): boolean {
    return document.pointerLockElement === this.target;
  }

  private readonly onContext = (e: Event): void => e.preventDefault();

  private readonly onLockEvt = (): void => {
    this.onLockChange?.(this.locked);
  };

  private requestLock(): void {
    if (this.touchMode || this.locked) return;
    try {
      const p = this.target.requestPointerLock?.() as unknown as Promise<void> | undefined;
      p?.catch?.(() => undefined);
    } catch { /* iframe이 막으면 끌기로만 */ }
  }

  /** 마우스 잠금 풀기 (시설 창 열릴 때) */
  releaseLock(): void {
    if (this.locked) document.exitPointerLock?.();
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === 'Tab') {
      // 포커스 이동 대신 마우스 잠금 토글
      e.preventDefault();
      if (e.type === 'keydown' && !e.repeat) {
        this.touchMode = false;
        if (this.locked) this.releaseLock();
        else this.requestLock();
      }
      return;
    }
    if (e.type === 'keydown') { this.keys.add(e.code); this.setTouchMode(false); } else this.keys.delete(e.code);
  };

  private setTouchMode(on: boolean): void {
    if (this.touchMode === on) return;
    this.touchMode = on;
    this.placeRest();
  }

  /** 모바일 이동 칸(왼쪽 아래)에 쉬는 조이스틱 표시 */
  private readonly placeRest = (): void => {
    if (this.touchMode && this.joystickEnabled) {
      const r = this.target.getBoundingClientRect();
      this.joy.rest(r.left + Math.min(r.width * 0.22, 130), r.bottom - Math.min(r.height * 0.18, 150));
    } else this.joy.hideRest();
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    if (this.joy.active) this.joy.end();
    this.downs.clear();
  };

  private readonly onLost = (e: PointerEvent): void => {
    if (this.joy.owns(e.pointerId)) this.joy.end();
    this.downs.delete(e.pointerId);
  };

  /** 왼쪽 아래 칸인지 (게임 화면 기준) */
  private inMoveZone(x: number, y: number): boolean {
    const r = this.target.getBoundingClientRect();
    return x < r.left + r.width / 2 && y > r.top + r.height / 2;
  }

  private readonly onDown = (e: PointerEvent): void => {
    const touch = e.pointerType !== 'mouse';
    this.setTouchMode(touch);
    if (!touch && this.locked) {
      // 잠금 중 클릭 = 탭 (조준은 화면 가운데)
      if (e.button === 0) this.taps.push({ x: innerWidth / 2, y: innerHeight / 2 });
      return;
    }
    if (touch && this.joystickEnabled && !this.joy.active && this.inMoveZone(e.clientX, e.clientY)) {
      this.joy.begin(e);
      try { this.target.setPointerCapture?.(e.pointerId); } catch { /* 캡처 못 해도 동작 */ }
      return;
    }
    this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, dragging: false, touch });
    try { this.target.setPointerCapture?.(e.pointerId); } catch { /* 캡처 못 해도 동작 */ }
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && this.locked) {
      if (this.joystickEnabled) { this.lookX += e.movementX * MOUSE_LOOK; this.lookY += e.movementY * MOUSE_LOOK; }
      return;
    }
    if (this.joy.owns(e.pointerId)) { this.joy.move(e); return; }
    const d = this.downs.get(e.pointerId);
    if (!d) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_PX) d.dragging = true;
    if (d.dragging && this.joystickEnabled) {
      const k = d.touch ? TOUCH_LOOK : MOUSE_LOOK;
      this.lookX += (e.clientX - d.lx) * k;
      this.lookY += (e.clientY - d.ly) * k;
    }
    d.lx = e.clientX;
    d.ly = e.clientY;
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
    if (!d.dragging && e.type === 'pointerup') {
      this.taps.push({ x: e.clientX, y: e.clientY });
    }
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

  /** 지난 프레임 뒤 시점 돌린 양 (rad): x = 오른쪽으로 끔, y = 아래로 끔. 읽으면 0 */
  drainLook(out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.lookX;
    out.y = this.lookY;
    this.lookX = this.lookY = 0;
    return out;
  }

  setJoystickEnabled(on: boolean): void {
    this.joystickEnabled = on;
    if (!on && this.joy.active) this.joy.end();
    this.lookX = this.lookY = 0;
    this.placeRest();
  }

  drainTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  dispose(): void {
    this.releaseLock();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    this.target.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.target.removeEventListener('lostpointercapture', this.onLost);
    this.target.removeEventListener('contextmenu', this.onContext);
    document.removeEventListener('pointerlockchange', this.onLockEvt);
    window.removeEventListener('resize', this.placeRest);
    this.joy.el.remove();
  }
}
