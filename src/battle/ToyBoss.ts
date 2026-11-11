import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { isBoss } from '../sim/stages.ts';
import { bossScale } from './Boss';

const TINTS = ['#ff6b6b', '#ffb347', '#5aa9ff', '#9b87ff', '#4cc56a', '#ff7fbf', '#ffc93c', '#36c2c2', '#ff8a5b'];
const ENTER_SEC = 0.45;
const DIE_SEC = 1.2;
/** 기본 키(m, bossScale 1배일 때) */
const BASE_H = 1.6;

interface Part { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3 }

/**
 * 시안: 뼈대 없는 태엽 로봇 장난감 보스 (도형 조립, 외부 파일 없음).
 * 뒤뚱 걸음 · 태엽 돌기 · 팔 흔들기, 맞으면 찌그러짐 + 눈 질끈, 체력 50%·25%에서 눈썹·볼 화남,
 * 쓰러지면 부품이 사방으로 튀며 분해.
 * 소유: 이 보스가 만든 geometry·material 전부 → dispose().
 */
export class ToyBoss {
  readonly root = new THREE.Group();
  readonly height: number;
  private readonly body = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private readonly mats = new Map<string, THREE.MeshStandardMaterial>();
  private readonly key = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly browL: THREE.Mesh;
  private readonly browR: THREE.Mesh;
  private readonly eyes: THREE.Group[] = [];
  private readonly cheeks: THREE.Mesh[] = [];
  private readonly parts: Part[] = [];
  private hitT = 1;
  private enterT = 0;
  private dieT = -1;
  private anger = 0;
  private clock = Math.random() * 10;

  constructor(stage: number) {
    const tint = TINTS[(stage - 1) % TINTS.length]!;
    const B = this.body;
    // 몸통 + 배 판 + 버튼
    this.box(B, 1.0, 0.95, 0.8, 0.14, tint, 0, 0.95, 0);
    this.box(B, 0.62, 0.5, 0.06, 0.05, '#fff6e0', 0, 0.98, 0.41);
    ['#ff5e6a', '#ffd34d', '#5ccf6b'].forEach((c, i) => this.sphere(B, 0.055, c, -0.15 + i * 0.15, 1.08, 0.45));
    this.box(B, 0.4, 0.06, 0.04, 0.02, '#c9b38a', 0, 0.88, 0.45);
    // 머리
    const head = new THREE.Group();
    head.position.y = 1.43;
    B.add(head);
    this.box(head, 0.95, 0.72, 0.78, 0.16, '#e9eef8', 0, 0.36, 0);
    this.box(head, 0.95, 0.12, 0.8, 0.05, tint, 0, 0.02, 0);
    // 눈 (흰자 + 눈동자 + 반짝)
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.21, 0.4, 0.38);
      this.sphere(eye, 0.15, '#ffffff', 0, 0, 0).scale.set(1, 1.1, 0.5);
      this.sphere(eye, 0.085, '#2b3a67', 0, -0.01, 0.06).scale.set(1, 1.15, 0.6);
      this.sphere(eye, 0.03, '#ffffff', 0.03, 0.04, 0.1);
      head.add(eye);
      this.eyes.push(eye);
      const cheek = this.sphere(head, 0.07, '#ff9ec4', sx * 0.33, 0.2, 0.37);
      cheek.scale.set(1, 0.6, 0.3);
      this.cheeks.push(cheek);
    }
    this.browL = this.box(head, 0.24, 0.06, 0.05, 0.02, '#2b3a67', -0.21, 0.62, 0.4);
    this.browR = this.box(head, 0.24, 0.06, 0.05, 0.02, '#2b3a67', 0.21, 0.62, 0.4);
    // 입 (이빨 두 개)
    this.box(head, 0.3, 0.1, 0.05, 0.04, '#2b3a67', 0, 0.16, 0.39);
    this.box(head, 0.07, 0.05, 0.03, 0.01, '#ffffff', -0.06, 0.19, 0.42);
    this.box(head, 0.07, 0.05, 0.03, 0.01, '#ffffff', 0.06, 0.19, 0.42);
    // 안테나
    this.cyl(head, 0.025, 0.25, '#9aa6c4', 0, 0.84, 0);
    this.sphere(head, 0.08, '#ff5e6a', 0, 0.99, 0);
    // 팔 (어깨에서 흔들림) + 집게
    for (const [arm, sx] of [[this.armL, -1], [this.armR, 1]] as const) {
      arm.position.set(sx * 0.58, 1.25, 0);
      this.sphere(arm, 0.13, tint, 0, 0, 0);
      this.cyl(arm, 0.07, 0.42, '#9aa6c4', 0, -0.25, 0);
      const claw = new THREE.TorusGeometry(0.11, 0.045, 8, 16, Math.PI * 1.4);
      this.owned.push(claw);
      const c = new THREE.Mesh(claw, this.mat(tint));
      c.position.set(0, -0.52, 0);
      c.rotation.set(0, Math.PI / 2, Math.PI * 1.2);
      arm.add(c);
      B.add(arm);
    }
    // 다리 + 발
    for (const [leg, sx] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(sx * 0.25, 0.5, 0);
      this.cyl(leg, 0.09, 0.36, '#9aa6c4', 0, -0.2, 0);
      this.box(leg, 0.26, 0.14, 0.36, 0.05, '#2b3a67', 0, -0.42, 0.05);
      B.add(leg);
    }
    // 등 태엽
    this.key.position.set(0, 1.0, -0.42);
    this.cyl(this.key, 0.05, 0.22, '#ffd34d', 0, 0, -0.1).rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) this.sphere(this.key, 0.16, '#ffd34d', sx * 0.17, 0, -0.22).scale.set(1, 0.65, 0.25);
    B.add(this.key);
    if (isBoss(stage)) this.crown(head);
    // 크기: 키 = BASE_H × 배수 (모델 키 ≈ 2.45)
    this.height = BASE_H * bossScale(stage);
    B.scale.setScalar(this.height / 2.45);
    this.root.add(B);
    this.root.scale.setScalar(0.001);
  }

  private mat(color: string): THREE.MeshStandardMaterial {
    let m = this.mats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 });
      this.mats.set(color, m);
      this.owned.push(m);
    }
    return m;
  }

  private add(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number): THREE.Mesh {
    this.owned.push(geo);
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  private box(p: THREE.Object3D, w: number, h: number, d: number, r: number, c: string, x: number, y: number, z: number): THREE.Mesh {
    return this.add(p, new RoundedBoxGeometry(w, h, d, 3, r), c, x, y, z);
  }

  private sphere(p: THREE.Object3D, r: number, c: string, x: number, y: number, z: number): THREE.Mesh {
    return this.add(p, new THREE.SphereGeometry(r, 18, 12), c, x, y, z);
  }

  private cyl(p: THREE.Object3D, r: number, h: number, c: string, x: number, y: number, z: number): THREE.Mesh {
    return this.add(p, new THREE.CylinderGeometry(r, r, h, 12), c, x, y, z);
  }

  private crown(head: THREE.Object3D): void {
    const g = new THREE.Group();
    g.position.y = 0.78;
    this.cyl(g, 0.3, 0.16, '#ffd34d', 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const cone = this.add(g, new THREE.ConeGeometry(0.08, 0.2, 8), '#ffd34d', Math.cos(a) * 0.24, 0.17, Math.sin(a) * 0.24);
      cone.castShadow = true;
      this.sphere(g, 0.04, i % 2 ? '#ff5e6a' : '#5aa9ff', Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3);
    }
    head.add(g);
  }

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
    // 몸통의 직속 부품을 떼어 사방으로
    const kids = [...this.body.children];
    for (const k of kids) {
      const dir = new THREE.Vector3(k.position.x + (Math.random() - 0.5) * 0.6, 1.2 + Math.random(), k.position.z + (Math.random() - 0.3) * 0.8).normalize();
      this.parts.push({ obj: k, vel: dir.multiplyScalar(3 + Math.random() * 3), spin: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5) });
    }
  }

  get gone(): boolean {
    return this.dieT >= DIE_SEC;
  }

  update(dt: number): void {
    this.clock += dt;
    const c = this.clock;
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
    // 뒤뚱: 몸 좌우 기울기 + 다리 번갈아, 태엽 회전, 팔 흔들기
    const speed = 5 + this.anger * 2.5;
    this.body.rotation.z = Math.sin(c * speed) * 0.08;
    this.body.position.y = Math.abs(Math.sin(c * speed)) * 0.06;
    this.legL.rotation.x = Math.sin(c * speed) * 0.35;
    this.legR.rotation.x = -Math.sin(c * speed) * 0.35;
    this.armL.rotation.x = -Math.sin(c * speed) * 0.5;
    this.armR.rotation.x = Math.sin(c * speed) * 0.5;
    this.armL.rotation.z = -0.25;
    this.armR.rotation.z = 0.25;
    this.key.rotation.z += dt * (4 + this.anger * 3);
    // 눈썹: 화날수록 안쪽이 내려감
    const brow = 0.15 + this.anger * 0.2;
    this.browL.rotation.z = -brow;
    this.browR.rotation.z = brow;
    for (const ch of this.cheeks) ch.visible = this.anger > 0;
    // 맞음: 눈 질끈 + 찌그러짐
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
