import { t, type StrKey } from '../i18n/i18n';
import { audio } from '../audio/audio';
import { FIRE_SOUND } from '../config/audio';
import { GUNS } from '../sim/guns.ts';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { HitFx } from '../fx/HitFx';
import { highestWorld, shotsPerSec } from '../sim/actions.ts';
import { gainPerShot, spdMaxed, train, type TrainKind } from '../sim/training.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatNum } from '../sim/format.ts';
import { TapLimiter } from '../sim/tapLimiter.ts';
import { ZoneEntry } from '../core/ZoneEntry';
import type { FloatText } from '../ui/FloatText';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { RANGE_LANES, RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES, type RangeLane } from '../world/facilities';

const FLUSH_SEC = 0.25;
/** 연사 줄 표적이 좌우로 움직이는 폭(m)·속도 */
const SPD_SWAY = 0.7;
const SPD_SWAY_HZ = 0.9;
const TITLE: Record<TrainKind, StrKey> = { atk: 'range.atk', spd: 'range.spd', coin: 'range.coin' };
const UNIT: Record<TrainKind, string> = { atk: '', spd: '%', coin: '%' };

const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
/** 아바타 조준점 (_aim은 효과 위치로 계속 바뀌므로 따로) */
const _aimAt = new THREE.Vector3();

/**
 * 훈련장 (사용자 2026-11-11, +1 MMA Fighter 방식): 세 줄 발판 중 하나에 들어가면 바로 시작, 나가면 끝 (버튼 없음).
 * 그 줄의 능력치만 오름 (공격 점수 / 연사 % / 골드 보너스 %), 골드는 안 줌 (골드는 전투에서).
 * 서 있는 동안 자동 발사(초당 발사 수) + 탭 추가 발사(초당 8회까지). 걷는 중엔 쉼.
 * 훈련치는 0.25초마다 모아서 setState, 떠오르는 글자도 그때 한 번.
 */
export class TrainingRange {
  private readonly game: Game;
  private readonly fx: HitFx;
  private readonly float: FloatText;
  private readonly limiter = new TapLimiter(BALANCE.tap.maxPerSec);
  private shotAcc = 0;
  /** 아직 반영 안 한 훈련 발 수 (flush 때 train) */
  private pendingShots = 0;
  private flushT = 0;
  private clock = 0;
  private kick = 0;
  private readonly wobble: number[];
  private hiddenAt = 0;
  private readonly zones: ZoneEntry[];
  /** 지금 서 있는 줄 (없으면 null) */
  lane: RangeLane | null = null;
  /** 디버그·검증: 지금까지 인정한 탭 수 */
  tapsAccepted = 0;

  constructor(game: Game, fx: HitFx, float: FloatText, callout: ZoneCallout) {
    this.game = game;
    this.fx = fx;
    this.float = float;
    this.wobble = game.hub.targets.map(() => 0);
    this.zones = RANGE_LANES.map((lane) => {
      const zone = new ZoneEntry(game, callout, WORLD1_FACILITIES.find((f) => f.id === lane.id)!, {
        color: lane.color,
        flash: 'rgba(79, 179, 255, 0.85)',
        // 발판 안 조금 흩뜨린 자리: 여러 명이 훈련해도 한 점에 겹치지 않음
        spot: () => ({ x: lane.x + (Math.random() - 0.5) * 0.8, z: RANGE_SPOT.z + (Math.random() - 0.5) * 1.6 }),
        face: { x: lane.x, z: RANGE_TARGET.z },
        text: { title: t(TITLE[lane.kind]), big: t('range.big'), hand: true },
      });
      // 착지하자마자 한 발
      zone.onLanded = () => this.fire(false);
      game.facilityActions[lane.id] = () => this.start(lane);
      game.facilityLeave[lane.id] = () => this.stop();
      return zone;
    });
    game.onTick((dt) => this.update(dt));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get active(): boolean {
    return this.lane !== null;
  }

  private zoneOf(lane: RangeLane): ZoneEntry {
    return this.zones[RANGE_LANES.indexOf(lane)]!;
  }

  start(lane: RangeLane): void {
    if (this.lane === lane) return;
    this.stop();
    this.lane = lane;
    this.game.tapHandler = (taps) => { for (let i = 0; i < taps.length; i++) this.tap(); };
    this.shotAcc = 0;
    this.zoneOf(lane).enter();
    if (lane.kind === 'spd' && spdMaxed(this.game.state)) this.float.show(t('range.spdMax'), _aim.set(lane.x, 2.6, RANGE_SPOT.z - 2), 'big');
  }

  stop(): void {
    const lane = this.lane;
    if (!lane) return;
    this.flush();
    this.lane = null;
    this.game.tapHandler = null;
    this.game.pose.aimAt = null;
    this.game.pose.kick = 0;
    this.zoneOf(lane).leave();
  }

  private tap(): void {
    if (this.game.velocity.lengthSq() > 0.04) return;
    if (!this.limiter.accept(this.clock)) return;
    this.tapsAccepted++;
    this.fire(true);
  }

  private targetOf(lane: RangeLane): THREE.Object3D {
    return this.game.hub.targets[RANGE_LANES.indexOf(lane)]!;
  }

  private fire(tapped: boolean): void {
    const lane = this.lane;
    if (!lane) return;
    const g = this.game;
    this.pendingShots++;
    const i = RANGE_LANES.indexOf(lane);
    const target = this.targetOf(lane);
    this.wobble[i] = 1;
    this.kick = 0.06;
    g.avatar.getMuzzle(_muzzle);
    _aim.set(target.position.x + (Math.random() - 0.5) * 0.4, 1.6 + (Math.random() - 0.5) * 0.4, target.position.z + 0.12);
    this.fx.shot(_muzzle, _aim);
    audio.play(FIRE_SOUND[GUNS[g.state.gun]!.model]);
    if (tapped) this.float.show(t('float.pop'), _aim, 'pop');
  }

  private flush(): void {
    const lane = this.lane;
    if (!lane || this.pendingShots <= 0) return;
    const g = this.game;
    const world = highestWorld(g.state);
    const gain = gainPerShot(g.state, lane.kind, world) * this.pendingShots;
    g.setState(train(g.state, lane.kind, this.pendingShots, world));
    this.pendingShots = 0;
    if (lane.kind === 'spd' && spdMaxed(g.state)) return;
    _aim.set(lane.x, 2.4, RANGE_SPOT.z - 3);
    this.float.show(`+${formatNum(gain)}${UNIT[lane.kind]}`, _aim, lane.kind === 'coin' ? 'coin' : 'big');
  }

  private update(dt: number): void {
    this.clock += dt;
    this.fx.update(dt);
    this.float.update(dt);
    for (const z of this.zones) z.update(dt);
    const g = this.game;
    g.hub.targets.forEach((tg, i) => {
      // 연사 줄 표적은 좌우로 움직임
      if (RANGE_LANES[i]!.kind === 'spd') tg.position.x = RANGE_LANES[i]!.x + Math.sin(this.clock * Math.PI * 2 * SPD_SWAY_HZ) * SPD_SWAY;
      const w = this.wobble[i]!;
      if (w <= 0) return;
      this.wobble[i] = Math.max(0, w - dt * 4);
      tg.rotation.x = -Math.sin(w * Math.PI * 2) * 0.25 * w;
    });
    const lane = this.lane;
    if (!lane) return;
    if (this.zoneOf(lane).snapping) return;
    // 걷는 중엔 쏘지 않음 (발판 밖으로 나가면 facilityLeave가 stop)
    if (g.velocity.lengthSq() > 0.04) {
      g.pose.aimAt = null;
      this.flushT += dt;
      if (this.flushT >= FLUSH_SEC) { this.flushT = 0; this.flush(); }
      return;
    }
    const tg = this.targetOf(lane);
    g.pose.aimAt = _aimAt.set(tg.position.x, 1.6, tg.position.z);
    g.yaw = Math.atan2(tg.position.x - g.pos.x, tg.position.z - g.pos.z);
    this.shotAcc += shotsPerSec(g.state) * dt;
    while (this.shotAcc >= 1) {
      this.shotAcc -= 1;
      this.fire(false);
    }
    this.kick = Math.max(0, this.kick - dt * 0.6);
    g.pose.kick = this.kick;
    this.flushT += dt;
    if (this.flushT >= FLUSH_SEC) {
      this.flushT = 0;
      this.flush();
    }
  }

  /** 탭이 숨겨진 동안(RAF 멈춤) 훈련 중이었으면 경과 시간만큼 발 수 (100% 속도, 탭 없음, 오프라인 한도까지) */
  catchUpShots(elapsedSec: number): number {
    const sec = Math.max(0, Math.min(BALANCE.offline.capSec, elapsedSec));
    return shotsPerSec(this.game.state) * sec;
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') { this.hiddenAt = Date.now(); return; }
    const lane = this.lane;
    if (!lane || !this.hiddenAt) return;
    const shots = this.catchUpShots((Date.now() - this.hiddenAt) / 1000);
    this.hiddenAt = 0;
    if (shots <= 0) return;
    const g = this.game;
    const world = highestWorld(g.state);
    const gain = gainPerShot(g.state, lane.kind, world) * shots;
    g.setState(train(g.state, lane.kind, shots, world), true);
    _aim.set(lane.x, 2.8, RANGE_SPOT.z - 3);
    this.float.show(t('float.away', { n: `${formatNum(gain)}${UNIT[lane.kind]}` }), _aim, 'coin big');
  };
}
