import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WEAPONS } from '../config/weapons';
import type { Assets } from '../assets/loadAssets';
import type { GunDef } from '../sim/guns.ts';
import type { CharId } from '../sim/state.ts';
import { PlayerAvatar, type AvatarFrame } from './PlayerAvatar';
import type { TrainKind } from '../sim/training.ts';
import { makeGlove, makeGoggles, makePiggy } from './GearVisual';
import { applyCheer, cheerBones } from './cheerPose';

export interface AvatarPose {
  pos: THREE.Vector3;
  yaw: number;
  /** 현재 이동 속도 벡터 (m/s, 걷기 클립 선택용) */
  velocity: THREE.Vector3;
  /** 겨눌 곳 (없으면 정면) */
  aimAt: THREE.Vector3 | null;
  /** 반동 (m) */
  kick: number;
  /** 공중이면 false (점프·공중·착지 클립 자동 재생). 없으면 땅 */
  grounded?: boolean;
  /** 쓰러짐 (사망 클립) */
  dead?: boolean;
  /** 만세 자세 섞기 0..1 (동전 분수·월드 클리어). 0.3 넘으면 총 숨김 */
  cheer?: number;
}

const _dir = new THREE.Vector3();
/** 이 속도(m/s) 넘으면 달리기 클립 */
const RUN_FROM = 3;
const _chest = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();

export type GearTiers = Record<TrainKind, number>;
/** 아바타 기준(발 = 0, 앞 = +z) 장비 자리 (m). 화면에서 맞춤 */
const PIGGY_AT = new THREE.Vector3(0, 0.5, -0.18);

/** 팝배틀 PlayerAvatar 감싸기: 캐릭터 복제 + 월드 색 총 + 간단한 자세 입력 */
export class Avatar {
  readonly root: THREE.Object3D;
  private readonly avatar: PlayerAvatar;
  private readonly assets: Assets;
  /** 손에 든 총 (복제본). 재질 복제·해제는 PlayerAvatar가 함 (prepareWeapon·releaseWeapon). 총 geometry·texture는 GLB 원본과 공유 */
  private gunObj: THREE.Object3D;
  private readonly frame: AvatarFrame;
  private airTime = 0;
  private cheerB: ReturnType<typeof cheerBones> | undefined;
  private clock = 0;
  /** 붙인 장비 (종류별 단계와 오브젝트). 도형·재질은 GearVisual 공유라 떼기만 함 */
  private readonly gear: Record<TrainKind, { tier: number; objs: THREE.Object3D[] }> = {
    atk: { tier: 0, objs: [] }, spd: { tier: 0, objs: [] }, coin: { tier: 0, objs: [] },
  };

  constructor(assets: Assets, char: CharId, gun: GunDef) {
    this.assets = assets;
    const src = assets.characters[char];
    this.gunObj = this.assets.guns[gun.model].clone(true);
    this.avatar = new PlayerAvatar(SkeletonUtils.clone(src.scene), src.clips, this.gunObj, WEAPONS[gun.model]!.mount, char);
    this.tintGun(gun);
    this.root = this.avatar.root;
    this.frame = {
      dt: 0, feet: new THREE.Vector3(), bodyYaw: 0, aimDir: new THREE.Vector3(0, 0, 1), pitch: 0,
      mode: 'ground', grounded: true, sprinting: false, velocity: new THREE.Vector3(),
      justJumped: false, justLanded: false, landedAirTime: 0, dead: false, strafing: false,
      weaponKick: 0, weaponRaise: 1, reloadProgress: 0,
    };
  }

  /** 총 색: PlayerAvatar가 이미 복제한 재질(rifleMeshes)에 바로 칠함 (여기서 또 복제하지 않음) */
  private tintGun(gun: GunDef): void {
    const tint = new THREE.Color(gun.tint);
    for (const mesh of this.avatar.rifleMeshes) {
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.color) m.color.multiply(tint);
    }
  }

  setGun(gun: GunDef): void {
    const prev = this.gunObj;
    this.gunObj = this.assets.guns[gun.model].clone(true);
    this.avatar.setWeapon(this.gunObj, WEAPONS[gun.model]!.mount);
    this.tintGun(gun);
    // 예전 총은 다시 들지 않음 (다음 교체도 새 복제본) → 재질 해제
    this.avatar.releaseWeapon(prev);
  }

  update(dt: number, p: AvatarPose): void {
    const f = this.frame;
    f.dt = dt;
    f.feet.copy(p.pos);
    f.bodyYaw = p.yaw;
    f.velocity.copy(p.velocity);
    // 조이스틱을 어느 정도 이상 밀면 달리기 클립 (살짝 밀면 걷기)
    f.sprinting = Math.hypot(p.velocity.x, p.velocity.z) > RUN_FROM;
    f.weaponKick = p.kick;
    const grounded = p.grounded ?? true;
    f.justJumped = f.grounded && !grounded;
    f.justLanded = !f.grounded && grounded;
    f.landedAirTime = this.airTime;
    this.airTime = grounded ? 0 : this.airTime + dt;
    f.grounded = grounded;
    f.mode = grounded ? 'ground' : 'air';
    f.dead = p.dead ?? false;
    if (p.aimAt) {
      this.avatar.getChestPosition(_chest);
      _dir.copy(p.aimAt).sub(_chest);
      if (_dir.lengthSq() > 1e-6) {
        _dir.normalize();
        f.aimDir.copy(_dir);
        f.pitch = Math.asin(THREE.MathUtils.clamp(_dir.y, -1, 1));
      }
    } else {
      f.aimDir.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
      f.pitch = -0.1;
    }
    this.avatar.update(f);
    this.clock += dt;
    const cheer = p.cheer ?? 0;
    this.gunObj.visible = cheer < 0.3;
    if (cheer > 0) {
      if (this.cheerB === undefined) this.cheerB = cheerBones(this.root);
      if (this.cheerB) applyCheer(this.root, this.cheerB, p.yaw, cheer, this.clock);
    }
  }

  /** 머리 꼭대기 높이 (월드 y, 마지막 update 기준) — 이름표 자리 */
  headTop(): number {
    return this.avatar.headCenter.y + this.avatar.headRadius;
  }

  getMuzzle(out: THREE.Vector3): void {
    this.avatar.getMuzzle(out);
  }

  /** 장비 표시 (종류마다 가장 높은 단계, 0 = 없음). 바뀐 종류만 다시 붙임 */
  setGear(tiers: GearTiers): void {
    this.root.updateMatrixWorld(true);
    for (const k of ['atk', 'spd', 'coin'] as const) {
      const cur = this.gear[k];
      if (cur.tier === tiers[k]) continue;
      for (const o of cur.objs) o.removeFromParent();
      cur.objs = [];
      cur.tier = tiers[k];
      if (cur.tier <= 0) continue;
      if (k === 'atk') {
        for (const bone of ['Hand_R', 'Hand_L']) cur.objs.push(this.attach(makeGlove(cur.tier), bone, null));
      } else if (k === 'spd') {
        // 고글 = 모자 앞 위쪽에 얹음: 그 자리 모자 정점을 실제로 움직이는 뼈에 붙임 (머리 뼈가 없고 모자는 Spine에 스킨됨 → 예전 Chest는 뛸 때 따로 놂, 사용자 2026-11-13)
        const hat = this.hatSpot();
        if (hat) {
          const o = this.attach(makeGoggles(cur.tier), hat.bone, hat.at);
          // 모자 곡면을 따라 위쪽이 살짝 뒤로 눕게
          o.rotateX(-0.45);
          cur.objs.push(o);
        }
      } else {
        cur.objs.push(this.attach(makePiggy(cur.tier), 'Chest', PIGGY_AT));
      }
    }
  }

  /** 모자 앞 위쪽 자리(아바타 기준)와 그 정점을 가장 크게 움직이는 뼈 (아바타마다 한 번 계산) */
  private hatCache: { bone: string; at: THREE.Vector3 } | null | undefined;
  private hatSpot(): { bone: string; at: THREE.Vector3 } | null {
    if (this.hatCache !== undefined) return this.hatCache;
    this.hatCache = null;
    let mesh: THREE.SkinnedMesh | null = null;
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && (!mesh || m.geometry.attributes.position!.count > mesh.geometry.attributes.position!.count)) mesh = m;
    });
    const m = mesh as THREE.SkinnedMesh | null;
    if (!m) return null;
    this.root.updateMatrixWorld(true);
    m.skeleton.update();
    const pos = m.geometry.attributes.position!;
    const n = pos.count;
    const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
    let top = -Infinity;
    for (let i = 0; i < n; i++) {
      _w.fromBufferAttribute(pos, i);
      m.applyBoneTransform(i, _w);
      m.localToWorld(_w);
      this.root.worldToLocal(_w);
      xs[i] = _w.x; ys[i] = _w.y; zs[i] = _w.z;
      if (_w.y > top) top = _w.y;
    }
    // 머리 꼭대기에서 0.09~0.17m 아래, 가운데(|x| < 0.05) 중 가장 앞쪽 정점
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (ys[i]! > top - 0.09 || ys[i]! < top - 0.17 || Math.abs(xs[i]!) > 0.05) continue;
      if (best < 0 || zs[i]! > zs[best]!) best = i;
    }
    if (best < 0) return null;
    const idx = m.geometry.attributes.skinIndex!, wgt = m.geometry.attributes.skinWeight!;
    let bi = 0, bw = -1;
    for (let k = 0; k < 4; k++) if (wgt.getComponent(best, k) > bw) { bw = wgt.getComponent(best, k); bi = idx.getComponent(best, k); }
    const bone = m.skeleton.bones[bi];
    if (!bone) return null;
    this.hatCache = { bone: bone.name, at: new THREE.Vector3(0, ys[best]!, zs[best]! + 0.015) };
    return this.hatCache;
  }

  /** 본에 붙이기: at = 아바타 기준 자리(null이면 본 원점), 방향은 아바타 정면, 월드 크기 1 유지 */
  private attach(obj: THREE.Object3D, boneName: string, at: THREE.Vector3 | null): THREE.Object3D {
    const bone = this.root.getObjectByName(boneName);
    if (!bone) return obj;
    bone.add(obj);
    bone.getWorldScale(_s);
    obj.scale.set(1 / _s.x, 1 / _s.y, 1 / _s.z);
    if (at) {
      _w.copy(at);
      this.root.localToWorld(_w);
      obj.position.copy(bone.worldToLocal(_w));
    }
    bone.getWorldQuaternion(_q);
    this.root.getWorldQuaternion(_q2);
    obj.quaternion.copy(_q.invert().multiply(_q2));
    return obj;
  }

  dispose(): void {
    // 총 재질도 PlayerAvatar.materials에 있어 같이 해제됨
    this.avatar.dispose();
  }
}
