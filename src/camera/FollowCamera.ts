import * as THREE from 'three';

const _goal = new THREE.Vector3();
const _look = new THREE.Vector3();

/** 기본 내려다보는 각도와 거리 (distance 7.8 · height 4.4) */
const BASE_ELEV = Math.atan2(4.4, 7.8);
const RADIUS = Math.hypot(4.4, 7.8);
/** 위아래로 돌릴 수 있는 범위 (rad, 기본 각도 기준) */
const PITCH_MIN = -0.32;
const PITCH_MAX = 0.6;

/**
 * 위에서 비스듬히 따라가는 카메라. 끌기·마우스로 yaw(좌우)·pitch(위아래) 돌림 (사용자 2026-11-11).
 * 이동 입력은 yaw 기준 (조이스틱 위쪽 = 카메라가 보는 쪽).
 */
export class FollowCamera {
  yaw = 0;
  /** 기본 각도에서 더 내려다보면 +, 눕히면 − */
  pitch = 0;
  /** 0 = 평소, 1 = 구역 집중 (조금 당겨짐). focus 목표로 부드럽게 따라감 */
  focus = 0;
  private focusNow = 0;
  /** 바라보는 높이 올리기(m): 큰 보스 볼 때 */
  lookUp = 0;
  private lookUpNow = 0;
  private shakeAmp = 0;
  private shakeT = 0;
  private readonly cam: THREE.PerspectiveCamera;
  private readonly pos = new THREE.Vector3();
  private initialized = false;

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  /** 짧은 흔들림 (m) */
  shake(amp: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  /** 끌어서 돌리기: dx = 오른쪽으로 끈 양, dy = 아래로 끈 양 (rad) */
  turn(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + dy));
  }

  /** 화면 기준 이동 입력 → 월드 방향 (카메라 yaw 기준) */
  toWorld(mx: number, my: number, out: THREE.Vector3): THREE.Vector3 {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    // 앞 = 카메라가 보는 방향 (−sin, −cos), 오른쪽 = 앞 × 위 = (cos, −sin)
    out.set(-s * my + c * mx, 0, -c * my - s * mx);
    return out;
  }

  update(dt: number, target: THREE.Vector3): void {
    this.focusNow += (this.focus - this.focusNow) * (1 - Math.exp(-dt * 5));
    const elev = BASE_ELEV + this.pitch;
    // 6.5/3.6은 캐릭터가 너무 커서 주변이 안 보임, 예전 9m대는 너무 작았음 → 중간 (사용자 2026-11-11)
    const dist = RADIUS * Math.cos(elev) * (1 - 0.22 * this.focusNow);
    const h = RADIUS * Math.sin(elev) * (1 - 0.12 * this.focusNow);
    _goal.set(target.x + Math.sin(this.yaw) * dist, target.y + h, target.z + Math.cos(this.yaw) * dist);
    if (!this.initialized) { this.pos.copy(_goal); this.initialized = true; }
    this.pos.lerp(_goal, 1 - Math.exp(-dt * 8));
    this.cam.position.copy(this.pos);
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt;
      this.cam.position.x += Math.sin(this.shakeT * 61) * this.shakeAmp;
      this.cam.position.y += Math.sin(this.shakeT * 47 + 1) * this.shakeAmp;
      this.shakeAmp *= Math.exp(-dt * 9);
    }
    this.lookUpNow += (this.lookUp - this.lookUpNow) * (1 - Math.exp(-dt * 5));
    _look.set(target.x, target.y + 1 + this.lookUpNow, target.z);
    this.cam.lookAt(_look);
  }
}
