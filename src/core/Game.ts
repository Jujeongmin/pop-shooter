import * as THREE from 'three';
import type { Assets } from '../assets/loadAssets';
import { FollowCamera } from '../camera/FollowCamera';
import { Avatar } from '../player/Avatar';
import { GUNS } from '../sim/guns.ts';
import type { GameState } from '../sim/state.ts';
import { AutoSaver } from '../save/localSave';
import { Hud } from '../ui/Hud';
import { gateIndex, HUB_SPAWN, nearestFacility, type Facility } from '../world/facilities';
import type { BrickName, KitModel } from '../world/kit';
import { moveWithColliders } from '../world/movement';
import { World1Hub } from '../world/World1Hub';
import { Controls, type Tap } from './Controls';
import type { Stage3D } from './Stage3D';

export const MOVE_SPEED = 4.8;
const RADIUS = 0.4;

const _dir = new THREE.Vector3();

export type GameMode = 'hub' | 'training' | 'battle';
export type FacilityKind = 'range' | 'upgrade' | 'guns' | 'altar' | 'gate';
export type MenuKind = 'character' | 'settings';

/** 광장 이동 · 카메라 · (뒤 Task) 훈련·전투 흐름 */
export class Game {
  state: GameState;
  mode: GameMode = 'hub';
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
  /** 다른 Task가 붙는 매 프레임 훅 */
  private readonly tickers: ((dt: number) => void)[] = [];
  /** 훈련·전투 모드의 탭 처리 (광장에서는 탭 무시, 이동은 조이스틱·키보드) */
  tapHandler: ((taps: Tap[]) => void) | null = null;
  /** 시설 사용 (뒤 Task가 등록: 훈련·업그레이드 창·총 상점·환생·스테이지 문) */
  readonly facilityActions: Partial<Record<FacilityKind, (f: Facility, stage: number | null) => void>> = {};
  readonly menuActions: Partial<Record<MenuKind, () => void>> = {};
  /** 상태가 바뀔 때 알림 (창 갱신 등) */
  private readonly stateListeners: ((s: GameState) => void)[] = [];
  readonly ui: HTMLElement;
  readonly hud: Hud;
  readonly saver: AutoSaver;

  constructor(stage: Stage3D, assets: Assets, kit: Record<BrickName, KitModel>, state: GameState, ui: HTMLElement) {
    this.stage = stage;
    this.assets = assets;
    this.state = state;
    this.ui = ui;
    this.controls = new Controls(stage.renderer.domElement, ui);
    this.hud = new Hud(ui, {
      use: (f) => this.useFacility(f),
      menu: (m) => this.menuActions[m]?.(),
    });
    this.saver = new AutoSaver(() => this.state);
    this.saver.start();
    this.cam = new FollowCamera(stage.camera);
    this.hub = new World1Hub(kit);
    stage.scene.add(this.hub.root);
    this.hub.setGateStates(state.bestStage);
    this.avatar = new Avatar(assets, state.char, GUNS[state.gun]!);
    stage.scene.add(this.avatar.root);
    stage.onFrame((dt) => this.frame(dt));
  }

  onTick(fn: (dt: number) => void): void {
    this.tickers.push(fn);
  }

  onStateChange(fn: (s: GameState) => void): void {
    this.stateListeners.push(fn);
  }

  useFacility(f: Facility): void {
    if (this.mode !== 'hub') return;
    const g = gateIndex(f.id);
    const kind: FacilityKind = g !== null ? 'gate' : (f.id as FacilityKind);
    this.facilityActions[kind]?.(f, g);
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.controls.setJoystickEnabled(mode === 'hub');
    this.controls.drainTaps();
  }

  private frame(dt: number): void {
    this.cam.rotate(this.controls.drainDrag());
    const taps = this.controls.drainTaps();
    if (this.mode === 'hub') {
      this.updateMove(dt);
      this.near = nearestFacility(this.pos.x, this.pos.z, this.hub.facilities);
    } else if (this.tapHandler && taps.length) {
      this.tapHandler(taps);
    }
    for (const t of this.tickers) t(dt);
    this.hud.update(this.state, this.near, this.mode === 'hub');
    this.updateAvatar(dt);
    this.cam.update(dt, this.pos);
  }

  private updateMove(dt: number): void {
    const m = this.controls.move();
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
  readonly pose = { aimAt: null as THREE.Vector3 | null, kick: 0 };

  updateAvatar(dt: number): void {
    this.avatar.update(dt, { pos: this.pos, yaw: this.yaw, velocity: this.velocity, aimAt: this.pose.aimAt, kick: this.pose.kick });
  }

  /** 모든 상태 변경은 여기로: 문 색·창 갱신 알림. 중요한 변경(구매·클리어·환생)은 save=true로 즉시 저장 */
  setState(next: GameState, save = false): void {
    const prevBest = this.state.bestStage;
    this.state = next;
    if (next.bestStage !== prevBest) this.hub.setGateStates(next.bestStage);
    for (const l of this.stateListeners) l(next);
    if (save) this.saver.saveNow();
  }
}
