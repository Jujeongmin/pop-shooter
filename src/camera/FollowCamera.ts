import * as THREE from 'three';

const _goal = new THREE.Vector3();
const _look = new THREE.Vector3();

/** 위에서 비스듬히 따라가는 고정 각도 카메라 (yaw 고정 = 조이스틱 위쪽이 늘 화면 위쪽) */
export class FollowCamera {
  yaw = 0;
  distance = 6.5;
  height = 3.6;
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
    const dist = this.distance * (1 - 0.22 * this.focusNow);
    const h = this.height * (1 - 0.12 * this.focusNow);
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
