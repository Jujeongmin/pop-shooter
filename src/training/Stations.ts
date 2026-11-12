import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { t } from '../i18n/i18n';
import { highestWorld } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { TapLimiter } from '../sim/tapLimiter.ts';
import { gainPerShot, spdMaxed, train, type TrainKind } from '../sim/training.ts';
import type { FloatText } from '../ui/FloatText';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { pct } from '../ui/UpgradePanel';
import { FOUNTAIN, FOUNTAIN_SPOTS, TREADMILL, TREADMILL_LANES, WORLD1_FACILITIES } from '../world/facilities';

const FLUSH_SEC = 0.25;
/** 러닝머신에서 달리는 속도 (걷기·달리기 클립 고르기용, m/s) */
const RUN_SPEED = 3.4;
/** 러닝머신 벨트 윗면 높이 (HubFacilities.buildTreadmill 벨트 0.33m) */
const BELT_Y = 0.34;
const _at = new THREE.Vector3();
const _to = new THREE.Vector3();
const _run = new THREE.Vector3();

interface Station {
  kind: Exclude<TrainKind, 'atk'>;
  zone: ZoneEntry;
  active: boolean;
  acc: number;
  pending: number;
  flushT: number;
  /** 최근 1초 동작 수 (러닝머신 벨트 속도) */
  recent: number;
}

/**
 * 사격 말고 다른 방식의 훈련 (사용자 2026-11-12):
 * - 러닝머신(연사): 위에 서면 달림, 걸음마다 연사 훈련.
 * - 동전 분수(골드 보너스): 떨어지는 동전을 받을 때마다 골드 보너스 훈련.
 * 둘 다 기본 초당 actionsPerSec번 + 탭(초당 8회까지). 걷기 시작하면 쉼(구역을 나가면 끝). 0.25초마다 모아 setState.
 */
export class Stations {
  private readonly game: Game;
  private readonly float: FloatText;
  private readonly limiter = new TapLimiter(BALANCE.tap.maxPerSec);
  private readonly list: Station[];
  private clock = 0;
  private hiddenAt = 0;

  constructor(game: Game, float: FloatText, callout: ZoneCallout) {
    this.game = game;
    this.float = float;
    const make = (kind: Station['kind'], id: 'treadmill' | 'fountain', spot: () => { x: number; z: number }, face: { x: number; z: number }, color: string, title: string, landY = 0): Station => {
      const zone = new ZoneEntry(game, callout, WORLD1_FACILITIES.find((f) => f.id === id)!, {
        color,
        flash: 'rgba(79, 179, 255, 0.8)',
        spot,
        face,
        landY,
        text: { title, big: t('st.tap'), hand: true },
      });
      const st: Station = { kind, zone, active: false, acc: 0, pending: 0, flushT: 0, recent: 0 };
      game.facilityActions[id] = () => this.start(st);
      game.facilityLeave[id] = () => this.stop(st);
      return st;
    };
    this.list = [
      // 벨트 윗면(0.33m) 위에 섬
      // 빈 벨트·빈 자리를 고름 (다른 사람과 겹치지 않게, 다 차면 아무 데나)
      make('spd', 'treadmill', () => this.freeSpot(TREADMILL_LANES, TREADMILL.x, TREADMILL.z + 0.2), { x: TREADMILL.x, z: TREADMILL.z - 30 }, '#4f9dff', t('st.run'), BELT_Y),
      make('coin', 'fountain', () => this.freeSpot(FOUNTAIN_SPOTS, FOUNTAIN.x, FOUNTAIN.z), { x: FOUNTAIN.x, z: FOUNTAIN.z - 3 }, '#ffc928', t('st.coin')),
    ];
    game.onTick((dt) => this.update(dt));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** 줄 가운데 cx에서 offsets만큼 옆 자리 중 다른 사람이 없는 곳 (내게 가까운 쪽 먼저) */
  private freeSpot(offsets: readonly number[], cx: number, z: number): { x: number; z: number } {
    const g = this.game;
    const order = [...offsets].sort((a, b) => Math.abs(cx + a - g.pos.x) - Math.abs(cx + b - g.pos.x));
    const free = order.find((dx) => !g.peerAt?.(cx + dx, z, 0.6));
    return { x: cx + (free ?? order[0]!), z };
  }

  private start(st: Station): void {
    if (st.active) return;
    st.active = true;
    st.acc = 0;
    st.zone.enter();
    this.game.tapHandler = (taps) => { for (let i = 0; i < taps.length; i++) this.tap(st); };
    if (st.kind === 'spd' && spdMaxed(this.game.state)) this.float.show(t('range.spdMax'), _at.set(TREADMILL.x, 2.6, TREADMILL.z - 1), 'big');
  }

  private stop(st: Station): void {
    if (!st.active) return;
    this.flush(st);
    st.active = false;
    st.zone.leave();
    this.game.tapHandler = null;
    if (st.kind === 'spd') this.game.hub.treadmill.setSpeed(0);
  }

  private tap(st: Station): void {
    if (!st.active || st.zone.snapping) return;
    if (!this.limiter.accept(this.clock)) return;
    this.act(st);
  }

  /** 동작 한 번: 러닝머신 = 한 걸음, 동전 분수 = 동전 하나 떨어짐(받으면 셈) */
  private act(st: Station): void {
    st.recent += 1;
    if (st.kind === 'spd') {
      st.pending += 1;
      return;
    }
    const g = this.game;
    _to.set(g.pos.x, 1.1, g.pos.z + 0.15);
    g.hub.fountain.drop(_to, () => {
      if (!st.active) return;
      st.pending += 1;
      audio.play('coin');
    });
  }

  private flush(st: Station): void {
    if (st.pending <= 0) return;
    const g = this.game;
    const world = highestWorld(g.state);
    const gain = gainPerShot(g.state, st.kind, world) * st.pending;
    g.setState(train(g.state, st.kind, st.pending, world));
    st.pending = 0;
    if (st.kind === 'spd' && spdMaxed(g.state)) return;
    const at = st.kind === 'spd' ? TREADMILL : FOUNTAIN;
    this.float.show(`+${pct(gain)}%`, _at.set(at.x, 2.5, at.z - 0.6), st.kind === 'coin' ? 'coin' : 'big');
  }

  private update(dt: number): void {
    this.clock += dt;
    const g = this.game;
    for (const st of this.list) {
      st.zone.update(dt);
      st.recent = Math.max(0, st.recent - st.recent * dt);
      if (!st.active || st.zone.snapping) continue;
      // 조이스틱·키로 걷기 시작하면 쉼 (구역을 나가면 facilityLeave가 stop)
      const walking = g.velocity.lengthSq() > 0.04 && st.kind === 'coin';
      if (st.kind === 'spd') {
        // 러닝머신: 앞(−z)을 보고 달리는 자세 (실제로는 제자리)
        const steering = g.controls.move();
        if (steering.x === 0 && steering.y === 0) {
          g.yaw = Math.PI;
          g.velocity.copy(_run.set(0, 0, -RUN_SPEED));
          g.pos.y = BELT_Y;
        }
        g.hub.treadmill.setSpeed(BALANCE.train.actionsPerSec + st.recent);
      }
      if (!walking) {
        st.acc += BALANCE.train.actionsPerSec * dt;
        while (st.acc >= 1) { st.acc -= 1; this.act(st); }
      }
      st.flushT += dt;
      if (st.flushT >= FLUSH_SEC) { st.flushT = 0; this.flush(st); }
    }
  }

  /** 탭이 숨겨진 동안(RAF 멈춤) 이 구역에 있었으면 경과 시간만큼 (기본 속도, 탭 없음, 오프라인 한도까지) */
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') { this.hiddenAt = Date.now(); return; }
    const st = this.list.find((x) => x.active);
    if (!st || !this.hiddenAt) return;
    const sec = Math.max(0, Math.min(BALANCE.offline.capSec, (Date.now() - this.hiddenAt) / 1000));
    this.hiddenAt = 0;
    const n = BALANCE.train.actionsPerSec * sec;
    if (n <= 0) return;
    const g = this.game;
    const world = highestWorld(g.state);
    const gain = gainPerShot(g.state, st.kind, world) * n;
    g.setState(train(g.state, st.kind, n, world), true);
    const at = st.kind === 'spd' ? TREADMILL : FOUNTAIN;
    this.float.show(t('float.away', { n: `${pct(gain)}%` }), _at.set(at.x, 2.8, at.z - 0.6), 'coin big');
  };
}
