import * as THREE from 'three';

/**
 * 공격력 오라 (사용자 2026-11-12: 공격력이 높을수록 주변에 오라, 다른 사람에게도 보이게).
 * DPS가 1천·1백만·10억…(×1000)을 넘을 때마다 한 단계: 발밑 얇은 고리 + 몸 둘레로 작게 떠오르는 반짝이 (사용자 2026-11-12: 크지 않게, 빛기둥 없음).
 * 단계마다 색이 바뀌고 반짝이 수만 조금 늘어남.
 * 내 캐릭터는 Game, 다른 사람은 LobbyPeers가 하나씩 가짐 (광장 공지 pw = 서버가 검사한 공격력).
 *
 * 공유 리소스: 도형 3개와 단계별 재질은 모듈에 하나씩 (모든 오라가 같이 씀) → dispose하지 않음.
 * 오라마다 소유: 반짝이 InstancedMesh(인스턴스 행렬 버퍼) → dispose().
 */

/** 단계 경계: log10(공격력) (3 = 1천) */
const STEPS = [3, 6, 9, 12, 15, 18, 21, 24] as const;
const COLORS = ['#7cc4ff', '#7fd78a', '#ffd34d', '#ff9a4d', '#ff5e9a', '#b48cff', '#ff4f4f', '#fff6a8'] as const;
const MAX_SPARKS = 7;

export function auraTier(power: number): number {
  if (!(power > 0)) return 0;
  const l = Math.log10(power);
  let t = 0;
  for (const s of STEPS) if (l >= s) t++;
  return t;
}

// ── 공유 (dispose 안 함) ──
let ringGeo: THREE.BufferGeometry | null = null;
let sparkGeo: THREE.BufferGeometry | null = null;
const mats = new Map<string, THREE.Material>();

function shared(): { ring: THREE.BufferGeometry; spark: THREE.BufferGeometry } {
  ringGeo ??= new THREE.RingGeometry(0.4, 0.52, 40).rotateX(-Math.PI / 2);
  sparkGeo ??= new THREE.OctahedronGeometry(0.045);
  return { ring: ringGeo, spark: sparkGeo };
}

function mat(kind: 'ring' | 'spark', tier: number): THREE.Material {
  const key = `${kind}${tier}`;
  let m = mats.get(key);
  if (!m) {
    const color = COLORS[tier - 1]!;
    m = kind === 'spark'
      ? new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
      // 밝은 바닥에서도 보이게 고리는 보통 섞기 (더하기 섞기는 밝은 땅에서 하얗게 사라짐)
      : new THREE.MeshBasicMaterial({
        color, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        opacity: 0.85,
      });
    mats.set(key, m);
  }
  return m;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class PowerAura {
  readonly root = new THREE.Group();
  private tier = 0;
  private ring: THREE.Mesh | null = null;
  private sparks: THREE.InstancedMesh | null = null;
  /** 반짝이마다 (각도, 높이 0~1, 속도) */
  private readonly seeds: { a: number; h: number; v: number; r: number }[] = [];
  private clock = Math.random() * 10;

  constructor() {
    this.root.visible = false;
  }

  /** 공격력 → 단계가 바뀔 때만 다시 꾸밈 */
  setPower(power: number): void {
    const t = auraTier(power);
    if (t === this.tier) return;
    this.tier = t;
    this.clear();
    this.root.visible = t > 0;
    if (t === 0) return;
    const g = shared();
    this.ring = new THREE.Mesh(g.ring, mat('ring', t));
    // 광장 바닥·길(맨 위 0.065m)보다 위에 (바닥에 묻혀 안 보이던 문제, 사용자 2026-11-12)
    this.ring.position.y = 0.1;
    this.ring.renderOrder = 2;
    const n = Math.min(MAX_SPARKS, 2 + Math.ceil(t * 0.7));
    this.sparks = new THREE.InstancedMesh(g.spark, mat('spark', t), n);
    this.sparks.frustumCulled = false;
    this.sparks.renderOrder = 3;
    this.seeds.length = 0;
    for (let i = 0; i < n; i++) this.seeds.push({ a: (i / n) * Math.PI * 2, h: Math.random(), v: 0.3 + Math.random() * 0.25, r: 0.32 + Math.random() * 0.12 });
    this.root.add(this.ring, this.sparks);
  }

  update(dt: number, x: number, y: number, z: number): void {
    if (this.tier === 0) return;
    this.root.position.set(x, y, z);
    this.clock += dt;
    const c = this.clock;
    const pulse = 1 + Math.sin(c * 3) * 0.05;
    this.ring!.scale.set(pulse, 1, pulse);
    const sp = this.sparks!;
    for (let i = 0; i < this.seeds.length; i++) {
      const s = this.seeds[i]!;
      s.h += dt * s.v * 0.6;
      if (s.h > 1) s.h -= 1;
      const a = s.a + c * 0.8;
      const fade = Math.sin(s.h * Math.PI);
      _q.setFromAxisAngle(UP, c * 3 + i);
      _p.set(Math.cos(a) * s.r, 0.1 + s.h * 1.3, Math.sin(a) * s.r);
      sp.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(0.3 + fade * 0.9)));
    }
    sp.instanceMatrix.needsUpdate = true;
  }

  private clear(): void {
    this.ring?.removeFromParent();
    if (this.sparks) {
      this.sparks.removeFromParent();
      this.sparks.dispose();
    }
    this.ring = null;
    this.sparks = null;
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }
}
