import * as THREE from 'three';

const UP = -Math.PI / 2;
const WAVE_LIFE = 0.55;

/**
 * 시설 구역 바닥 링. 평소엔 천천히 숨쉬고, 들어가면 번쩍(커졌다 자리 잡음 + 안쪽 채움 + 퍼지는 파동), 나가면 다시 숨쉬기.
 * geometry·material은 이 객체 소유 → dispose()에서 해제. 링마다 투명도가 따로 움직여 material 공유 안 함 (시설 몇 개뿐).
 */
export class ZoneRing {
  readonly root = new THREE.Group();
  private readonly ringGeo: THREE.RingGeometry;
  private readonly discGeo: THREE.CircleGeometry;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly discMat: THREE.MeshBasicMaterial;
  private readonly waveMat: THREE.MeshBasicMaterial;
  private readonly ring: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private readonly wave: THREE.Mesh;
  private clock = 0;
  /** 0 = 평소, 1 = 들어와 있음 (부드럽게 따라감) */
  private on = 0;
  private inside = false;
  /** 들어온 순간 튕김 (1 → 0) */
  private pop = 0;
  private waveT = WAVE_LIFE;

  constructor(x: number, z: number, radius: number, color: string) {
    this.ringGeo = new THREE.RingGeometry(radius - 0.22, radius, 64);
    this.discGeo = new THREE.CircleGeometry(radius - 0.22, 48);
    const mat = (opacity: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    this.ringMat = mat(0.5);
    this.discMat = mat(0);
    this.waveMat = mat(0);
    this.ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    this.disc = new THREE.Mesh(this.discGeo, this.discMat);
    this.wave = new THREE.Mesh(this.ringGeo, this.waveMat);
    for (const [m, y] of [[this.disc, 0.1], [this.ring, 0.11], [this.wave, 0.12]] as const) {
      m.rotation.x = UP;
      m.position.y = y;
      m.renderOrder = 2;
      this.root.add(m);
    }
    this.wave.visible = false;
    this.root.position.set(x, 0, z);
  }

  setInside(inside: boolean): void {
    if (inside === this.inside) return;
    this.inside = inside;
    if (inside) {
      this.pop = 1;
      this.waveT = 0;
      this.wave.visible = true;
    }
  }

  update(dt: number): void {
    this.clock += dt;
    this.on += ((this.inside ? 1 : 0) - this.on) * (1 - Math.exp(-dt * 10));
    this.pop = Math.max(0, this.pop - dt * 3);
    const breathe = Math.sin(this.clock * 2.4) * 0.03 * (1 - this.on);
    // 튕김: 0.25 커졌다가 감쇠 진동하며 1로
    const bounce = this.pop > 0 ? Math.sin((1 - this.pop) * Math.PI * 2.5) * 0.18 * this.pop : 0;
    this.ring.scale.setScalar(1 + breathe + bounce);
    this.ringMat.opacity = 0.45 + 0.45 * this.on + 0.15 * Math.sin(this.clock * 6) * this.on;
    this.discMat.opacity = 0.18 * this.on + 0.25 * this.pop;
    if (this.waveT < WAVE_LIFE) {
      this.waveT += dt;
      const k = Math.min(1, this.waveT / WAVE_LIFE);
      this.wave.scale.setScalar(1 + k * 0.6);
      this.waveMat.opacity = 0.8 * (1 - k);
      if (k >= 1) this.wave.visible = false;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.ringGeo.dispose();
    this.discGeo.dispose();
    this.ringMat.dispose();
    this.discMat.dispose();
    this.waveMat.dispose();
  }
}
