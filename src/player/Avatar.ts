import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WEAPONS } from '../config/weapons';
import type { Assets } from '../assets/loadAssets';
import type { GunDef } from '../sim/guns.ts';
import type { CharId } from '../sim/state.ts';
import { PlayerAvatar, type AvatarFrame } from './PlayerAvatar';

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
}

const _dir = new THREE.Vector3();
/** 이 속도(m/s) 넘으면 달리기 클립 */
const RUN_FROM = 3;
const _chest = new THREE.Vector3();

/** 팝배틀 PlayerAvatar 감싸기: 캐릭터 복제 + 월드 색 총 + 간단한 자세 입력 */
export class Avatar {
  readonly root: THREE.Object3D;
  private readonly avatar: PlayerAvatar;
  private readonly assets: Assets;
  /** 손에 든 총 (복제본). 재질 복제·해제는 PlayerAvatar가 함 (prepareWeapon·releaseWeapon). 총 geometry·texture는 GLB 원본과 공유 */
  private gunObj: THREE.Object3D;
  private readonly frame: AvatarFrame;
  private airTime = 0;

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
  }

  /** 머리 꼭대기 높이 (월드 y, 마지막 update 기준) — 이름표 자리 */
  headTop(): number {
    return this.avatar.headCenter.y + this.avatar.headRadius;
  }

  getMuzzle(out: THREE.Vector3): void {
    this.avatar.getMuzzle(out);
  }

  dispose(): void {
    // 총 재질도 PlayerAvatar.materials에 있어 같이 해제됨
    this.avatar.dispose();
  }
}
