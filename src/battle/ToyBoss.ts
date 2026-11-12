import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BALANCE } from '../sim/balance.ts';
import { isBoss, worldOf } from '../sim/stages.ts';

const TINTS = ['#ff6b6b', '#ffb347', '#5aa9ff', '#9b87ff', '#4cc56a', '#ff7fbf', '#ffc93c', '#36c2c2', '#ff8a5b'];
const INK = '#2b3a67';
const ENTER_SEC = 0.45;
const DIE_SEC = 1.2;
/** 플레이어 키(m) 기준 */
const BASE_H = 1.6;

export type ToyKind = 'robot' | 'soldier' | 'jack' | 'bear'
  | 'digger' | 'truck' | 'gummy' | 'cake' | 'alien' | 'ufo' | 'crab' | 'shark' | 'penguin' | 'snowking' | 'knight' | 'dragon' | 'cloudy' | 'unicorn';

/** 월드별 전용 몹 (일반 · 대장). 월드 1은 장난감 셋 + 곰 인형 왕 (사용자 2026-11-12: 월드마다 다른 몹) */
const WORLD_MOBS: readonly { main: ToyKind | null; boss: ToyKind }[] = [
  { main: null, boss: 'bear' },
  { main: 'digger', boss: 'truck' },
  { main: 'gummy', boss: 'cake' },
  { main: 'alien', boss: 'ufo' },
  { main: 'crab', boss: 'shark' },
  { main: 'penguin', boss: 'snowking' },
  { main: 'knight', boss: 'dragon' },
  { main: 'cloudy', boss: 'unicorn' },
];

/** 월드 안 번호(1~10) → 키 배수: 1~9번 1.5→3배, 대장 4배 */
export function bossScale(stage: number): number {
  const i = ((stage - 1) % BALANCE.stage.perWorld) + 1;
  return isBoss(stage) ? 4 : 1.5 + ((i - 1) * 1.5) / 8;
}

/**
 * 월드 1: 1~9번 = 로봇·병정·깜짝상자 차례로(색·크기 변형), 10번 = 곰 인형 왕.
 * 월드 2~8: 홀수 번 = 그 월드 전용 몹, 짝수 번 = 장난감 셋 중 하나(월드 색), 10번 = 그 월드 전용 대장.
 */
export function toyKind(stage: number): ToyKind {
  const mobs = WORLD_MOBS[Math.min(WORLD_MOBS.length, worldOf(stage)) - 1]!;
  if (isBoss(stage)) return mobs.boss;
  const i = ((stage - 1) % BALANCE.stage.perWorld) + 1;
  const toys = ['robot', 'soldier', 'jack'] as const;
  if (!mobs.main) return toys[(i - 1) % 3]!;
  return i % 2 === 1 ? mobs.main : toys[(i / 2) % 3]!;
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
  /** 던지기 자세 (0 → 1) */
  private throwT = 1;
  private clock = Math.random() * 10;

  /** tints = 월드 테마 보스 색 (없으면 기본) */
  constructor(stage: number, tints: readonly string[] = TINTS) {
    this.kind = toyKind(stage);
    const tint = tints[(stage - 1) % tints.length]!;
    const build: Record<ToyKind, () => Animate> = {
      robot: () => this.robot(tint), soldier: () => this.soldier(tint), jack: () => this.jack(tint), bear: () => this.bear(),
      digger: () => this.digger(tint), truck: () => this.truck(tint), gummy: () => this.gummy(tint), cake: () => this.cake(),
      alien: () => this.alien(tint), ufo: () => this.ufo(), crab: () => this.crab(tint), shark: () => this.shark(),
      penguin: () => this.penguin(tint), snowking: () => this.snowking(), knight: () => this.knight(tint), dragon: () => this.dragon(tint),
      cloudy: () => this.cloudy(tint), unicorn: () => this.unicorn(),
    };
    this.animate = build[this.kind]();
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
    this.crownOn = { parent: head, x: 0, y: 0.66, z: 0 };
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

  // ── 월드 2~8 전용 몹 (사용자 2026-11-12: 월드마다 다른 몹). 일반 몹 1종 + 대장 1종씩 ──

  /** 월드 2 굴착기: 무한궤도 + 얼굴 달린 운전석 + 흔드는 삽 팔 */
  private digger(tint: string): Animate {
    const B = this.body;
    for (const sx of [-1, 1]) {
      this.box(B, 0.32, 0.36, 1.25, 0.16, '#3d4660', sx * 0.42, 0.18, 0);
      for (let i = 0; i < 3; i++) this.cyl(B, 0.13, 0.34, '#9aa6c4', sx * 0.42, 0.18, -0.4 + i * 0.4).rotation.z = Math.PI / 2;
    }
    const cab = this.group(B, 0, 0.4, 0);
    this.box(cab, 1.0, 0.75, 0.95, 0.14, tint, 0, 0.38, 0);
    this.box(cab, 0.7, 0.42, 0.06, 0.06, '#bfe3ff', 0, 0.48, 0.47);
    this.face(cab, 0.5, 0.5, 0.75, 0.2);
    this.cyl(cab, 0.06, 0.3, INK, -0.32, 0.9, -0.25);
    const arm = this.group(B, 0.35, 0.95, 0.3);
    this.box(arm, 0.18, 0.18, 0.8, 0.06, '#ffd34d', 0, 0.15, 0.35).rotation.x = -0.5;
    const bucket = this.group(arm, 0, 0.45, 0.75);
    this.box(bucket, 0.4, 0.28, 0.3, 0.06, '#9aa6c4', 0, 0, 0);
    for (let i = 0; i < 3; i++) this.add(bucket, new THREE.ConeGeometry(0.05, 0.14, 6), '#9aa6c4', -0.12 + i * 0.12, -0.2, 0.08).rotation.x = Math.PI;
    return (c, sp) => {
      const w = Math.sin(c * sp * 0.6);
      arm.rotation.x = -0.3 + w * 0.45;
      bucket.rotation.x = w * 0.6;
      cab.rotation.y = Math.sin(c * sp * 0.3) * 0.15;
      B.position.y = Math.abs(Math.sin(c * sp)) * 0.03;
    };
  }

  /** 월드 2 대장 덤프트럭: 큰 바퀴 넷 + 얼굴 달린 앞 + 짐칸이 들썩 */
  private truck(tint: string): Animate {
    const B = this.body;
    const wheels: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      for (const z of [-0.55, 0.55]) {
        const w = this.group(B, sx * 0.62, 0.3, z);
        this.cyl(w, 0.3, 0.22, '#2b3150', 0, 0, 0).rotation.z = Math.PI / 2;
        this.cyl(w, 0.14, 0.24, '#ffd34d', 0, 0, 0).rotation.z = Math.PI / 2;
        wheels.push(w);
      }
    }
    this.box(B, 1.15, 0.25, 1.7, 0.08, '#5b6577', 0, 0.48, 0);
    const cab = this.group(B, 0, 0.6, 0.5);
    this.box(cab, 1.1, 0.95, 0.7, 0.16, tint, 0, 0.48, 0);
    this.box(cab, 0.8, 0.35, 0.06, 0.05, '#bfe3ff', 0, 0.72, 0.36);
    this.face(cab, 0.35, 0.37, 0.8, 0.22);
    this.crownOn = { parent: cab, x: 0, y: 0.98, z: 0 };
    const bed = this.group(B, 0, 0.62, -0.25);
    this.box(bed, 1.1, 0.55, 0.95, 0.06, '#ffb347', 0, 0.28, -0.3);
    for (let i = 0; i < 3; i++) this.box(bed, 0.32, 0.32, 0.32, 0.06, ['#ff5e6a', '#5aa9ff', '#7fd78a'][i]!, -0.3 + i * 0.3, 0.68, -0.3);
    return (c, sp, dt) => {
      bed.rotation.x = -Math.max(0, Math.sin(c * sp * 0.4)) * 0.45;
      for (const w of wheels) w.rotation.x += dt * sp * 0.6;
      B.position.y = Math.abs(Math.sin(c * sp)) * 0.04;
      cab.rotation.z = Math.sin(c * sp * 0.5) * 0.04;
    };
  }

  /** 월드 3 젤리곰: 반투명 몸, 통통 튐 */
  private gummy(tint: string): Animate {
    const B = this.body;
    const jelly = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.82 });
    this.owned.push(jelly);
    const blob = this.group(B, 0, 0, 0);
    const part = (geo: THREE.BufferGeometry, x: number, y: number, z: number): THREE.Mesh => {
      this.owned.push(geo);
      const m = new THREE.Mesh(geo, jelly);
      m.position.set(x, y, z);
      m.castShadow = true;
      blob.add(m);
      return m;
    };
    part(new THREE.SphereGeometry(0.55, 20, 14), 0, 0.62, 0).scale.set(1, 1.1, 0.9);
    part(new THREE.SphereGeometry(0.45, 20, 14), 0, 1.35, 0);
    for (const sx of [-1, 1]) {
      part(new THREE.SphereGeometry(0.15, 12, 10), sx * 0.32, 1.72, 0);
      part(new THREE.SphereGeometry(0.17, 12, 10), sx * 0.52, 0.85, 0.05);
      part(new THREE.SphereGeometry(0.2, 12, 10), sx * 0.28, 0.15, 0.05);
    }
    const head = this.group(blob, 0, 1.35, 0);
    this.face(head, 0.05, 0.47, 0.75, 0.16);
    this.ball(head, 0.06, '#ff3b4f', 0, -0.14, 0.46);
    return (c, sp) => {
      const b = Math.abs(Math.sin(c * sp * 0.8));
      blob.position.y = b * 0.35;
      const sq = 1 - (1 - b) * 0.18;
      blob.scale.set(2 - sq, sq, 2 - sq);
    };
  }

  /** 월드 3 대장 케이크 왕: 3단 케이크 + 크림 + 촛불, 단이 엇갈려 흔들림 */
  private cake(): Animate {
    const B = this.body;
    const tiers: THREE.Object3D[] = [];
    const cols = ['#ffb3d9', '#fff3c4', '#c9a6ff'];
    for (let i = 0; i < 3; i++) {
      const t = this.group(B, 0, 0.3 + i * 0.55, 0);
      const r = 0.75 - i * 0.18;
      this.cyl(t, r, 0.5, cols[i]!, 0, 0, 0);
      this.add(t, new THREE.TorusGeometry(r, 0.07, 8, 28), '#ffffff', 0, 0.25, 0).rotation.x = Math.PI / 2;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        this.ball(t, 0.06, ['#ff5e6a', '#5aa9ff', '#7fd78a'][k % 3]!, Math.cos(a) * r, 0.05, Math.sin(a) * r);
      }
      tiers.push(t);
    }
    this.face(tiers[1]!, 0.02, 0.58, 0.85, 0.2);
    this.crownOn = { parent: tiers[2]!, x: 0, y: 0.28, z: 0.22 };
    const flames: THREE.Mesh[] = [];
    for (const x of [-0.18, 0, 0.18]) {
      this.cyl(tiers[2]!, 0.04, 0.3, '#ffffff', x, 0.42, 0);
      flames.push(this.ball(tiers[2]!, 0.06, '#ffb000', x, 0.62, 0));
    }
    return (c, sp) => {
      tiers.forEach((t, i) => { t.rotation.y = Math.sin(c * sp * 0.5 + i) * 0.15; });
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(c * 12 + i) * 0.3; });
      B.position.y = Math.abs(Math.sin(c * sp * 0.6)) * 0.05;
    };
  }

  /** 월드 4 외계인: 큰 머리 + 더듬이, 둥실 떠서 흔들 */
  private alien(tint: string): Animate {
    const B = this.body;
    const bob = this.group(B, 0, 0, 0);
    this.cyl(bob, 0.32, 0.7, '#7fd78a', 0, 0.55, 0, 0.42);
    this.box(bob, 0.5, 0.25, 0.06, 0.06, tint, 0, 0.6, 0.38);
    const head = this.group(bob, 0, 1.25, 0);
    this.ball(head, 0.52, '#8fe39a', 0, 0, 0).scale.set(1.1, 0.9, 1);
    this.face(head, 0.02, 0.44, 0.95, 0.22);
    const antennas = [-1, 1].map((sx) => {
      const a = this.group(head, sx * 0.25, 0.4, 0);
      this.cyl(a, 0.025, 0.4, '#5fc06c', 0, 0.2, 0);
      this.ball(a, 0.08, tint, 0, 0.42, 0);
      return a;
    });
    const arms = [-1, 1].map((sx) => {
      const a = this.group(bob, sx * 0.42, 0.75, 0);
      this.cyl(a, 0.06, 0.45, '#7fd78a', 0, -0.2, 0);
      this.ball(a, 0.09, '#8fe39a', 0, -0.45, 0);
      return a;
    });
    for (const sx of [-1, 1]) this.cyl(bob, 0.07, 0.3, '#5fc06c', sx * 0.15, 0.12, 0);
    return (c, sp) => {
      bob.position.y = 0.15 + Math.sin(c * sp * 0.5) * 0.12;
      antennas.forEach((a, i) => { a.rotation.z = Math.sin(c * sp + i * 2) * 0.35; });
      arms[0]!.rotation.z = -0.4 - Math.max(0, Math.sin(c * sp)) * 0.8;
      arms[1]!.rotation.z = 0.4 + Math.max(0, -Math.sin(c * sp)) * 0.8;
    };
  }

  /** 월드 4 대장 UFO: 접시 + 유리 돔 안 얼굴 + 도는 불빛 */
  private ufo(): Animate {
    const B = this.body;
    const ship = this.group(B, 0, 0.7, 0);
    this.cyl(ship, 1.1, 0.25, '#c3c9ec', 0, 0, 0, 1.3);
    this.cyl(ship, 0.6, 0.2, '#9aa6c4', 0, -0.2, 0, 0.9);
    const ring = this.group(ship, 0, 0.02, 0);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      this.ball(ring, 0.08, ['#ffd34d', '#ff5e6a', '#7cf0ff'][k % 3]!, Math.cos(a) * 1.2, 0, Math.sin(a) * 1.2);
    }
    const dome = this.add(ship, new THREE.SphereGeometry(0.62, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), '#bfefff', 0, 0.12, 0);
    (dome.material as THREE.MeshStandardMaterial).transparent = true;
    (dome.material as THREE.MeshStandardMaterial).opacity = 0.55;
    const pilot = this.group(ship, 0, 0.4, 0);
    this.ball(pilot, 0.36, '#8fe39a', 0, 0, 0);
    this.face(pilot, 0.02, 0.32, 0.7, 0.16);
    this.crownOn = { parent: ship, x: 0, y: 0.76, z: 0 };
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.cyl(B, 0.04, 0.6, '#9aa6c4', Math.cos(a) * 0.6, 0.3, Math.sin(a) * 0.6);
    }
    return (c, sp, dt) => {
      ring.rotation.y += dt * sp * 0.4;
      ship.position.y = 0.75 + Math.sin(c * sp * 0.4) * 0.1;
      ship.rotation.z = Math.sin(c * sp * 0.3) * 0.08;
    };
  }

  /** 월드 5 게: 집게 둘이 딱딱, 옆으로 종종 */
  private crab(tint: string): Animate {
    const B = this.body;
    this.ball(B, 0.62, tint, 0, 0.55, 0).scale.set(1.25, 0.7, 0.95);
    const eyes = this.group(B, 0, 0.95, 0.3);
    for (const sx of [-1, 1]) this.cyl(eyes, 0.04, 0.3, tint, sx * 0.2, 0.05, 0);
    this.face(eyes, 0.25, 0.08, 0.7, 0.2);
    const claws = [-1, 1].map((sx) => {
      const a = this.group(B, sx * 0.75, 0.6, 0.25);
      this.cyl(a, 0.07, 0.4, tint, sx * 0.1, 0.1, 0).rotation.z = sx * -0.8;
      const top = this.group(a, sx * 0.25, 0.35, 0);
      this.ball(top, 0.2, tint, 0, 0.1, 0).scale.set(1, 0.6, 0.8);
      const bot = this.group(a, sx * 0.25, 0.35, 0);
      this.ball(bot, 0.17, tint, 0, -0.06, 0).scale.set(1, 0.5, 0.8);
      return { top, bot };
    });
    const legs: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = this.group(B, sx * 0.6, 0.35, -0.25 + i * 0.25);
        this.cyl(l, 0.04, 0.4, tint, sx * 0.12, -0.12, 0).rotation.z = sx * 0.9;
        legs.push(l);
      }
    }
    return (c, sp) => {
      const w = Math.sin(c * sp);
      B.position.x = Math.sin(c * sp * 0.4) * 0.25;
      claws.forEach((k, i) => {
        const o = Math.max(0, Math.sin(c * sp * 1.4 + i)) * 0.5;
        k.top.rotation.z = (i ? 1 : -1) * o;
        k.bot.rotation.z = -(i ? 1 : -1) * o * 0.6;
      });
      legs.forEach((l, i) => { l.rotation.x = Math.sin(c * sp * 2 + i) * 0.3; });
      B.position.y = Math.abs(w) * 0.04;
    };
  }

  /** 월드 5 대장 상어: 몸통 + 등지느러미 + 꼬리 흔들, 입이 벌어짐 */
  private shark(): Animate {
    const B = this.body;
    const fish = this.group(B, 0, 0.9, 0);
    this.ball(fish, 0.6, '#6f8fbf', 0, 0, 0).scale.set(0.85, 0.8, 1.5);
    this.ball(fish, 0.5, '#f4f6ff', 0, -0.18, 0.15).scale.set(0.75, 0.55, 1.3);
    this.add(fish, new THREE.ConeGeometry(0.25, 0.55, 4), '#6f8fbf', 0, 0.62, -0.1).rotation.y = Math.PI / 4;
    this.face(fish, 0.18, 0.78, 0.75, 0.24);
    this.crownOn = { parent: fish, x: 0, y: 0.5, z: 0.45 };
    const jaw = this.group(fish, 0, -0.2, 0.62);
    this.box(jaw, 0.5, 0.1, 0.2, 0.05, '#ff7d8a', 0, 0, 0);
    for (let i = 0; i < 4; i++) this.add(jaw, new THREE.ConeGeometry(0.035, 0.09, 4), '#ffffff', -0.15 + i * 0.1, 0.08, 0.06);
    const tail = this.group(fish, 0, 0, -0.85);
    this.add(tail, new THREE.ConeGeometry(0.32, 0.6, 4), '#6f8fbf', 0, 0, -0.2).rotation.x = -Math.PI / 2;
    for (const sx of [-1, 1]) this.add(fish, new THREE.ConeGeometry(0.15, 0.45, 4), '#6f8fbf', sx * 0.5, -0.25, 0.1).rotation.z = sx * 2;
    this.cyl(B, 0.4, 0.15, '#5fc9ef', 0, 0.08, 0, 0.6);
    return (c, sp) => {
      tail.rotation.y = Math.sin(c * sp) * 0.5;
      fish.rotation.y = -Math.sin(c * sp) * 0.08;
      jaw.rotation.x = Math.max(0, Math.sin(c * sp * 0.6)) * 0.5;
      fish.position.y = 0.9 + Math.sin(c * sp * 0.5) * 0.1;
    };
  }

  /** 월드 6 펭귄: 뒤뚱뒤뚱, 날개 파닥 */
  private penguin(tint: string): Animate {
    const B = this.body;
    this.ball(B, 0.55, '#2b3150', 0, 0.75, 0).scale.set(1, 1.35, 0.95);
    this.ball(B, 0.45, '#ffffff', 0, 0.68, 0.18).scale.set(0.9, 1.25, 0.7);
    const head = this.group(B, 0, 1.45, 0);
    this.ball(head, 0.38, '#2b3150', 0, 0, 0);
    this.ball(head, 0.3, '#ffffff', 0, -0.05, 0.14).scale.set(1, 0.9, 0.7);
    this.face(head, 0.06, 0.41, 0.7, 0.14);
    this.add(head, new THREE.ConeGeometry(0.08, 0.2, 8), '#ffb347', 0, -0.12, 0.42).rotation.x = Math.PI / 2;
    this.cyl(head, 0.3, 0.1, tint, 0, -0.32, 0);
    const wings = [-1, 1].map((sx) => {
      const w = this.group(B, sx * 0.52, 1.0, 0);
      this.ball(w, 0.2, '#2b3150', 0, -0.25, 0).scale.set(0.35, 1.3, 0.8);
      return w;
    });
    for (const sx of [-1, 1]) this.ball(B, 0.16, '#ffb347', sx * 0.2, 0.05, 0.15).scale.set(1, 0.4, 1.4);
    return (c, sp) => {
      const w = Math.sin(c * sp);
      B.rotation.z = w * 0.15;
      wings[0]!.rotation.z = -0.2 - Math.max(0, w) * 0.7;
      wings[1]!.rotation.z = 0.2 + Math.max(0, -w) * 0.7;
      B.position.y = Math.abs(w) * 0.05;
    };
  }

  /** 월드 6 대장 눈사람 왕: 눈덩이 셋 + 목도리 + 나뭇가지 팔 */
  private snowking(): Animate {
    const B = this.body;
    const parts: THREE.Object3D[] = [];
    for (const [r, y] of [[0.6, 0.55], [0.45, 1.4], [0.36, 2.05]] as const) {
      const g = this.group(B, 0, y, 0);
      this.ball(g, r, '#ffffff', 0, 0, 0);
      parts.push(g);
    }
    for (let i = 0; i < 3; i++) this.ball(parts[1]!, 0.05, INK, 0, 0.2 - i * 0.17, 0.44);
    this.face(parts[2]!, 0.08, 0.32, 0.7, 0.14);
    this.crownOn = { parent: parts[2]!, x: 0, y: 0.34, z: 0 };
    this.add(parts[2]!, new THREE.ConeGeometry(0.07, 0.35, 10), '#ff8a2e', 0, -0.06, 0.45).rotation.x = Math.PI / 2;
    this.add(parts[1]!, new THREE.TorusGeometry(0.36, 0.1, 8, 20), '#ff5e6a', 0, 0.38, 0).rotation.x = Math.PI / 2;
    this.box(parts[1]!, 0.16, 0.45, 0.06, 0.03, '#ff5e6a', 0.2, 0.15, 0.36);
    const arms = [-1, 1].map((sx) => {
      const a = this.group(parts[1]!, sx * 0.42, 0.1, 0);
      this.cyl(a, 0.04, 0.7, '#8a5a3a', sx * 0.3, 0.15, 0).rotation.z = sx * -1.1;
      return a;
    });
    return (c, sp) => {
      const w = Math.sin(c * sp * 0.6);
      parts[1]!.rotation.y = w * 0.15;
      parts[2]!.rotation.z = -w * 0.1;
      arms[0]!.rotation.z = Math.max(0, w) * 0.6;
      arms[1]!.rotation.z = -Math.max(0, -w) * 0.6;
      B.position.y = Math.abs(w) * 0.05;
    };
  }

  /** 월드 7 기사: 투구 + 방패 + 칼, 칼을 휘두름 */
  private knight(tint: string): Animate {
    const B = this.body;
    this.cyl(B, 0.4, 0.8, '#c3c9d6', 0, 0.85, 0, 0.45);
    this.box(B, 0.6, 0.7, 0.08, 0.05, tint, 0, 0.88, 0.38);
    this.cyl(B, 0.46, 0.12, INK, 0, 0.5, 0);
    const head = this.group(B, 0, 1.55, 0);
    this.ball(head, 0.38, '#c3c9d6', 0, 0, 0);
    this.box(head, 0.5, 0.1, 0.06, 0.03, INK, 0, 0.2, 0.34);
    this.face(head, -0.02, 0.4, 0.6, 0.14);
    this.add(head, new THREE.ConeGeometry(0.1, 0.4, 8), tint, 0, 0.5, -0.05);
    const shield = this.group(B, -0.55, 0.95, 0.15);
    this.box(shield, 0.1, 0.65, 0.5, 0.06, tint, 0, 0, 0);
    this.box(shield, 0.12, 0.5, 0.1, 0.03, '#ffd34d', 0.01, 0, 0);
    const sword = this.group(B, 0.55, 1.05, 0.1);
    this.ball(sword, 0.12, '#c3c9d6', 0, 0, 0);
    this.box(sword, 0.08, 0.2, 0.08, 0.02, '#8a5a3a', 0, -0.15, 0.1);
    this.box(sword, 0.3, 0.06, 0.08, 0.02, '#ffd34d', 0, -0.05, 0.15);
    this.box(sword, 0.08, 0.8, 0.04, 0.02, '#eef2fa', 0, 0.35, 0.15);
    for (const sx of [-1, 1]) this.cyl(B, 0.1, 0.45, '#9aa6c4', sx * 0.18, 0.22, 0);
    return (c, sp) => {
      const w = Math.sin(c * sp * 0.8);
      sword.rotation.x = -0.4 - Math.max(0, w) * 1.2;
      shield.rotation.y = w * 0.2;
      B.position.y = Math.abs(Math.sin(c * sp)) * 0.05;
      head.rotation.y = w * 0.1;
    };
  }

  /** 월드 7 대장 장난감 용: 통통한 몸 + 날개 퍼덕 + 꼬리 */
  private dragon(tint: string): Animate {
    const B = this.body;
    this.ball(B, 0.62, tint, 0, 0.75, 0).scale.set(1, 1.1, 1);
    this.ball(B, 0.42, '#ffe7a8', 0, 0.7, 0.32).scale.set(1, 1.2, 0.5);
    const head = this.group(B, 0, 1.55, 0.1);
    this.ball(head, 0.42, tint, 0, 0, 0);
    this.ball(head, 0.25, tint, 0, -0.1, 0.32).scale.set(1.1, 0.8, 1);
    this.face(head, 0.12, 0.43, 0.7, 0.16);
    this.crownOn = { parent: head, x: 0, y: 0.4, z: -0.05 };
    for (const sx of [-1, 1]) {
      this.add(head, new THREE.ConeGeometry(0.08, 0.3, 8), '#ffd34d', sx * 0.22, 0.42, -0.05).rotation.z = -sx * 0.3;
      this.ball(head, 0.04, INK, sx * 0.08, -0.08, 0.56);
    }
    const wings = [-1, 1].map((sx) => {
      const w = this.group(B, sx * 0.45, 1.15, -0.25);
      const m = this.add(w, new THREE.ConeGeometry(0.5, 0.9, 3), '#7fd78a', sx * 0.45, 0.1, 0);
      m.rotation.z = sx * 1.3;
      m.scale.z = 0.15;
      return w;
    });
    const tail = this.group(B, 0, 0.45, -0.55);
    this.add(tail, new THREE.ConeGeometry(0.22, 0.8, 10), tint, 0, 0, -0.3).rotation.x = -Math.PI / 2.4;
    for (let i = 0; i < 3; i++) this.add(B, new THREE.ConeGeometry(0.1, 0.22, 4), '#ffd34d', 0, 1.25 - i * 0.3, -0.55);
    for (const sx of [-1, 1]) this.ball(B, 0.22, tint, sx * 0.3, 0.15, 0.1).scale.set(1, 0.8, 1.2);
    return (c, sp) => {
      const w = Math.sin(c * sp * 0.9);
      wings[0]!.rotation.z = w * 0.5;
      wings[1]!.rotation.z = -w * 0.5;
      tail.rotation.y = Math.sin(c * sp * 0.6) * 0.4;
      head.rotation.x = Math.sin(c * sp * 0.4) * 0.1;
      B.position.y = 0.05 + Math.abs(w) * 0.08;
    };
  }

  /** 월드 8 구름이: 솜사탕 구름 몸 + 무지개 띠, 둥실 */
  private cloudy(tint: string): Animate {
    const B = this.body;
    const puff = this.group(B, 0, 0.8, 0);
    for (const [x, y, z, r] of [[0, 0.1, 0, 0.55], [-0.45, -0.05, 0, 0.4], [0.45, -0.05, 0, 0.4], [-0.2, 0.42, -0.05, 0.36], [0.22, 0.4, -0.05, 0.34]] as const) {
      this.ball(puff, r, '#ffffff', x, y, z);
    }
    this.face(puff, 0.1, 0.52, 0.8, 0.18);
    const band = this.add(puff, new THREE.TorusGeometry(0.62, 0.06, 8, 30, Math.PI), tint, 0, -0.25, -0.1);
    band.rotation.z = Math.PI;
    const drops = [0, 1, 2].map((i) => this.ball(B, 0.07, '#9fd8ff', -0.3 + i * 0.3, 0.2, 0.1));
    return (c, sp) => {
      puff.position.y = 0.85 + Math.sin(c * sp * 0.5) * 0.12;
      puff.rotation.z = Math.sin(c * sp * 0.4) * 0.08;
      drops.forEach((d, i) => {
        const k = ((c * 0.8 + i * 0.33) % 1);
        d.position.y = 0.55 - k * 0.5;
        d.visible = k < 0.9;
      });
    };
  }

  /** 월드 8 대장 유니콘: 몸통 + 무지개 갈기 + 뿔, 앞발 들썩 */
  private unicorn(): Animate {
    const B = this.body;
    const body = this.group(B, 0, 0.95, 0);
    this.ball(body, 0.55, '#ffffff', 0, 0, 0).scale.set(0.9, 0.85, 1.3);
    const legs = [[-0.28, 0.4], [0.28, 0.4], [-0.28, -0.4], [0.28, -0.4]].map(([x, z]) => {
      const l = this.group(B, x!, 0.62, z!);
      this.cyl(l, 0.1, 0.62, '#ffffff', 0, -0.3, 0);
      this.cyl(l, 0.11, 0.1, '#c9b3ff', 0, -0.6, 0);
      return l;
    });
    const head = this.group(body, 0, 0.55, 0.62);
    this.ball(head, 0.36, '#ffffff', 0, 0, 0).scale.set(0.9, 1, 1.1);
    this.ball(head, 0.2, '#ffe3f4', 0, -0.12, 0.3).scale.set(1, 0.7, 0.8);
    this.face(head, 0.08, 0.42, 0.65, 0.16);
    this.crownOn = { parent: head, x: 0, y: 0.34, z: -0.12 };
    this.add(head, new THREE.ConeGeometry(0.07, 0.42, 12), '#ffd34d', 0, 0.45, 0.12).rotation.x = 0.3;
    const mane = ['#ff6b6b', '#ffb347', '#ffd34d', '#7fd78a', '#5aa9ff', '#9b87ff'];
    mane.forEach((col, i) => this.ball(body, 0.13, col, 0, 0.45 + Math.sin(i * 0.5) * 0.1, 0.45 - i * 0.16));
    const tail = this.group(body, 0, 0.1, -0.72);
    mane.forEach((col, i) => this.ball(tail, 0.1, col, 0, -i * 0.1, -i * 0.05));
    return (c, sp) => {
      const w = Math.sin(c * sp * 0.6);
      legs[0]!.rotation.x = -Math.max(0, w) * 0.8;
      legs[1]!.rotation.x = -Math.max(0, w) * 0.8;
      body.rotation.x = -Math.max(0, w) * 0.2;
      tail.rotation.y = Math.sin(c * sp) * 0.4;
      head.rotation.y = Math.sin(c * sp * 0.3) * 0.15;
    };
  }

  /** 왕관 붙일 곳 (대장 조립 때 머리 묶음과 그 안 높이). 없으면 몸 전체 꼭대기 가운데 */
  private crownOn: { parent: THREE.Object3D; x: number; y: number; z: number } | null = null;

  /** 대장 왕관 (머리 꼭대기, 사용자 2026-11-12: 머리가 앞에 있는 대장은 몸 가운데 위에 떠 보였음) */
  private crown(): void {
    let g: THREE.Group;
    if (this.crownOn) g = this.group(this.crownOn.parent, this.crownOn.x, this.crownOn.y, this.crownOn.z);
    else {
      const box = new THREE.Box3().setFromObject(this.body);
      g = this.group(this.body, 0, box.max.y - 0.05, 0);
    }
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

  /** 장난감 던지기: 몸을 앞으로 숙였다 폄 */
  throwToy(): void {
    if (this.dieT < 0) this.throwT = 0;
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
    if (this.throwT < 1) {
      this.throwT = Math.min(1, this.throwT + dt * 3);
      this.body.rotation.x = Math.sin(this.throwT * Math.PI) * 0.35;
    } else this.body.rotation.x = 0;
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
