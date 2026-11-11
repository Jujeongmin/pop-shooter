import * as THREE from 'three';

const _goal = new THREE.Vector3();
const _look = new THREE.Vector3();

/** 뒤 위에서 비스듬히 따라가는 카메라. 드래그로 좌우 회전 */
export class FollowCamera {
  yaw = 0;
  distance = 9;
  height = 6;
  private readonly cam: THREE.PerspectiveCamera;
  private readonly pos = new THREE.Vector3();
  private initialized = false;

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  rotate(dxPx: number): void {
    this.yaw -= dxPx * 0.006;
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
    _goal.set(target.x + Math.sin(this.yaw) * this.distance, target.y + this.height, target.z + Math.cos(this.yaw) * this.distance);
    if (!this.initialized) { this.pos.copy(_goal); this.initialized = true; }
    this.pos.lerp(_goal, 1 - Math.exp(-dt * 8));
    this.cam.position.copy(this.pos);
    _look.set(target.x, target.y + 1, target.z);
    this.cam.lookAt(_look);
  }
}
