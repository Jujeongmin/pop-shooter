import * as THREE from 'three';
import type { Assets } from '../assets/loadAssets';
import { FollowCamera } from '../camera/FollowCamera';
import { Avatar } from '../player/Avatar';
import { GUNS } from '../sim/guns.ts';
import type { GameState } from '../sim/state.ts';
import { HUB_SPAWN, nearestFacility, type Facility } from '../world/facilities';
import type { BrickName, KitModel } from '../world/kit';
import { moveWithColliders } from '../world/movement';
import { World1Hub } from '../world/World1Hub';
import { Controls, type Tap } from './Controls';
import type { Stage3D } from './Stage3D';

export const MOVE_SPEED = 4.8;
const RADIUS = 0.4;
const ARRIVE = 0.3;

const _dir = new THREE.Vector3();
const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();

export type GameMode = 'hub' | 'training' | 'battle';

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
  private moveTarget: THREE.Vector3 | null = null;
  near: Facility | null = null;
  /** 다른 Task가 붙는 매 프레임 훅 */
  private readonly tickers: ((dt: number) => void)[] = [];
  /** 모드별 탭 처리 (hub = 이동 목표) */
  tapHandler: ((taps: Tap[]) => void) | null = null;

  constructor(stage: Stage3D, assets: Assets, kit: Record<BrickName, KitModel>, state: GameState, ui: HTMLElement) {
    this.stage = stage;
    this.assets = assets;
    this.state = state;
    this.controls = new Controls(stage.renderer.domElement, ui);
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

  private hubTaps(taps: Tap[]): void {
    const t = taps.at(-1);
    if (!t) return;
    _ndc.set((t.x / window.innerWidth) * 2 - 1, -(t.y / window.innerHeight) * 2 + 1);
    _ray.setFromCamera(_ndc, this.stage.camera);
    if (_ray.ray.intersectPlane(GROUND, _hit)) this.moveTarget = _hit.clone();
  }

  private frame(dt: number): void {
    this.cam.rotate(this.controls.drainDrag());
    const taps = this.controls.drainTaps();
    if (this.mode === 'hub') {
      if (taps.length) this.hubTaps(taps);
      this.updateMove(dt);
      this.near = nearestFacility(this.pos.x, this.pos.z, this.hub.facilities);
    } else if (this.tapHandler && taps.length) {
      this.tapHandler(taps);
    }
    for (const t of this.tickers) t(dt);
    this.updateAvatar(dt);
    this.cam.update(dt, this.pos);
  }

  private updateMove(dt: number): void {
    const m = this.controls.move();
    _dir.set(0, 0, 0);
    if (m.x !== 0 || m.y !== 0) {
      this.moveTarget = null;
      this.cam.toWorld(m.x, m.y, _dir);
    } else if (this.moveTarget) {
      _dir.set(this.moveTarget.x - this.pos.x, 0, this.moveTarget.z - this.pos.z);
      const d = _dir.length();
      if (d < ARRIVE) { this.moveTarget = null; _dir.set(0, 0, 0); } else _dir.divideScalar(d);
    }
    const speed = MOVE_SPEED * Math.min(1, _dir.length());
    if (speed > 0) {
      _dir.normalize();
      const before = { x: this.pos.x, z: this.pos.z };
      const p = moveWithColliders(this.pos.x, this.pos.z, _dir.x * speed * dt, _dir.z * speed * dt, RADIUS, this.hub.colliders, this.hub.bounds);
      this.pos.x = p.x;
      this.pos.z = p.z;
      this.velocity.set((p.x - before.x) / Math.max(dt, 1e-4), 0, (p.z - before.z) / Math.max(dt, 1e-4));
      if (this.velocity.lengthSq() > 0.01) this.yaw = Math.atan2(this.velocity.x, this.velocity.z);
      // 막혀서 거의 못 움직이면 클릭 목표 포기
      if (this.moveTarget && this.velocity.lengthSq() < 0.25) this.moveTarget = null;
    } else {
      this.velocity.set(0, 0, 0);
    }
  }

  /** 아바타 자세 (훈련·전투 Task가 aimAt·kick을 덮어씀) */
  readonly pose = { aimAt: null as THREE.Vector3 | null, kick: 0 };

  updateAvatar(dt: number): void {
    this.avatar.update(dt, { pos: this.pos, yaw: this.yaw, velocity: this.velocity, aimAt: this.pose.aimAt, kick: this.pose.kick });
  }

  setState(next: GameState): void {
    this.state = next;
  }
}
