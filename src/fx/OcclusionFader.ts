import * as THREE from 'three';

/** 몇 초마다 다시 검사 (매 프레임 레이캐스트는 아낌) */
const CHECK_SEC = 0.1;
/** 가릴 때 투명도, 바뀌는 속도(초당) */
const FADED = 0.28;
const SPEED = 6;
/** 캐릭터 몸에서 선을 쏘는 높이(m) */
const SAMPLE_Y = [0.5, 1.2] as const;

interface Faded { mesh: THREE.Mesh; orig: THREE.Material; clone: THREE.Material & { opacity: number }; target: number; outlines: THREE.Object3D[] }

const _from = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _local = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _box = new THREE.Box3();
/** 카메라가 도형 상자에서 이만큼(m) 안이면 안에 들어간 것으로 봄 (가까이 붙어 안쪽이 보이는 것도 막음) */
const INSIDE_PAD = 0.35;

/**
 * 카메라와 캐릭터 사이를 가리는 구조물을 반투명으로 (로블록스·3인칭 게임 방식).
 * 대상 = 등록한 그림자 있는 메시(땅·길·라벨·사람은 제외). 0.1초마다 카메라 → 캐릭터 무릎·가슴으로 레이캐스트,
 * 걸린 메시는 material을 투명 복제본으로 바꿔 서서히 흐리게, 벗어나면 서서히 원래대로 돌린 뒤 원본 material로 되돌림.
 * 투명 복제본은 메시마다 하나 캐시(이 객체 소유 → dispose, 가린 적 있는 메시 수만큼만). 원본은 공유일 수 있어 건드리지 않음.
 * 카메라가 구조물 안(또는 바로 옆)에 들어가면 그 구조물도 흐리게 (사용자 2026-11-12: 카메라를 돌리면 안쪽이 보임).
 * 흐려지는 동안 그 도형의 외곽선(그림자 없는 자식 메시)은 숨김.
 * 주의: InstancedMesh(울타리·벽돌 묶음)는 묶음 전체가 같이 흐려짐 → 안에 들어감 검사는 하지 않음.
 */
export class OcclusionFader {
  private readonly ray = new THREE.Raycaster();
  private readonly targets: THREE.Object3D[] = [];
  /** 메시마다 투명 복제본 하나 (같은 원본을 쓰는 메시끼리 투명도가 엉키지 않게) */
  private readonly clones = new Map<THREE.Mesh, THREE.Material & { opacity: number }>();
  private readonly faded = new Map<THREE.Mesh, Faded>();
  private readonly hits: THREE.Intersection[] = [];
  private readonly hitSet = new Set<THREE.Mesh>();
  private t = 0;

  /** root 아래에서 가릴 수 있는 메시(그림자 있음, 스킨 아님, 스프라이트 아님)를 등록 */
  register(root: THREE.Object3D): void {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh || !m.castShadow || Array.isArray(m.material)) return;
      this.targets.push(m);
    });
  }

  /** root 아래 메시를 대상에서 뺌 (해제되는 꾸미기): 흐려진 것은 원래 material로 되돌리고 복제본 해제 */
  unregister(root: THREE.Object3D): void {
    const gone = new Set<THREE.Object3D>();
    root.traverse((o) => gone.add(o));
    for (let i = this.targets.length - 1; i >= 0; i--) if (gone.has(this.targets[i]!)) this.targets.splice(i, 1);
    for (const o of gone) {
      const m = o as THREE.Mesh;
      const f = this.faded.get(m);
      if (f) { m.material = f.orig; for (const c of f.outlines) c.visible = true; this.faded.delete(m); }
      const c = this.clones.get(m);
      if (c) { c.dispose(); this.clones.delete(m); }
    }
  }

  private cloneOf(m: THREE.Mesh, orig: THREE.Material): THREE.Material & { opacity: number } {
    let c = this.clones.get(m);
    if (!c) {
      c = orig.clone() as THREE.Material & { opacity: number };
      c.transparent = true;
      c.depthWrite = false;
      this.clones.set(m, c);
    }
    return c;
  }

  update(dt: number, cam: THREE.Camera, target: THREE.Vector3, enabled = true): void {
    this.t += dt;
    if (this.t >= CHECK_SEC) {
      this.t = 0;
      this.hitSet.clear();
      if (enabled) {
        // 가슴·무릎 두 높이로 (낮은 카운터는 가슴 선이 윗면 위로 지나가서 놓침)
        for (const h of SAMPLE_Y) {
          _from.copy(cam.position);
          _dir.set(target.x, target.y + h, target.z).sub(_from);
          const dist = _dir.length();
          _dir.divideScalar(dist);
          this.ray.set(_from, _dir);
          this.ray.far = dist - 0.4;
          this.hits.length = 0;
          this.ray.intersectObjects(this.targets, false, this.hits);
          for (const hit of this.hits) this.hitSet.add(hit.object as THREE.Mesh);
        }
        // 카메라가 도형 안: 카메라를 도형 좌표로 옮겨 상자(조금 넓힘) 안인지 (앞면만 그리는 재질이라 안에서는 레이가 안 맞음)
        for (const o of this.targets) {
          const m = o as THREE.Mesh;
          if ((o as THREE.InstancedMesh).isInstancedMesh || !m.visible) continue;
          const g = m.geometry;
          if (!g.boundingBox) g.computeBoundingBox();
          _local.copy(cam.position).applyMatrix4(_inv.copy(m.matrixWorld).invert());
          _box.copy(g.boundingBox!).expandByScalar(INSIDE_PAD / Math.max(1e-3, m.matrixWorld.getMaxScaleOnAxis()));
          if (_box.containsPoint(_local)) this.hitSet.add(m);
        }
      }
      for (const m of this.hitSet) {
        let f = this.faded.get(m);
        if (!f) {
          const orig = m.material as THREE.Material;
          const clone = this.cloneOf(m, orig);
          clone.opacity = (orig as THREE.Material & { opacity: number }).opacity ?? 1;
          m.material = clone;
          const outlines = m.children.filter((c) => (c as THREE.Mesh).isMesh && !c.castShadow && c.visible);
          for (const c of outlines) c.visible = false;
          f = { mesh: m, orig, clone, target: FADED, outlines };
          this.faded.set(m, f);
        }
        f.target = FADED;
      }
      for (const f of this.faded.values()) if (!this.hitSet.has(f.mesh)) f.target = 1;
    }
    // 서서히 바꿈, 다 돌아오면 원본 material로
    for (const [m, f] of this.faded) {
      const o = f.clone.opacity;
      const step = SPEED * dt;
      f.clone.opacity = o < f.target ? Math.min(f.target, o + step) : Math.max(f.target, o - step);
      if (f.target === 1 && f.clone.opacity >= 1) {
        m.material = f.orig;
        for (const c of f.outlines) c.visible = true;
        this.faded.delete(m);
      }
    }
  }

  dispose(): void {
    for (const f of this.faded.values()) { f.mesh.material = f.orig; for (const c of f.outlines) c.visible = true; }
    this.faded.clear();
    for (const c of this.clones.values()) c.dispose();
    this.clones.clear();
  }
}
