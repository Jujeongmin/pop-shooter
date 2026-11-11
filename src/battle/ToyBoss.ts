import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BALANCE } from '../sim/balance.ts';
import { isBoss } from '../sim/stages.ts';

const TINTS = ['#ff6b6b', '#ffb347', '#5aa9ff', '#9b87ff', '#4cc56a', '#ff7fbf', '#ffc93c', '#36c2c2', '#ff8a5b'];
const INK = '#2b3a67';
const ENTER_SEC = 0.45;
const DIE_SEC = 1.2;
/** 플레이어 키(m) 기준 */
const BASE_H = 1.6;

export type ToyKind = 'robot' | 'soldier' | 'jack' | 'bear';

/** 월드 안 번호(1~10) → 키 배수: 1~9번 1.5→3배, 대장 4배 */
export function bossScale(stage: number): number {
  const i = ((stage - 1) % BALANCE.stage.perWorld) + 1;
  return isBoss(stage) ? 4 : 1.5 + ((i - 1) * 1.5) / 8;
}

/** 1~9번 = 로봇·병정·깜짝상자 차례로(색·크기 변형), 10번 대장 = 곰 인형 왕 */
export function toyKind(stage: number): ToyKind {
  if (isBoss(stage)) return 'bear';
  return (['robot', 'soldier', 'jack'] as const)[((stage - 1) % BALANCE.stage.perWorld) % 3]!;
}

interface Part { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3 }
/** 종류별 대기 동작 (c = 시계, speed = 화날수록 빠름) */
type Animate = (c: number, speed: number, dt: number) => void;

/**
 * 뼈대 없는 태엽 장난감 보스 (도형 조립, 외부 파일 없음). 4종: 로봇·병정·깜짝상자·곰 인형 왕(대장).
 * 공통: 등장 통 튀어나옴, 맞으면 찌그러짐 + 눈 질끈, 체력 50%·25%에서 눈썹·볼 화남 + 빨라짐, 쓰러지면 부품이 사방으로 분해.
 * 소유: 이 보스가 만든 geometry·material 전부 → dispose().
 */
export class ToyBoss {
  readonly root = new THREE.Group();
  readonly height: number;
  readonly kind: ToyKind;
  private readonly body = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly eyes: THREE.Object3D[] = [];
  private readonly brows: { m: THREE.Object3D; side: number }[] = [];
  private readonly cheeks: THREE.Object3D[] = [];
  private readonly parts: Part[] = [];
  private readonly animate: Animate;
  private hitT = 1;
  private enterT = 0;
  private dieT = -1;
  private anger = 0;
  private clock = Math.random() * 10;

  constructor(stage: number) {
    this.kind = toyKind(stage);
    const tint = TINTS[(stage - 1) % TINTS.length]!;
    this.animate = { robot: () => this.robot(tint), soldier: () => this.soldier(tint), jack: () => this.jack(tint), bear: () => this.bear() }[this.kind]();
    if (isBoss(stage)) this.crown();
    // 키 맞추기: 조립한 모양의 실제 높이로
    this.root.add(this.body);
    const box = new THREE.Box3().setFromObject(this.body);
    this.height = BASE_H * bossScale(stage);
    this.body.scale.setScalar(this.height / Math.max(0.1, box.max.y - box.min.y));
    this.root.scale.setScalar(0.001);
  }

  // ── 조립 도우미 ──
  private mat(color: string): THREE.MeshStandardMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });
      this.mats.set(color, m);
      this.owned.push(m);
    }
    return m;
  }

  private add(p: THREE.Object3D, geo: THREE.BufferGeometry, c: string, x: number, y: number, z: number): THREE.Mesh {
    this.owned.push(geo);
    const m = new THREE.Mesh(geo, this.mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    p.add(m);
    return m;
  }

  private box(p: THREE.Object3D, w: number, h: number, d: number, r: number, c: string, x: number, y: number, z: number): THREE.Mesh {
    return this.add(p, new RoundedBoxGeometry(w, h, d, 3, r), c, x, y, z);
  }

  private ball(p: THREE.Object3D, r: number, c: string, x: number, y: number, z: number): THREE.Mesh {
    return this.add(p, new THREE.SphereGeometry(r, 20, 14), c, x, y, z);
  }

  private cyl(p: THREE.Object3D, r: number, h: number, c: string, x: number, y: number, z: number, r2 = r): THREE.Mesh {
    return this.add(p, new THREE.CylinderGeometry(r, r2, h, 16), c, x, y, z);
  }

  private group(p: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    p.add(g);
    return g;
  }

  /** 얼굴: 큰 눈 둘(흰자·눈동자·반짝) + 눈썹 + 볼. s = 크기, z = 얼굴 앞면 */
  private face(p: THREE.Object3D, y: number, z: number, s: number, gap = 0.21): void {
    for (const sx of [-1, 1]) {
      const eye = this.group(p, sx * gap * s, y, z);
      this.ball(eye, 0.15 * s, '#ffffff', 0, 0, 0).scale.set(1, 1.1, 0.5);
      this.ball(eye, 0.085 * s, INK, 0, -0.01 * s, 0.06 * s).scale.set(1, 1.15, 0.6);
      this.ball(eye, 0.03 * s, '#ffffff', 0.03 * s, 0.04 * s, 0.1 * s);
      this.eyes.push(eye);
      this.brows.push({ m: this.box(p, 0.24 * s, 0.06 * s, 0.05 * s, 0.02 * s, INK, sx * gap * s, y + 0.22 * s, z + 0.02 * s), side: sx });
      const ch = this.ball(p, 0.07 * s, '#ff9ec4', sx * (gap + 0.12) * s, y - 0.2 * s, z - 0.01 * s);
      ch.scale.set(1, 0.6, 0.3);
      this.cheeks.push(ch);
    }
  }

  /** 등 태엽 (모든 장난감 공통) */
  private windKey(p: THREE.Object3D, y: number, z: number, s = 1): THREE.Group {
    const k = this.group(p, 0, y, z);
    this.cyl(k, 0.05 * s, 0.22 * s, '#ffd34d', 0, 0, -0.1 * s).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) this.ball(k, 0.16 * s, '#ffd34d', sx * 0.17 * s, 0, -0.22 * s).scale.set(1, 0.65, 0.25);
    return k;
  }

  // ── 종류별 ──
  private robot(tint: string): Animate {
    const B = this.body;
    const torso = this.group(B, 0, 0, 0);
    this.box(torso, 1.0, 0.95, 0.8, 0.14, tint, 0, 0.95, 0);
    this.box(torso, 0.62, 0.5, 0.06, 0.05, '#fff6e0', 0, 0.98, 0.41);
    ['#ff5e6a', '#ffd34d', '#5ccf6b'].forEach((c, i) => this.ball(torso, 0.055, c, -0.15 + i * 0.15, 1.08, 0.45));
    this.box(torso, 0.4, 0.06, 0.04, 0.02, '#c9b38a', 0, 0.88, 0.45);
    const head = this.group(B, 0, 1.43, 0);
    this.box(head, 0.95, 0.72, 0.78, 0.16, '#e9eef8', 0, 0.36, 0);
    this.box(head, 0.95, 0.12, 0.8, 0.05, tint, 0, 0.02, 0);
    this.face(head, 0.4, 0.38, 1);
    this.box(head, 0.3, 0.1, 0.05, 0.04, INK, 0, 0.16, 0.39);
    this.box(head, 0.07, 0.05, 0.03, 0.01, '#ffffff', -0.06, 0.19, 0.42);
    this.box(head, 0.07, 0.05, 0.03, 0.01, '#ffffff', 0.06, 0.19, 0.42);
    this.cyl(head, 0.025, 0.25, '#9aa6c4', 0, 0.84, 0);
    this.ball(head, 0.08, '#ff5e6a', 0, 0.99, 0);
    const arms = [-1, 1].map((sx) => {
      const a = this.group(B, sx * 0.58, 1.25, 0);
      this.ball(a, 0.13, tint, 0, 0, 0);
      this.cyl(a, 0.07, 0.42, '#9aa6c4', 0, -0.25, 0);
      // 손: 손목 커프 + 둥근 손바닥 + 벌린 집게 손가락 둘 (속이 빈 고리는 비어 보여서 꽉 찬 모양으로)
      this.cyl(a, 0.11, 0.1, tint, 0, -0.48, 0);
      this.ball(a, 0.13, '#e9eef8', 0, -0.6, 0).scale.set(1, 0.85, 1);
      for (const fz of [-1, 1]) {
        const f = this.box(a, 0.1, 0.24, 0.08, 0.035, '#e9eef8', 0, -0.76, fz * 0.07);
        f.rotation.x = fz * 0.35;
      }
      a.rotation.z = sx * 0.25;
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = this.group(B, sx * 0.25, 0.5, 0);
      this.cyl(l, 0.09, 0.36, '#9aa6c4', 0, -0.2, 0);
      this.box(l, 0.26, 0.14, 0.36, 0.05, INK, 0, -0.42, 0.05);
      return l;
    });
    const key = this.windKey(B, 1.0, -0.42);
    return (c, sp, dt) => {
      const w = Math.sin(c * sp);
      B.rotation.z = w * 0.08;
      B.position.y = Math.abs(w) * 0.06;
      legs[0]!.rotation.x = w * 0.35;
      legs[1]!.rotation.x = -w * 0.35;
      arms[0]!.rotation.x = -w * 0.5;
      arms[1]!.rotation.x = w * 0.5;
      key.rotation.z += dt * sp * 0.8;
    };
  }

  /** 장난감 병정: 빨간 코트·흰 띠·금단추, 높은 털모자, 북 치며 행진 */
  private soldier(tint: string): Animate {
    const B = this.body;
    const coat = this.group(B, 0, 0, 0);
    this.cyl(coat, 0.42, 0.95, tint, 0, 1.0, 0, 0.46);
    this.box(coat, 0.12, 0.95, 0.9, 0.04, '#ffffff', 0, 1.0, 0).rotation.z = 0.55;
    this.box(coat, 0.12, 0.95, 0.9, 0.04, '#ffffff', 0, 1.0, 0).rotation.z = -0.55;
    for (let i = 0; i < 3; i++) this.ball(coat, 0.045, '#ffd34d', 0, 0.75 + i * 0.2, 0.45);
    this.cyl(coat, 0.47, 0.12, INK, 0, 0.55, 0);
    this.ball(coat, 0.06, '#ffd34d', 0, 0.55, 0.46);
    const head = this.group(B, 0, 1.5, 0);
    this.ball(head, 0.36, '#ffd9b8', 0, 0.3, 0);
    this.face(head, 0.34, 0.3, 0.85, 0.17);
    this.box(head, 0.18, 0.05, 0.04, 0.02, '#c9433f', 0, 0.12, 0.33);
    // 털모자 + 턱끈 + 깃털
    this.cyl(head, 0.34, 0.62, INK, 0, 0.82, 0, 0.37);
    this.ball(head, 0.34, INK, 0, 1.12, 0).scale.y = 0.4;
    this.box(head, 0.75, 0.06, 0.04, 0.02, '#ffd34d', 0, 0.12, 0.05).rotation.x = 0.2;
    this.cyl(head, 0.05, 0.3, '#ff5e6a', 0.2, 1.1, 0.12);
    this.ball(head, 0.08, '#ff5e6a', 0.2, 1.28, 0.12);
    const arms = [-1, 1].map((sx) => {
      const a = this.group(B, sx * 0.5, 1.35, 0);
      this.ball(a, 0.12, '#ffd34d', 0, 0, 0).scale.y = 0.6;
      this.cyl(a, 0.08, 0.5, tint, 0, -0.27, 0);
      this.ball(a, 0.09, '#ffffff', 0, -0.55, 0);
      return a;
    });
    // 북
    const drum = this.group(B, 0, 0.75, 0.55);
    this.cyl(drum, 0.3, 0.28, '#ffffff', 0, 0, 0).rotation.x = Math.PI / 2;
    this.cyl(drum, 0.31, 0.06, tint, 0, 0, 0.13).rotation.x = Math.PI / 2;
    this.cyl(drum, 0.31, 0.06, tint, 0, 0, -0.13).rotation.x = Math.PI / 2;
    const legs = [-1, 1].map((sx) => {
      const l = this.group(B, sx * 0.18, 0.5, 0);
      this.cyl(l, 0.1, 0.42, INK, 0, -0.2, 0);
      this.box(l, 0.2, 0.12, 0.32, 0.05, '#1b2340', 0, -0.44, 0.05);
      return l;
    });
    const key = this.windKey(B, 1.05, -0.45);
    return (c, sp, dt) => {
      const w = Math.sin(c * sp);
      B.position.y = Math.abs(w) * 0.07;
      legs[0]!.rotation.x = w * 0.5;
      legs[1]!.rotation.x = -w * 0.5;
      // 북 치기: 팔이 번갈아 내려침
      arms[0]!.rotation.x = -0.9 + Math.max(0, w) * 0.7;
      arms[1]!.rotation.x = -0.9 + Math.max(0, -w) * 0.7;
      head.rotation.z = Math.sin(c * sp * 0.5) * 0.06;
      key.rotation.z += dt * sp * 0.8;
    };
  }

  /** 깜짝 상자: 무늬 상자 + 용수철 + 광대 머리, 손잡이가 돌며 머리가 튕김 */
  private jack(tint: string): Animate {
    const B = this.body;
    const box = this.group(B, 0, 0, 0);
    this.box(box, 1.1, 0.95, 1.1, 0.08, tint, 0, 0.48, 0);
    // 옆면 무늬 (별·원)
    for (const [x, z, ry] of [[0, 0.56, 0], [0.56, 0, Math.PI / 2], [-0.56, 0, -Math.PI / 2]] as const) {
      const d = this.ball(box, 0.16, '#ffffff', x, 0.5, z);
      d.scale.set(1, 1, 0.2);
      d.rotation.y = ry;
    }
    this.box(box, 1.16, 0.1, 1.16, 0.03, '#ffd34d', 0, 0.96, 0);
    // 열린 뚜껑
    const lid = this.group(box, 0, 1.0, -0.55);
    this.box(lid, 1.1, 0.08, 1.1, 0.03, tint, 0, 0, 0.55);
    lid.rotation.x = -2.0;
    // 옆 손잡이 (태엽 대신)
    const crank = this.group(box, 0.6, 0.5, 0);
    this.cyl(crank, 0.04, 0.2, '#9aa6c4', 0.08, 0, 0).rotation.z = Math.PI / 2;
    this.box(crank, 0.06, 0.32, 0.06, 0.02, '#9aa6c4', 0.18, -0.13, 0);
    this.ball(crank, 0.08, '#ff5e6a', 0.18, -0.3, 0);
    // 용수철 + 머리 (한 묶음으로 튕김)
    const pop = this.group(B, 0, 1.0, 0);
    const spring = this.group(pop, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const r = this.add(spring, new THREE.TorusGeometry(0.2, 0.045, 8, 20), '#c9d2ea', 0, 0.08 + i * 0.12, 0);
      r.rotation.x = Math.PI / 2;
    }
    const head = this.group(pop, 0, 0.95, 0);
    this.ball(head, 0.4, '#fff4ea', 0, 0, 0);
    this.face(head, 0.08, 0.34, 0.9, 0.16);
    this.ball(head, 0.09, '#ff3b4f', 0, -0.06, 0.4);
    // 웃는 입
    const mouth = this.add(head, new THREE.TorusGeometry(0.14, 0.035, 8, 16, Math.PI), '#ff3b4f', 0, -0.16, 0.34);
    mouth.rotation.z = Math.PI;
    // 광대 머리카락 + 고깔모자
    for (const sx of [-1, 1]) this.ball(head, 0.17, '#ff8a5b', sx * 0.36, 0.08, -0.05);
    this.add(head, new THREE.ConeGeometry(0.26, 0.5, 16), tint, 0, 0.55, 0).rotation.z = 0.15;
    this.ball(head, 0.08, '#ffffff', -0.04, 0.82, 0);
    // 목깃
    const ruff = this.add(pop, new THREE.TorusGeometry(0.3, 0.09, 8, 18), '#ffffff', 0, 0.62, 0);
    ruff.rotation.x = Math.PI / 2;
    return (c, sp) => {
      const b = Math.abs(Math.sin(c * sp * 0.7));
      spring.scale.y = 0.75 + b * 0.5;
      head.position.y = 0.8 + b * 0.3;
      ruff.position.y = 0.5 + b * 0.25;
      head.rotation.z = Math.sin(c * sp * 0.35) * 0.18;
      crank.rotation.x = c * sp;
      box.rotation.z = Math.sin(c * sp) * 0.03;
    };
  }

  /** 곰 인형 왕 (대장): 통통한 몸·배 천 조각·바느질, 팔 휘두르며 쿵쿵 */
  private bear(): Animate {
    const B = this.body;
    const fur = '#c98a5a';
    const light = '#f3d2a8';
    const torso = this.group(B, 0, 0, 0);
    this.ball(torso, 0.62, fur, 0, 0.85, 0).scale.set(1, 1.05, 0.9);
    this.ball(torso, 0.42, light, 0, 0.8, 0.38).scale.set(1, 1.1, 0.5);
    // 바느질 (배 가운데 점선)
    for (let i = 0; i < 4; i++) this.box(torso, 0.03, 0.08, 0.03, 0.01, '#8a5a3a', 0, 0.62 + i * 0.13, 0.6);
    // 망토
    // 망토: 등 쪽 반원통 (theta 0 = +z 앞이므로 뒤쪽 반만)
    this.add(torso, new THREE.CylinderGeometry(0.6, 0.85, 1.15, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8), '#c9433f', 0, 0.82, -0.08);
    this.mat('#c9433f').side = THREE.DoubleSide;
    const head = this.group(B, 0, 1.55, 0);
    this.ball(head, 0.48, fur, 0, 0.2, 0);
    for (const sx of [-1, 1]) {
      this.ball(head, 0.17, fur, sx * 0.36, 0.56, -0.05);
      this.ball(head, 0.1, light, sx * 0.36, 0.56, 0.04).scale.z = 0.4;
    }
    this.ball(head, 0.22, light, 0, 0.06, 0.38).scale.set(1, 0.75, 0.6);
    this.ball(head, 0.08, INK, 0, 0.12, 0.5);
    this.face(head, 0.32, 0.4, 0.85, 0.18);
    // 한쪽 눈 단추 (낡은 인형 느낌)
    this.cyl(head, 0.06, 0.03, INK, 0.15, 0.32, 0.47).rotation.x = Math.PI / 2;
    const arms = [-1, 1].map((sx) => {
      const a = this.group(B, sx * 0.6, 1.15, 0);
      this.ball(a, 0.22, fur, 0, -0.18, 0).scale.set(0.8, 1.3, 0.8);
      this.ball(a, 0.12, light, 0, -0.42, 0.08).scale.z = 0.5;
      a.rotation.z = sx * 0.4;
      return a;
    });
    const legs = [-1, 1].map((sx) => {
      const l = this.group(B, sx * 0.3, 0.35, 0.05);
      this.ball(l, 0.24, fur, 0, -0.1, 0).scale.set(1, 1, 1.2);
      this.ball(l, 0.14, light, 0, -0.12, 0.24).scale.z = 0.4;
      return l;
    });
    const key = this.windKey(B, 0.95, -0.55, 1.3);
    return (c, sp, dt) => {
      const w = Math.sin(c * sp * 0.7);
      B.rotation.z = w * 0.07;
      B.position.y = Math.abs(w) * 0.08;
      arms[0]!.rotation.x = -Math.max(0, w) * 1.2;
      arms[1]!.rotation.x = -Math.max(0, -w) * 1.2;
      legs[0]!.rotation.x = w * 0.25;
      legs[1]!.rotation.x = -w * 0.25;
      head.rotation.z = -w * 0.08;
      key.rotation.z += dt * sp * 0.6;
    };
  }

  /** 대장 왕관 (머리 꼭대기) */
  private crown(): void {
    const box = new THREE.Box3().setFromObject(this.body);
    const g = this.group(this.body, 0, box.max.y - 0.05, 0);
    this.cyl(g, 0.3, 0.16, '#ffd34d', 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.add(g, new THREE.ConeGeometry(0.08, 0.2, 8), '#ffd34d', Math.cos(a) * 0.24, 0.17, Math.sin(a) * 0.24);
      this.ball(g, 0.04, i % 2 ? '#ff5e6a' : '#5aa9ff', Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3);
    }
  }

  // ── 공통 동작 ──
  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.height * 0.5, this.root.position.z);
  }

  hit(): void {
    if (this.dieT < 0) this.hitT = 0;
  }

  setHpRatio(r: number): void {
    this.anger = r <= 0.25 ? 2 : r <= 0.5 ? 1 : 0;
  }

  defeat(): void {
    if (this.dieT >= 0) return;
    this.dieT = 0;
    for (const k of [...this.body.children]) {
      const dir = new THREE.Vector3(k.position.x + (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), k.position.z + (Math.random() - 0.3) * 0.8).normalize();
      this.parts.push({ obj: k, vel: dir.multiplyScalar(3 + Math.random() * 3), spin: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5) });
    }
  }

  get gone(): boolean {
    return this.dieT >= DIE_SEC;
  }

  update(dt: number): void {
    this.clock += dt;
    if (this.dieT >= 0) {
      this.dieT += dt;
      const k = Math.min(1, this.dieT / DIE_SEC);
      for (const p of this.parts) {
        p.vel.y -= 9 * dt;
        p.obj.position.addScaledVector(p.vel, dt);
        p.obj.rotation.x += p.spin.x * dt;
        p.obj.rotation.y += p.spin.y * dt;
        p.obj.rotation.z += p.spin.z * dt;
        p.obj.scale.setScalar(Math.max(0.001, 1 - Math.max(0, k - 0.6) / 0.4));
      }
      return;
    }
    this.animate(this.clock, 5 + this.anger * 2.5, dt);
    const brow = 0.15 + this.anger * 0.2;
    for (const b of this.brows) b.m.rotation.z = b.side * brow;
    for (const ch of this.cheeks) ch.visible = this.anger > 0;
    let sx = 1;
    let sy = 1;
    if (this.hitT < 1) {
      this.hitT = Math.min(1, this.hitT + dt * 6);
      const q = Math.sin(this.hitT * Math.PI) * 0.12;
      sx = 1 + q;
      sy = 1 - q;
    }
    const squint = this.hitT < 0.6 ? 0.25 : 1;
    for (const e of this.eyes) e.scale.y = squint;
    if (this.enterT < ENTER_SEC) {
      this.enterT = Math.min(ENTER_SEC, this.enterT + dt);
      const k = this.enterT / ENTER_SEC;
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      sx *= s;
      sy *= s;
    }
    this.root.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sx));
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
    this.root.removeFromParent();
  }
}
