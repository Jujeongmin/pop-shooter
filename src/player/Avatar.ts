import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WEAPONS } from '../config/weapons';
import type { Assets } from '../assets/loadAssets';
import type { GunDef, GunModel } from '../sim/guns.ts';
import type { CharId } from '../sim/state.ts';
import { PlayerAvatar, type AvatarFrame } from './PlayerAvatar';
import type { TrainKind } from '../sim/training.ts';
import { makeGlove, makeGoggles, makePiggy, piggySize } from './GearVisual';
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

/** want를 받았으면 want, 아니면 받은 캐릭터 중 하나 (BUBU 먼저) */
export function loadedChar(assets: Assets, want: CharId): CharId {
  if (assets.characters[want]) return want;
  if (assets.characters.blue) return 'blue';
  return (Object.keys(assets.characters) as CharId[])[0] ?? want;
}

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

  /** 실제로 만든 캐릭터 (그 캐릭터를 아직 안 받았으면 받은 캐릭터로 대신 — 받은 뒤 부르는 쪽이 다시 만듦) */
  readonly char: CharId;

  constructor(assets: Assets, want: CharId, gun: GunDef) {
    this.assets = assets;
    const char = loadedChar(assets, want);
    this.char = char;
    const src = assets.characters[char]!;
    this.wantGun = gun;
    const gm = this.heldModel(gun);
    this.gunObj = this.assets.guns[gm]!.clone(true);
    this.avatar = new PlayerAvatar(SkeletonUtils.clone(src.scene), src.clips, this.gunObj, WEAPONS[gm]!.mount, char);
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

  /** 들려는 총 (아직 안 받은 모델이면 받은 뒤 다시 듦) */
  private wantGun: GunDef;
  private disposed = false;

  /**
   * 지금 들 수 있는 모델: 그 총을 받았으면 그것, 아니면 받은 총 중 하나 (시작할 때 내 총만 받음, 2026-11-13).
   * 대신 들었으면 받은 뒤 setGun을 다시 부름 (그사이 총을 또 바꿨거나 해제됐으면 안 함)
   */
  private heldModel(gun: GunDef): GunModel {
    if (this.assets.guns[gun.model]) return gun.model;
    void this.assets.gun(gun.model).then(() => { if (!this.disposed && this.wantGun === gun) this.setGun(gun); }, () => undefined);
    return (Object.keys(this.assets.guns) as GunModel[])[0]!;
  }

  setGun(gun: GunDef): void {
    this.wantGun = gun;
    const gm = this.heldModel(gun);
    const prev = this.gunObj;
    // 멀리 있으면(세부 끔) 가벼운 총 (같은 축·원점이라 장착값 공용)
    const low = !this.detail ? this.assets.gunsLow[gm] : undefined;
    this.lowGun = !!low;
    this.gunObj = (low ?? this.assets.guns[gm]!).clone(true);
    this.avatar.setWeapon(this.gunObj, WEAPONS[gm]!.mount);
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
    // 첫 자세가 잡힌 뒤에 장비를 붙임 (아래 setGear 참고)
    if (!this.posed) {
      this.posed = true;
      const pending = this.pendingGear;
      this.pendingGear = null;
      if (pending) this.setGear(pending);
    }
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

  /** 첫 update(애니메이션 자세)를 마쳤는지 */
  private posed = false;
  /** 첫 자세 전에 받은 장비 (첫 update에서 붙임) */
  private pendingGear: GearTiers | null = null;

  /**
   * 장비 표시 (종류마다 가장 높은 단계, 0 = 없음). 바뀐 종류만 다시 붙임.
   * 만든 직후(첫 update 전)면 첫 자세가 잡힐 때까지 미룸: 기본 자세(바인드 포즈)의 등·가슴 뼈 기준으로 붙이면
   * 대기 자세에서 저금통이 등에서 13cm쯤 더 떨어져 떠 보였음 (2026-11-17 배포본: 새로고침한 내 캐릭터·새로 들어온 다른 사람)
   */
  setGear(tiers: GearTiers): void {
    if (!this.posed) {
      this.pendingGear = tiers;
      return;
    }
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
        // 저금통 = 캐릭터마다 실제 등 표면(가방·후드 포함)에 30%만 묻히게 (고정 자리는 노랑·빨강·분홍·검정에서 가방 속에 묻힘, 사용자 2026-11-13)
        cur.objs.push(this.attach(makePiggy(cur.tier), 'Chest', this.piggySpot(cur.tier)));
      }
    }
    // 멀리 있어 세부를 끈 아바타면 새로 붙인 장비도 숨김
    if (!this.detail) for (const k of ['atk', 'spd', 'coin'] as const) for (const o of this.gear[k].objs) o.visible = false;
  }

  /** 몸 메시 정점의 현재 자세 위치 (아바타 기준, 한 번 계산해 둠: 고글·저금통 자리 찾기용) */
  private body: { mesh: THREE.SkinnedMesh; xs: Float32Array; ys: Float32Array; zs: Float32Array; top: number } | null | undefined;
  /** 원래 몸 메시 (정점이 가장 많은 스킨 메시, LOD 몸 제외) */
  private bodyMesh(): THREE.SkinnedMesh | null {
    if (this.body) return this.body.mesh;
    let mesh: THREE.SkinnedMesh | null = null;
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh && m.userData.lod !== true && (!mesh || m.geometry.attributes.position!.count > mesh.geometry.attributes.position!.count)) mesh = m;
    });
    return mesh;
  }

  private bodyPoints(): NonNullable<Avatar['body']> | null {
    if (this.body !== undefined) return this.body;
    const m = this.bodyMesh();
    // 첫 자세 전(바인드 포즈)의 정점은 저장하지 않음 (장비 자리가 대기 자세와 어긋남)
    if (!this.posed) return null;
    this.body = null;
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
    this.body = { mesh: m, xs, ys, zs, top };
    return this.body;
  }

  /** 저금통 자리: 등 가운데(높이 PIGGY_AT.y)의 가장 뒤쪽 표면에서 몸통 깊이의 30%만 묻힘 */
  private piggySpot(tier: number): THREE.Vector3 {
    const b = this.bodyPoints();
    if (!b) return PIGGY_AT;
    let back = Infinity;
    for (let i = 0; i < b.xs.length; i++) {
      if (Math.abs(b.xs[i]!) < 0.06 && Math.abs(b.ys[i]! - PIGGY_AT.y) < 0.06 && b.zs[i]! < back) back = b.zs[i]!;
    }
    if (back === Infinity) return PIGGY_AT;
    const half = piggySize(tier) * 1.15;
    return new THREE.Vector3(0, PIGGY_AT.y, back - half * 0.7);
  }

  /** 모자 앞 위쪽 자리(아바타 기준)와 그 정점을 가장 크게 움직이는 뼈 (아바타마다 한 번 계산) */
  private hatCache: { bone: string; at: THREE.Vector3 } | null | undefined;
  private hatSpot(): { bone: string; at: THREE.Vector3 } | null {
    if (this.hatCache !== undefined) return this.hatCache;
    this.hatCache = null;
    const b = this.bodyPoints();
    if (!b) return null;
    const { mesh: m, xs, ys, zs, top } = b;
    // 머리 꼭대기에서 0.09~0.17m 아래, 가운데(|x| < 0.05) 중 가장 앞쪽 정점
    let best = -1;
    for (let i = 0; i < xs.length; i++) {
      if (ys[i]! > top - 0.09 || ys[i]! < top - 0.17 || Math.abs(xs[i]!) > 0.05) continue;
      if (best < 0 || zs[i]! > zs[best]!) best = i;
    }
    if (best < 0) return null;
    const idx = m.geometry.attributes.skinIndex!, wgt = m.geometry.attributes.skinWeight!;
    let bi = 0, bw = -1;
    for (let k = 0; k < 4; k++) if (wgt.getComponent(best, k) > bw) { bw = wgt.getComponent(best, k); bi = idx.getComponent(best, k); }
    const bone = m.skeleton.bones[bi];
    if (!bone) return null;
    // 앞으로 3cm: 자세(대기 클립)에 따라 머리가 1~2cm 앞으로 숙여져 노랑·분홍·검정에서 렌즈가 묻혔음 (2026-11-13)
    this.hatCache = { bone: bone.name, at: new THREE.Vector3(0, ys[best]!, zs[best]! + 0.03) };
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

  /**
   * 세부 표시 (LOD, 2026-11-13 광장 프레임): false면 장비를 숨기고 그림자를 안 드리움 (멀리 있는 다른 사람).
   * 바뀔 때만 순회. 장비를 새로 붙일 때(setGear)도 지금 단계를 따름
   */
  private detail = true;
  /** 멀리 있을 때 쓰는 가벼운 몸 (원본 몸과 같은 뼈대·재질, 형상만 assets.lods 공유) */
  private lodBody: THREE.SkinnedMesh | null = null;
  setDetail(high: boolean): void {
    // 이미 그 단계면 그만 — 단, 멀리 있는데 가벼운 몸·총을 그 뒤에 받았으면 이제 바꿈 (먼저 만든 아바타가 영영 원래 몸이던 것)
    const pending = !high && ((!this.lodBody && !!this.assets.lods[this.char]) || (!this.lowGun && !!this.assets.gunsLow[this.wantGun.model]));
    if (high === this.detail && !pending) return;
    this.detail = high;
    for (const k of ['atk', 'spd', 'coin'] as const) for (const o of this.gear[k].objs) o.visible = high;
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.userData.gear !== true) o.castShadow = high; });
    // 캐릭터 LOD (2026-11-13): 약 7,600 → 2,200 삼각형. LOD 형상을 아직 못 받았으면 원래 몸 그대로
    const body = this.bodyMesh();
    const geo = this.assets.lods[this.char];
    if (!body || !geo) return;
    if (!high && !this.lodBody) {
      const m = new THREE.SkinnedMesh(geo, body.material);
      m.bind(body.skeleton, body.bindMatrix);
      m.position.copy(body.position);
      m.quaternion.copy(body.quaternion);
      m.scale.copy(body.scale);
      m.frustumCulled = body.frustumCulled;
      m.castShadow = false;
      m.userData.lod = true;
      body.parent!.add(m);
      this.lodBody = m;
    }
    body.visible = high;
    if (this.lodBody) this.lodBody.visible = !high;
    // 총도 가벼운 것으로 (받아 둔 경우만, 바뀔 때만 다시 듦)
    const gm = this.wantGun.model;
    if (!high !== this.lowGun && (high || this.assets.gunsLow[gm])) this.setGun(this.wantGun);
  }

  /** 지금 든 총이 가벼운 총인지 */
  private lowGun = false;

  dispose(): void {
    this.disposed = true;
    // 총 재질도 PlayerAvatar.materials에 있어 같이 해제됨
    this.avatar.dispose();
  }
}
