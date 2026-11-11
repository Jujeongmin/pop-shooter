import { t } from '../i18n/i18n';
import { audio } from '../audio/audio';
import { FIRE_SOUND } from '../config/audio';
import { GUNS } from '../sim/guns.ts';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { HitFx } from '../fx/HitFx';
import { addCoins, coinPerShot, shotsPerSec } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatNum } from '../sim/format.ts';
import { TapLimiter } from '../sim/tapLimiter.ts';
import { ZoneEntry } from '../core/ZoneEntry';
import type { FloatText } from '../ui/FloatText';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { RANGE_SPOT, RANGE_TARGET, WORLD1_FACILITIES } from '../world/facilities';

/** 지금 있는 광장 월드 (계획 1 = 월드 1) */
const HUB_WORLD = 1;
const FLUSH_SEC = 0.25;

const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
/** 아바타 조준점 (_aim은 효과 위치로 계속 바뀌므로 따로) */
const _aimAt = new THREE.Vector3();

/**
 * 사격장 훈련: 사격장 판에 들어가면 바로 시작, 나가면 끝 (버튼 없음).
 * 서 있는 동안 자동 발사(초당 발사 수) + 탭 추가 발사(초당 8회까지). 걷는 중엔 쉬고, 조이스틱으로 그대로 걸어 나감.
 * 코인은 0.25초마다 모아서 setState, 떠오르는 글자도 그때 한 번.
 */
export class TrainingRange {
  private readonly game: Game;
  private readonly fx: HitFx;
  private readonly float: FloatText;
  private readonly limiter = new TapLimiter(BALANCE.tap.maxPerSec);
  private shotAcc = 0;
  private pending = 0;
  private flushT = 0;
  private clock = 0;
  private targetIdx = 0;
  private kick = 0;
  private readonly wobble: number[];
  private hiddenAt = 0;
  private readonly zone: ZoneEntry;
  /** 디버그·검증: 지금까지 인정한 탭 수 */
  tapsAccepted = 0;

  constructor(game: Game, fx: HitFx, float: FloatText, callout: ZoneCallout) {
    this.game = game;
    this.fx = fx;
    this.float = float;
    this.wobble = game.hub.targets.map(() => 0);
    this.zone = new ZoneEntry(game, callout, WORLD1_FACILITIES.find((f) => f.id === 'range')!, {
      color: '#4fb3ff',
      flash: 'rgba(79, 179, 255, 0.85)',
      // 매트(6×4m) 안 무작위 자리: 여러 명이 훈련해도 한 점에 겹치지 않음
      spot: () => ({ x: RANGE_SPOT.x + (Math.random() - 0.5) * 4.4, z: RANGE_SPOT.z + (Math.random() - 0.5) * 2.6 }),
      face: RANGE_TARGET,
      text: { title: t('range.title'), big: t('range.big'), hand: true },
    });
    // 착지하자마자 한 발
    this.zone.onLanded = () => this.fire(false);
    game.facilityActions.range = () => this.start();
    game.facilityLeave.range = () => this.stop();
    game.onTick((dt) => this.update(dt));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  active = false;

  start(): void {
    if (this.active) return;
    this.active = true;
    this.game.tapHandler = (taps) => { for (let i = 0; i < taps.length; i++) this.tap(); };
    this.shotAcc = 0;
    this.zone.enter();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.flush();
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
    const g = this.game;
    this.pending += coinPerShot(g.state, HUB_WORLD, Date.now());
    this.targetIdx = (this.targetIdx + 1) % g.hub.targets.length;
    const target = g.hub.targets[this.targetIdx]!;
    this.wobble[this.targetIdx] = 1;
    this.kick = 0.06;
    g.avatar.getMuzzle(_muzzle);
    _aim.set(target.position.x + (Math.random() - 0.5) * 0.4, 1.6 + (Math.random() - 0.5) * 0.4, target.position.z + 0.12);
    this.fx.shot(_muzzle, _aim);
    audio.play(FIRE_SOUND[GUNS[g.state.gun]!.model]);
    if (tapped) this.float.show(t('float.pop'), _aim, 'pop');
  }

  private flush(): void {
    if (this.pending <= 0) return;
    const g = this.game;
    g.setState(addCoins(g.state, this.pending));
    _aim.set(RANGE_SPOT.x, 2.4, RANGE_SPOT.z - 3);
    this.float.show(`+${formatNum(this.pending)}`, _aim, 'coin');
    audio.play('coin');
    this.pending = 0;
  }

  private update(dt: number): void {
    this.clock += dt;
    this.fx.update(dt);
    this.float.update(dt);
    this.zone.update(dt);
    const g = this.game;
    g.hub.targets.forEach((t, i) => {
      const w = this.wobble[i]!;
      if (w <= 0) return;
      this.wobble[i] = Math.max(0, w - dt * 4);
      t.rotation.x = -Math.sin(w * Math.PI * 2) * 0.25 * w;
    });
    if (!this.active) return;
    if (this.zone.snapping) return;
    // 걷는 중엔 쏘지 않음 (판 밖으로 나가면 facilityLeave가 stop)
    if (g.velocity.lengthSq() > 0.04) {
      g.pose.aimAt = null;
      this.flushT += dt;
      if (this.flushT >= FLUSH_SEC) { this.flushT = 0; this.flush(); }
      return;
    }
    const t = g.hub.targets[this.targetIdx]!;
    g.pose.aimAt = _aimAt.set(t.position.x, 1.6, t.position.z);
    g.yaw = Math.atan2(t.position.x - g.pos.x, t.position.z - g.pos.z);
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

  /** 탭이 숨겨진 동안(RAF 멈춤) 훈련 중이었으면 경과 시간만큼 정산 (100% 속도, 탭 없음, 오프라인 한도까지) */
  catchUp(elapsedSec: number, now: number): number {
    const sec = Math.max(0, Math.min(BALANCE.offline.capSec, elapsedSec));
    const s = this.game.state;
    return coinPerShot(s, HUB_WORLD, now) * shotsPerSec(s) * sec;
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') { this.hiddenAt = Date.now(); return; }
    if (!this.active || !this.hiddenAt) return;
    const now = Date.now();
    const coins = this.catchUp((now - this.hiddenAt) / 1000, now);
    this.hiddenAt = 0;
    if (coins <= 0) return;
    this.game.setState(addCoins(this.game.state, coins), true);
    _aim.set(RANGE_SPOT.x, 2.8, RANGE_SPOT.z - 3);
    this.float.show(t('float.away', { n: formatNum(coins) }), _aim, 'coin big');
  };
}
