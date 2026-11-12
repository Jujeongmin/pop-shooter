import { t } from '../i18n/i18n';
import { audio } from '../audio/audio';
import { FIRE_SOUND } from '../config/audio';
import { GUNS } from '../sim/guns.ts';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { HitFx } from '../fx/HitFx';
import { shotsPerSec } from '../sim/actions.ts';
import { gainPerShot, train } from '../sim/training.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatNum } from '../sim/format.ts';
import { TapLimiter } from '../sim/tapLimiter.ts';
import { ZoneEntry } from '../core/ZoneEntry';
import type { FloatText } from '../ui/FloatText';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES } from '../world/facilities';

const FLUSH_SEC = 0.25;

const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
/** 아바타 조준점 (_aim은 효과 위치로 계속 바뀌므로 따로) */
const _aimAt = new THREE.Vector3();

/**
 * 사격장 = 공격 훈련 (사용자 2026-11-12: 연사·골드 보너스는 러닝머신·동전 분수로 분리).
 * 발판에 들어가면 바로 시작, 나가면 끝. 과녁 3개를 번갈아 쏨: 자동 발사(초당 발사 수) + 탭 추가 발사(초당 8회까지).
 * 걷는 중엔 쉼. 공격 훈련치는 0.25초마다 모아서 setState, 떠오르는 글자도 그때 한 번. 골드는 안 줌 (골드는 전투에서).
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
  /** 지금 겨누는 과녁 (발사마다 다음 과녁) */
  private targetIdx = 0;
  private readonly wobble: number[];
  private hiddenAt = 0;
  private readonly zone: ZoneEntry;
  active = false;
  /** 디버그·검증: 지금까지 인정한 탭 수 */
  tapsAccepted = 0;

  constructor(game: Game, fx: HitFx, float: FloatText, callout: ZoneCallout) {
    this.game = game;
    this.fx = fx;
    this.float = float;
    this.wobble = game.hub.targets.map(() => 0);
    this.zone = new ZoneEntry(game, callout, WORLD1_FACILITIES.find((f) => f.id === 'range')!, {
      color: '#ff6b6b',
      flash: 'rgba(255, 107, 107, 0.8)',
      // 발판(6×4m) 안 무작위 자리: 여러 명이 훈련해도 한 점에 겹치지 않음
      spot: () => ({ x: RANGE_SPOT.x + (Math.random() - 0.5) * 4.2, z: RANGE_SPOT.z + (Math.random() - 0.5) * 2.2 }),
      face: RANGE_TARGET,
      text: { title: t('range.atk'), big: t('range.big'), hand: true },
    });
    // 착지하자마자 한 발
    this.zone.onLanded = () => this.fire(false);
    game.facilityActions.range = () => this.start();
    game.facilityLeave.range = () => this.stop();
    game.onTick((dt) => this.update(dt));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.game.tapHandler = (taps) => { for (let i = 0; i < taps.length; i++) this.tap(); };
    this.shotAcc = 0;
    this.zone.enter();
  }

  stop(): void {
    if (!this.active) return;
    this.flush();
    this.active = false;
    this.game.tapHandler = null;
    this.game.pose.aimAt = null;
    this.game.pose.kick = 0;
    this.zone.leave();
  }

  private tap(): void {
    if (this.game.velocity.lengthSq() > 0.04) return;
    if (!this.limiter.accept(this.clock)) return;
    this.tapsAccepted++;
    this.fire(true);
  }

  private fire(tapped: boolean): void {
    if (!this.active) return;
    const g = this.game;
    this.pendingShots++;
    this.targetIdx = (this.targetIdx + 1) % g.hub.targets.length;
    const target = g.hub.targets[this.targetIdx]!;
    this.wobble[this.targetIdx] = 1;
    this.kick = 0.06;
    g.avatar.getMuzzle(_muzzle);
    _aim.set(target.position.x + (Math.random() - 0.5) * 0.5, 1.6 + (Math.random() - 0.5) * 0.5, target.position.z + 0.12);
    this.fx.shot(_muzzle, _aim);
    audio.play(FIRE_SOUND[GUNS[g.state.gun]!.model]);
    if (tapped) this.float.show(t('float.pop'), _aim, 'pop');
  }

  private flush(): void {
    if (!this.active || this.pendingShots <= 0) return;
    const g = this.game;
    const world = g.world;
    const gain = gainPerShot(g.state, 'atk', world) * this.pendingShots;
    g.setState(train(g.state, 'atk', this.pendingShots, world));
    this.pendingShots = 0;
    _aim.set(RANGE_SPOT.x, 2.4, RANGE_SPOT.z - 3);
    this.float.show(`+${formatNum(gain)}`, _aim, 'big');
  }

  private update(dt: number): void {
    this.clock += dt;
    this.fx.update(dt);
    this.float.update(dt);
    this.zone.update(dt);
    const g = this.game;
    g.hub.targets.forEach((tg, i) => {
      const w = this.wobble[i]!;
      if (w <= 0) return;
      this.wobble[i] = Math.max(0, w - dt * 4);
      tg.rotation.x = -Math.sin(w * Math.PI * 2) * 0.25 * w;
    });
    if (!this.active || this.zone.snapping) return;
    // 걷는 중엔 쏘지 않음 (발판 밖으로 나가면 facilityLeave가 stop)
    if (g.velocity.lengthSq() > 0.04) {
      g.pose.aimAt = null;
      this.flushT += dt;
      if (this.flushT >= FLUSH_SEC) { this.flushT = 0; this.flush(); }
      return;
    }
    const tg = g.hub.targets[this.targetIdx]!;
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
    if (!this.active || !this.hiddenAt) return;
    const shots = this.catchUpShots((Date.now() - this.hiddenAt) / 1000);
    this.hiddenAt = 0;
    if (shots <= 0) return;
    const g = this.game;
    const world = g.world;
    const gain = gainPerShot(g.state, 'atk', world) * shots;
    g.setState(train(g.state, 'atk', shots, world), true);
    _aim.set(RANGE_SPOT.x, 2.8, RANGE_SPOT.z - 3);
    this.float.show(t('float.away', { n: formatNum(gain) }), _aim, 'coin big');
  };
}
