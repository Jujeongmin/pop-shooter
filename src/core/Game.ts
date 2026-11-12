import type { ServerSaveReply } from '../platform/CloudSave';
import { normalizeState } from '../sim/normalize.ts';
import { OcclusionFader } from '../fx/OcclusionFader';
import * as THREE from 'three';
import type { Assets } from '../assets/loadAssets';
import { FollowCamera } from '../camera/FollowCamera';
import { Avatar, type GearTiers } from '../player/Avatar';
import { topGearTier } from '../sim/training.ts';
import { GUNS } from '../sim/guns.ts';
import type { CharId, GameState } from '../sim/state.ts';
import type { CloudSave } from '../platform/CloudSave';
import { AutoSaver } from '../save/localSave';
import { Hud } from '../ui/Hud';
import { HUB_SPAWN, nearestFacility, type Facility } from '../world/facilities';
import type { BrickName, KitModel } from '../world/kit';
import { moveWithColliders } from '../world/movement';
import { World1Hub } from '../world/World1Hub';
import { Controls, type Tap } from './Controls';
import { t } from '../i18n/i18n';
import type { Stage3D } from './Stage3D';

/** 이동 속도 (m/s): 사용자 요청으로 4.8 × 1.2 */
export const MOVE_SPEED = 5.76;
const RADIUS = 0.4;

const _dir = new THREE.Vector3();
const _look = { x: 0, y: 0 };

/** 캐릭터에 보일 장비 단계 */
export function gearTiers(s: GameState): GearTiers {
  return { atk: topGearTier(s, 'atk'), spd: topGearTier(s, 'spd'), coin: topGearTier(s, 'coin') };
}

export type GameMode = 'hub' | 'training' | 'battle';
export type FacilityKind = Facility['id'];
export type MenuKind = 'settings';

/** 광장 이동 · 카메라 · (뒤 Task) 훈련·전투 흐름 */
export class Game {
  state: GameState;
  mode: GameMode = 'hub';
  /** 전투 동안 맡겨 둔 광장 시점 */
  private readonly hubView = { yaw: 0, pitch: 0 };
  readonly stage: Stage3D;
  readonly assets: Assets;
  readonly controls: Controls;
  readonly cam: FollowCamera;
  readonly hub: World1Hub;
  avatar: Avatar;
  readonly pos = new THREE.Vector3(HUB_SPAWN.x, 0, HUB_SPAWN.z);
  yaw = Math.PI;
  readonly velocity = new THREE.Vector3();
  near: Facility | null = null;
  /** 남은 이동 잠금(초): 구역에 '잡히는' 연출 동안 조이스틱·키보드 무시. 잠금 뒤엔 입력을 한 번 놓아야 다시 움직임 */
  moveLock = 0;
  private needRelease = false;
  /** 다른 Task가 붙는 매 프레임 훅 */
  private readonly tickers: ((dt: number) => void)[] = [];
  /** 탭 처리 (훈련 구역·전투 = 추가 발사). 없으면 탭 무시. 이동은 조이스틱·키보드 */
  tapHandler: ((taps: Tap[]) => void) | null = null;
  /** 시설 사용 (뒤 Task가 등록: 훈련·업그레이드 창·총 상점·환생·포털) */
  readonly facilityActions: Partial<Record<FacilityKind, (f: Facility) => void>> = {};
  /** 시설 구역에서 나갈 때 (창 닫기·훈련 끝) */
  readonly facilityLeave: Partial<Record<FacilityKind, (f: Facility) => void>> = {};
  readonly menuActions: Partial<Record<MenuKind, () => void>> = {};
  /** 상태가 바뀔 때 알림 (창 갱신 등) */
  private readonly stateListeners: ((s: GameState) => void)[] = [];
  readonly ui: HTMLElement;
  readonly hud: Hud;
  readonly saver: AutoSaver;
  /** 카메라와 나 사이를 가리는 광장 구조물 반투명 (main이 광장을 다 만든 뒤 register) */
  readonly occlusion = new OcclusionFader();

  constructor(stage: Stage3D, assets: Assets, kit: Record<BrickName, KitModel>, state: GameState, ui: HTMLElement, save: { account: string | null; cloud: CloudSave | null } = { account: null, cloud: null }) {
    this.stage = stage;
    this.assets = assets;
    this.state = state;
    this.ui = ui;
    this.controls = new Controls(stage.renderer.domElement, ui);
    // PC 마우스 잠금 중: 가운데 점 + "Tab: 마우스 풀기"
    const cross = document.createElement('div');
    cross.className = 'lock-cross';
    const hint = document.createElement('div');
    hint.className = 'lock-hint';
    hint.textContent = t('ctl.unlock');
    ui.append(cross, hint);
    this.controls.onLockChange = (on) => {
      cross.classList.toggle('on', on);
      hint.classList.toggle('on', on);
      hint.textContent = t('ctl.unlock');
    };
    this.hud = new Hud(ui, { menu: (m) => this.menuActions[m]?.() });
    this.saver = new AutoSaver(() => this.state, save.account, save.cloud);
    this.saver.start();
    this.cam = new FollowCamera(stage.camera);
    this.hub = new World1Hub(kit, assets.guns);
    stage.scene.add(this.hub.root);
    this.hub.setBest(state.bestStage);
    this.avatar = new Avatar(assets, state.char, GUNS[state.gun]!);
    stage.scene.add(this.avatar.root);
    this.avatar.setGear(gearTiers(state));
    stage.onFrame((dt) => this.frame(dt));
  }

  /**
   * 서버 저장 응답 맞추기: 프리미엄(팝젬·패스·부스트·캐릭터)은 서버 값, 코인이 잘렸으면 그 값 이하로,
   * 거절됐으면 서버 저장으로 통째로 (저장 다시 안 함: 서버가 이미 가진 값). 캐릭터·총이 바뀌면 아바타도.
   */
  adoptServer(r: ServerSaveReply): void {
    const before = this.state;
    let s: GameState;
    if (r.fix) {
      s = normalizeState(r.fix, Date.now());
    } else if (r.prem) {
      const chars = r.prem.chars as CharId[];
      s = { ...before, gems: r.prem.gems, passMult: r.prem.passMult, boostUntil: r.prem.boostUntil, chars, char: chars.includes(before.char) ? before.char : (r.prem.char as CharId) };
      if (r.coins !== undefined) s = { ...s, coins: Math.min(s.coins, r.coins) };
    } else return;
    const same = s.gems === before.gems && s.passMult === before.passMult && s.boostUntil === before.boostUntil && s.char === before.char
      && s.coins === before.coins && s.chars.length === before.chars.length && !r.fix;
    if (same) return;
    if (s.char !== before.char) this.rebuildAvatar(s.char, s.gun);
    else if (s.gun !== before.gun) this.avatar.setGun(GUNS[s.gun]!);
    this.setState(s);
  }

  private rebuildAvatar(c: CharId, gun: number): void {
    this.avatar.root.removeFromParent();
    this.avatar.dispose();
    this.avatar = new Avatar(this.assets, c, GUNS[gun]!);
    this.stage.scene.add(this.avatar.root);
    this.avatar.setGear(gearTiers(this.state));
  }

  /** 캐릭터 바꾸기 (가진 것만): 아바타 새로 만들고 이전 것은 해제 */
  setChar(c: CharId): void {
    if (!this.state.chars.includes(c) || c === this.state.char) return;
    this.rebuildAvatar(c, this.state.gun);
    this.setState({ ...this.state, char: c }, true);
  }

  onTick(fn: (dt: number) => void): void {
    this.tickers.push(fn);
  }

  onStateChange(fn: (s: GameState) => void): void {
    this.stateListeners.push(fn);
  }

  /** 시설 구역에 들어가면 바로 동작 (버튼 없음) */
  private enterFacility(f: Facility): void {
    this.facilityActions[f.id]?.(f);
  }

  private leaveFacility(f: Facility): void {
    this.facilityLeave[f.id]?.(f);
  }

  /** 순간이동 (전투에서 돌아올 때 등): 도착한 곳의 시설은 다시 발동하지 않음 */
  placeAt(x: number, z: number, yaw = this.yaw): void {
    this.pos.set(x, 0, z);
    this.yaw = yaw;
    this.velocity.set(0, 0, 0);
    this.near = nearestFacility(x, z, this.hub.facilities);
  }

  setMode(mode: GameMode): void {
    // 전투는 정해진 각도(보스 정면)로 보고, 광장으로 돌아오면 돌려 둔 시점 그대로
    if (mode !== 'hub' && this.mode === 'hub') {
      this.hubView.yaw = this.cam.yaw;
      this.hubView.pitch = this.cam.pitch;
      this.cam.yaw = 0;
      this.cam.pitch = 0;
    } else if (mode === 'hub' && this.mode !== 'hub') {
      this.cam.yaw = this.hubView.yaw;
      this.cam.pitch = this.hubView.pitch;
    }
    this.mode = mode;
    this.controls.setJoystickEnabled(mode === 'hub');
    this.controls.drainTaps();
  }

  private frame(dt: number): void {
    const taps = this.controls.drainTaps();
    const look = this.controls.drainLook(_look);
    if (this.mode === 'hub' && (look.x !== 0 || look.y !== 0)) this.cam.turn(look.x, look.y);
    if (this.mode === 'hub') {
      this.updateMove(dt);
      const prev = this.near;
      this.near = nearestFacility(this.pos.x, this.pos.z, this.hub.facilities);
      if (prev?.id !== this.near?.id) {
        if (prev) this.leaveFacility(prev);
        if (this.near) this.enterFacility(this.near);
      }
    }
    if (this.tapHandler && taps.length) this.tapHandler(taps);
    this.hub.update(dt, this.stage.camera.position);
    for (const t of this.tickers) t(dt);
    this.hud.update(this.state);
    this.updateAvatar(dt);
    this.cam.update(dt, this.pos);
    // 카메라와 나 사이 구조물 반투명 (광장에서만)
    this.occlusion.update(dt, this.stage.camera, this.pos, this.mode === 'hub');
  }

  private updateMove(dt: number): void {
    const m = this.controls.move();
    if (this.moveLock > 0) {
      this.moveLock -= dt;
      this.needRelease = true;
    }
    if (this.needRelease && m.x === 0 && m.y === 0 && this.moveLock <= 0) this.needRelease = false;
    if (this.needRelease) {
      this.velocity.set(0, 0, 0);
      return;
    }
    _dir.set(0, 0, 0);
    if (m.x !== 0 || m.y !== 0) this.cam.toWorld(m.x, m.y, _dir);
    const speed = MOVE_SPEED * Math.min(1, _dir.length());
    if (speed > 0) {
      _dir.normalize();
      const before = { x: this.pos.x, z: this.pos.z };
      const p = moveWithColliders(this.pos.x, this.pos.z, _dir.x * speed * dt, _dir.z * speed * dt, RADIUS, this.hub.colliders, this.hub.bounds);
      this.pos.x = p.x;
      this.pos.z = p.z;
      this.velocity.set((p.x - before.x) / Math.max(dt, 1e-4), 0, (p.z - before.z) / Math.max(dt, 1e-4));
      if (this.velocity.lengthSq() > 0.01) this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
    } else {
      this.velocity.set(0, 0, 0);
    }
  }

  /** 아바타 자세 (훈련·전투 Task가 aimAt·kick을 덮어씀) */
  readonly pose = { aimAt: null as THREE.Vector3 | null, kick: 0, grounded: true, dead: false };

  updateAvatar(dt: number): void {
    this.avatar.update(dt, { pos: this.pos, yaw: this.yaw, velocity: this.velocity, aimAt: this.pose.aimAt, kick: this.pose.kick, grounded: this.pose.grounded, dead: this.pose.dead });
  }

  /** 모든 상태 변경은 여기로: 포털 기록·창 갱신 알림. 중요한 변경(구매·클리어·환생)은 save=true로 즉시 저장 */
  setState(next: GameState, save = false): void {
    const prevBest = this.state.bestStage;
    const prevGear = this.state.gear;
    this.state = next;
    if (next.bestStage !== prevBest) this.hub.setBest(next.bestStage);
    if (next.gear !== prevGear) this.avatar.setGear(gearTiers(next));
    for (const l of this.stateListeners) l(next);
    if (save) this.saver.saveNow();
  }
}
