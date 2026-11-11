import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LoadedModel } from '../assets/loadAssets';
import { CHARACTER } from '../config/gameConfig';
import { BALANCE } from '../sim/balance.ts';
import { isBoss } from '../sim/stages.ts';

/** 플레이어 키 기준(m) */
const BASE_H = 1.6;
const TINTS = ['#ff6b6b', '#ffb347', '#7cc4ff', '#b9a6ff', '#7fd78a', '#ff9ec4', '#ffd34d', '#5ec8c8', '#ff8a5b'];
const ENTER_SEC = 0.45;
const DIE_SEC = 0.75;

/** 월드 안 번호(1~10) → 키 배수: 1~9번 1.5→3배, 대장 4배 */
export function bossScale(stage: number): number {
  const i = ((stage - 1) % BALANCE.stage.perWorld) + 1;
  return isBoss(stage) ? 4 : 1.5 + ((i - 1) * 1.5) / 8;
}

/**
 * 임시 보스: 팝배틀 캐릭터를 크게 복제 + 색 입힘. 등장 = 통 튀어나옴, 맞으면 찌그러졌다 복귀,
 * 체력 50%·25%에서 색 진해짐, 쓰러지면 튀어 오르며 돌다 작아져 사라짐.
 * 소유: 복제 material·skeleton(boneTexture)·왕관 geometry/material → dispose(). 원본 geometry·texture는 공유라 해제 안 함.
 */
export class Boss {
  readonly root = new THREE.Group();
  readonly height: number;
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly mats: { m: THREE.MeshStandardMaterial; base: THREE.Color }[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private readonly tint: THREE.Color;
  private readonly size: number;
  private hitT = 1;
  private enterT = 0;
  private dieT = -1;
  private stageTint = 0;
  private clock = Math.random() * 10;

  constructor(src: LoadedModel, stage: number) {
    this.model = SkeletonUtils.clone(src.scene);
    this.tint = new THREE.Color(TINTS[(stage - 1) % TINTS.length]!);
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const m = (mesh.material as THREE.MeshStandardMaterial).clone();
      const base = m.color.clone().lerp(this.tint, 0.55);
      m.color.copy(base);
      mesh.material = m;
      this.mats.push({ m, base });
    });
    // 원본 크기로 키 맞추기
    const box = new THREE.Box3().setFromObject(this.model);
    const h0 = Math.max(0.01, box.max.y - box.min.y);
    this.height = BASE_H * bossScale(stage);
    this.size = this.height / h0;
    this.model.scale.setScalar(this.size);
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    const idle = src.clips.find((c) => c.name === CHARACTER.clips.idle);
    if (idle) this.mixer.clipAction(idle).play();
    if (isBoss(stage)) this.addCrown();
    this.root.scale.setScalar(0.001);
  }

  private addCrown(): void {
    const geo = new THREE.CylinderGeometry(0.32, 0.26, 0.28, 5, 1, true);
    const mat = new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.4, roughness: 0.3, side: THREE.DoubleSide, emissive: '#ffb000', emissiveIntensity: 0.25 });
    this.owned.push(geo, mat);
    const crown = new THREE.Mesh(geo, mat);
    // 모델 좌표(스케일 전) 머리 위
    crown.scale.setScalar(1 / this.size * (this.height / 4));
    crown.position.y = (this.height + 0.15 * (this.height / 4)) / this.size;
    this.model.add(crown);
  }

  /** 가슴 높이 (조준점) */
  chest(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.root.position.x, this.root.position.y + this.height * 0.55, this.root.position.z);
  }

  hit(): void {
    if (this.dieT < 0) this.hitT = 0;
  }

  /** 남은 체력 비율: 50%·25% 아래면 색 진하게 */
  setHpRatio(r: number): void {
    const t = r <= 0.25 ? 2 : r <= 0.5 ? 1 : 0;
    if (t === this.stageTint) return;
    this.stageTint = t;
    const dark = new THREE.Color('#5a1020');
    for (const { m, base } of this.mats) m.color.copy(base).lerp(dark, t * 0.22);
  }

  defeat(): void {
    if (this.dieT < 0) this.dieT = 0;
  }

  get gone(): boolean {
    return this.dieT >= DIE_SEC;
  }

  update(dt: number): void {
    this.clock += dt;
    this.mixer.update(dt);
    let sx = 1;
    let sy = 1;
    // 등장: 0 → 1.15 → 1
    if (this.enterT < ENTER_SEC) {
      this.enterT = Math.min(ENTER_SEC, this.enterT + dt);
      const k = this.enterT / ENTER_SEC;
      const s = k < 0.7 ? (k / 0.7) * 1.15 : 1.15 - ((k - 0.7) / 0.3) * 0.15;
      sx = sy = s;
    }
    // 맞음: 납작했다 복귀
    if (this.hitT < 1) {
      this.hitT = Math.min(1, this.hitT + dt * 6);
      const q = Math.sin(this.hitT * Math.PI) * 0.12;
      sx *= 1 + q;
      sy *= 1 - q;
    }
    // 숨쉬기
    sy *= 1 + Math.sin(this.clock * 3) * 0.02;
    if (this.dieT >= 0) {
      this.dieT += dt;
      const k = Math.min(1, this.dieT / DIE_SEC);
      this.root.position.y = Math.sin(k * Math.PI) * this.height * 0.5;
      this.root.rotation.y += dt * 14;
      const s = 1 - k * k;
      sx *= s;
      sy *= s;
    }
    this.root.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sx));
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.model.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.skeleton.dispose();
    });
    for (const { m } of this.mats) m.dispose();
    for (const o of this.owned) o.dispose();
    this.root.removeFromParent();
  }
}
