import { t } from '../i18n/i18n';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { HitFx } from '../fx/HitFx';
import { autoDps } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatNum } from '../sim/format.ts';
import { finishRun, startRun, stepRun, tapRun, type Run } from '../sim/run.ts';
import { isBoss, stageHp, stageLabel, stageTime } from '../sim/stages.ts';
import { TapLimiter } from '../sim/tapLimiter.ts';
import { CHARACTERS } from '../config/characters';
import type { BattleHud } from '../ui/BattleHud';
import type { FloatText } from '../ui/FloatText';
import type { ResultCard } from '../ui/ResultCard';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { PORTAL_SPOT } from '../world/facilities';
import { ToyBoss } from './ToyBoss';

/** 전투 무대 위치 (광장은 숨김) */
const PLAYER_AT = { x: 0, z: 6 };
const BOSS_AT = { x: 0, z: -4 };
const FLOAT_SEC = 0.3;
/** 끝난 뒤 결과 카드까지 (보스 쓰러지는 연출 볼 시간) */
const END_DELAY = 1.1;

const _muzzle = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _chest = new THREE.Vector3();
/** 아바타 조준점 (다른 임시 벡터와 따로) */
const _aimAt = new THREE.Vector3();

/**
 * 연속 도전 전투: 포털 → 무대(둥근 장난감 경기장)로 순간이동 → 1-1부터 자동 사격, 깨면 다음 보스, 시간 초과면 끝 → 결과 카드 → 광장.
 * 규칙은 sim/run.ts, 여기는 연출만. 무대는 한 번 만들어 재사용(소유, dispose), 보스는 스테이지마다 만들고 버림.
 */
export class BattleScene {
  private readonly game: Game;
  private readonly fx: HitFx;
  private readonly float: FloatText;
  private readonly hud: BattleHud;
  private readonly result: ResultCard;
  private readonly callout: ZoneCallout;
  private readonly arena = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private readonly limiter = new TapLimiter(BALANCE.tap.maxPerSec);
  private run: Run | null = null;
  private boss: ToyBoss | null = null;
  /** 쓰러지는 중인 이전 보스 */
  private dying: ToyBoss | null = null;
  private clock = 0;
  private kick = 0;
  private dmgAcc = 0;
  private floatT = 0;
  private endT = -1;
  /** 디버그·검증 */
  get active(): boolean {
    return this.run !== null;
  }

  constructor(game: Game, fx: HitFx, float: FloatText, hud: BattleHud, result: ResultCard, callout: ZoneCallout) {
    this.game = game;
    this.fx = fx;
    this.float = float;
    this.hud = hud;
    this.result = result;
    this.callout = callout;
    this.buildArena();
    this.arena.visible = false;
    game.stage.scene.add(this.arena);
    game.onTick((dt) => this.update(dt));
  }

  /** 둥근 경기장 + 둘레 벽(관중석 블록) + 바깥은 벽 높이로 가림 */
  private buildArena(): void {
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      this.owned.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.arena.add(m);
      return m;
    };
    const mat = (color: string): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      this.owned.push(m);
      return m;
    };
    add(new THREE.CylinderGeometry(40, 40, 1, 48), mat('#ffd9ec'), 0, -0.5, 0);
    add(new THREE.CylinderGeometry(11, 11, 0.12, 64), mat('#fff3c4'), 0, 0.06, 0);
    add(new THREE.RingGeometry(10.4, 11, 64).rotateX(-Math.PI / 2), mat('#ff9ec4'), 0, 0.13, 0);
    // 둘레 벽: 색 블록 기둥을 빙 둘러 (InstancedMesh 하나)
    const blockGeo = new THREE.BoxGeometry(2.2, 1, 1.6);
    this.owned.push(blockGeo);
    const colors = ['#ff9ec4', '#7cc4ff', '#ffd34d', '#7fd78a', '#b9a6ff', '#ff8a5b'];
    const N = 40;
    const ROWS = 4;
    const im = new THREE.InstancedMesh(blockGeo, mat('#ffffff'), N * ROWS);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let row = 0; row < ROWS; row++) {
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + (row % 2) * (Math.PI / N);
        const r = 14 + row * 1.6;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
        m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.5 + row * 1.4, Math.sin(a) * r), q, new THREE.Vector3(1, 1 + row * 1.4, 1));
        im.setMatrixAt(row * N + i, m4);
        im.setColorAt(row * N + i, c.set(colors[(i + row) % colors.length]!));
      }
    }
    im.castShadow = true;
    this.arena.add(im);
  }

  /** 포털 착지 뒤 호출: 광장 숨기고 연속 도전 시작 */
  start(world: number): void {
    if (this.run) return;
    const g = this.game;
    g.hub.root.visible = false;
    this.arena.visible = true;
    g.setMode('battle');
    g.hud.setVisible(false);
    g.placeAt(PLAYER_AT.x, PLAYER_AT.z, Math.PI);
    g.cam.focus = -1.2;
    this.run = startRun(g.state, world);
    this.endT = -1;
    this.dmgAcc = 0;
    this.spawnBoss();
    this.hud.show(true);
    g.tapHandler = (taps) => { for (let i = 0; i < taps.length; i++) this.tap(); };
  }

  private spawnBoss(): void {
    const run = this.run!;
    this.boss = new ToyBoss(run.stage);
    // 큰 보스일수록 카메라를 뒤·위로 (대장 머리·왕관이 잘리지 않게)
    const extra = Math.max(0, this.boss.height - 2.4);
    this.game.cam.focus = -1.2 - extra * 0.28;
    this.game.cam.lookUp = extra * 0.35;
    this.boss.root.position.set(BOSS_AT.x, 0, BOSS_AT.z);
    this.boss.root.rotation.y = 0;
    this.arena.add(this.boss.root);
    const label = stageLabel(run.stage);
    this.hud.setStage(label, isBoss(run.stage));
    this.callout.show({ title: isBoss(run.stage) ? t('battle.bossIn') : t('battle.run'), big: label });
    window.setTimeout(() => { if (this.run) this.callout.hide(); }, 900);
  }

  private tap(): void {
    const run = this.run;
    if (!run || run.done || run.gap > 0) return;
    if (!this.limiter.accept(this.clock)) return;
    const before = run.battle.hp;
    const cleared = tapRun(run);
    this.shoot(before - (cleared !== null ? 0 : run.battle.hp), true);
    if (cleared !== null) this.onCleared(cleared);
  }

  private shoot(dmg: number, tapped: boolean): void {
    const boss = this.boss;
    if (!boss) return;
    this.game.avatar.getMuzzle(_muzzle);
    boss.chest(_aim);
    _aim.x += (Math.random() - 0.5) * boss.height * 0.3;
    _aim.y += (Math.random() - 0.5) * boss.height * 0.3;
    _aim.z += 0.4;
    this.fx.shot(_muzzle, _aim);
    boss.hit();
    this.kick = 0.06;
    this.dmgAcc += dmg;
    if (tapped) this.float.show(t('float.pop'), _aim, 'pop');
  }

  private onCleared(stage: number): void {
    const run = this.run!;
    this.boss?.defeat();
    this.dying?.dispose();
    this.dying = this.boss;
    this.boss = null;
    this.game.cam.shake(0.15);
    this.callout.flash('rgba(255, 211, 77, 0.9)');
    this.float.show(t('battle.cleared', { s: stageLabel(stage) }), _chest.set(BOSS_AT.x, 3, BOSS_AT.z), 'coin big');
    if (run.done) this.endT = 0;
  }

  private update(dt: number): void {
    this.clock += dt;
    this.boss?.update(dt);
    if (this.dying) {
      this.dying.update(dt);
      if (this.dying.gone) { this.dying.dispose(); this.dying = null; }
    }
    const run = this.run;
    if (!run) return;
    const g = this.game;
    if (this.endT >= 0) {
      this.endT += dt;
      if (this.endT >= END_DELAY) this.finish();
      return;
    }
    const before = run.battle.hp;
    const { shots, cleared } = stepRun(run, dt);
    if (shots > 0) {
      const per = (before - (cleared !== null ? 0 : run.battle.hp)) / shots;
      for (let i = 0; i < shots; i++) this.shoot(per, false);
    }
    if (cleared !== null) this.onCleared(cleared);
    if (run.done === 'fail') {
      this.endT = 0;
      this.callout.show({ title: t('battle.timeUp'), big: t('battle.failed', { s: stageLabel(run.stage) }) });
      return;
    }
    // 쉬는 시간이 끝나 가면 다음 보스 등장
    if (!this.boss && !run.done && run.gap < 0.5) this.spawnBoss();
    // 조준·반동
    if (this.boss) g.pose.aimAt = this.boss.chest(_aimAt);
    this.kick = Math.max(0, this.kick - dt * 0.6);
    g.pose.kick = this.kick;
    // 데미지 숫자 (모아서)
    this.floatT += dt;
    if (this.floatT >= FLOAT_SEC && this.dmgAcc > 0 && this.boss) {
      this.floatT = 0;
      this.float.show(`-${formatNum(this.dmgAcc)}`, this.boss.chest(_aim).setY(this.boss.height * 0.95), 'big');
      this.dmgAcc = 0;
    }
    const b = run.battle;
    this.boss?.setHpRatio(b.hp / b.maxHp);
    this.hud.update(run.gap > 0 ? stageHp(run.stage) : b.hp, b.maxHp, b.timeLeft, autoDps(run.from));
  }

  private finish(): void {
    const run = this.run!;
    const g = this.game;
    const res = finishRun(g.state, run.cleared);
    g.setState(res.state, true);
    const failed = run.done === 'fail' ? run.stage : null;
    const title = run.done === 'worldClear' ? t('result.world', { w: run.world }) : run.cleared.length > 0 ? t('result.stages', { n: run.cleared.length }) : t('result.none');
    const tip = failed !== null
      ? t('result.tip', { s: stageLabel(failed), need: formatNum(stageHp(failed) / stageTime(failed)), now: formatNum(autoDps(res.state)) })
      : null;
    this.hud.show(false);
    this.callout.hide();
    g.tapHandler = null;
    this.result.show({
      title,
      cleared: run.cleared.map(stageLabel),
      failed: failed !== null ? stageLabel(failed) : null,
      coins: formatNum(res.coins),
      tip,
      unlocked: res.unlockedChars.map((c) => CHARACTERS[c].name),
    }, () => this.exit());
    this.run = null;
    this.endT = -1;
  }

  /** 결과 카드 닫으면: 무대 숨기고 광장 포털 앞으로 (포털 구역 밖) */
  private exit(): void {
    const g = this.game;
    this.boss?.dispose();
    this.boss = null;
    this.dying?.dispose();
    this.dying = null;
    this.arena.visible = false;
    g.hub.root.visible = true;
    g.pose.aimAt = null;
    g.pose.kick = 0;
    g.cam.focus = 0;
    g.cam.lookUp = 0;
    g.hud.setVisible(true);
    g.setMode('hub');
    g.placeAt(PORTAL_SPOT.x, PORTAL_SPOT.z + 3.2, Math.PI);
  }

  dispose(): void {
    this.boss?.dispose();
    this.dying?.dispose();
    for (const o of this.owned) o.dispose();
    this.arena.removeFromParent();
  }
}
