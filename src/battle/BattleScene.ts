import { t, type StrKey } from '../i18n/i18n';
import { MENTORS } from '../sim/training.ts';
import { audio } from '../audio/audio';
import { FIRE_SOUND } from '../config/audio';
import { GUNS } from '../sim/guns.ts';
import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { HitFx } from '../fx/HitFx';
import { autoDps } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatNum } from '../sim/format.ts';
import { finishRun, startRun, stepRun, type Run } from '../sim/run.ts';
import { isBoss, stageHp, stageLabel, stageTime } from '../sim/stages.ts';
import { CHARACTERS } from '../config/characters';
import type { BattleHud } from '../ui/BattleHud';
import type { FloatText } from '../ui/FloatText';
import type { ResultCard } from '../ui/ResultCard';
import type { ZoneCallout } from '../ui/ZoneCallout';
import { PORTAL_SPOT } from '../world/facilities';
import { ToyBoss } from './ToyBoss';
import { themeOf } from '../world/worldThemes';

/** 전투 무대 위치 (광장은 숨김) */
const PLAYER_AT = { x: 0, z: 6 };
const BOSS_AT = { x: 0, z: -4 };
const FLOAT_SEC = 0.3;
/** 끝난 뒤 결과 카드까지 (보스 쓰러지는 연출 볼 시간) */
const END_DELAY = 1.1;
/** 포털 착지 뒤 시작 연출: 카메라가 보스 쪽에서 내 뒤로 돌아옴, 이 동안 전투 안 함 (사용자 2026-11-11: 시작 전에 1-1이 끝나던 문제) */
const INTRO_SEC = 2.2;
const INTRO_YAW = Math.PI * 0.8;
/**
 * 보스 반격: 스테이지 제한 시간을 HITS칸으로 나눠, 칸마다 장난감 공 하나가 날아와 내 체력 한 칸을 깎음.
 * 마지막 공이 닿는 순간 = 제한 시간 끝 → 계산은 sim의 시간 제한 그대로 (밸런스 변화 없음), 보기에는 맞고 쓰러짐.
 */
const HITS = 10;
const FLIGHT = 0.7;
const POOL = 4;

interface Toy { mesh: THREE.Mesh; t: number; from: THREE.Vector3; to: THREE.Vector3 }

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
  private introT = INTRO_SEC;
  private goShown = true;
  private readonly arena = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private run: Run | null = null;
  private boss: ToyBoss | null = null;
  /** 쓰러지는 중인 이전 보스 */
  private dying: ToyBoss | null = null;
  private clock = 0;
  private kick = 0;
  private dmgAcc = 0;
  private floatT = 0;
  private endT = -1;
  /** 이번 스테이지 전체 시간, 던진 수, 맞은 수 */
  private stageT = 1;
  /** 방금 깬 스테이지 최대 체력: 다음 보스가 나오기 전까지 체력바를 0 / 이 값으로 (한 방에 깨도 깎인 게 보이게) */
  private clearedMax = 0;
  private launched = 0;
  private landed = 0;
  private readonly toys: Toy[] = [];
  private floorMat!: THREE.MeshStandardMaterial;
  private centerMat!: THREE.MeshStandardMaterial;
  private ringMat!: THREE.MeshStandardMaterial;
  private blocks!: THREE.InstancedMesh;
  private themeWorld = 1;
  /** 월드 클리어 축하 시간 (−1 = 안 함) */
  private cheerT = -1;
  /** 이번 연속 도전으로 새로 열린 월드 (결과 카드 닫으면 그 광장으로) */
  private opened = 0;
  private hurtT = 1;
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
    const toyGeo = new THREE.SphereGeometry(0.24, 16, 12);
    const toyMat = new THREE.MeshStandardMaterial({ color: '#ff5e6a', roughness: 0.4 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
    const stripeGeo = new THREE.TorusGeometry(0.245, 0.04, 6, 20);
    this.owned.push(toyGeo, toyMat, stripeMat, stripeGeo);
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(toyGeo, toyMat);
      mesh.add(new THREE.Mesh(stripeGeo, stripeMat));
      mesh.castShadow = true;
      mesh.visible = false;
      this.arena.add(mesh);
      this.toys.push({ mesh, t: FLIGHT, from: new THREE.Vector3(), to: new THREE.Vector3() });
    }
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
    this.floorMat = mat('#ffd9ec');
    this.centerMat = mat('#fff3c4');
    this.ringMat = mat('#ff9ec4');
    add(new THREE.CylinderGeometry(40, 40, 1, 48), this.floorMat, 0, -0.5, 0);
    add(new THREE.CylinderGeometry(11, 11, 0.12, 64), this.centerMat, 0, 0.06, 0);
    add(new THREE.RingGeometry(10.4, 11, 64).rotateX(-Math.PI / 2), this.ringMat, 0, 0.13, 0);
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
    this.blocks = im;
  }

  /** 무대 색을 월드 테마로 (바닥·가운데·테두리·둘레 블록). 같은 월드면 그대로 */
  private applyTheme(world: number): void {
    if (world === this.themeWorld) return;
    this.themeWorld = world;
    const a = themeOf(world).arena;
    this.floorMat.color.set(a.floor);
    this.centerMat.color.set(a.center);
    this.ringMat.color.set(a.ring);
    const c = new THREE.Color();
    const N = 40;
    for (let i = 0; i < this.blocks.count; i++) this.blocks.setColorAt(i, c.set(a.blocks[((i % N) + Math.floor(i / N)) % a.blocks.length]!));
    if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
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
    audio.setMusic('battle');
    this.applyTheme(world);
    this.run = startRun(g.state, world);
    // 시작 연출 동안은 쉬는 시간으로 둠 (자동 발사·탭 막힘)
    this.run.gap = INTRO_SEC;
    this.introT = 0;
    this.goShown = false;
    g.cam.yaw = INTRO_YAW;
    this.endT = -1;
    this.dmgAcc = 0;
    this.spawnBoss();
    this.hud.show(true);
    // 탭으로 더 쏘기 없음 (사용자 2026-11-12): 자동 사격만
  }

  private spawnBoss(): void {
    const run = this.run!;
    this.boss = new ToyBoss(run.stage, themeOf(run.world).bossTints);
    // 큰 보스일수록 카메라를 뒤·위로 (대장 머리·왕관이 잘리지 않게)
    const extra = Math.max(0, this.boss.height - 2.4);
    this.game.cam.focus = -1.2 - extra * 0.28;
    this.game.cam.lookUp = extra * 0.35;
    this.boss.root.position.set(BOSS_AT.x, 0, BOSS_AT.z);
    this.stageT = run.battle.timeLeft;
    this.launched = 0;
    this.landed = 0;
    this.hud.setMyHp(1);
    this.boss.root.rotation.y = 0;
    this.arena.add(this.boss.root);
    const label = stageLabel(run.stage);
    this.hud.setStage(label, isBoss(run.stage));
    if (this.introT < INTRO_SEC) {
      // 처음 전투 띠: 자동으로 싸우니 가만히 있어도 됨 (사용자 2026-11-12)
      this.callout.show({ title: t('battle.auto'), big: t('battle.ready') });
      return;
    }
    this.callout.show({ title: isBoss(run.stage) ? t('battle.bossIn') : t('battle.run'), big: label });
    window.setTimeout(() => { if (this.run) this.callout.hide(); }, 900);
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
    audio.play(FIRE_SOUND[GUNS[this.game.state.gun]!.model]);
    audio.play('bossHit');
    boss.hit();
    this.kick = 0.06;
    this.dmgAcc += dmg;
    if (tapped) this.float.show(t('float.pop'), _aim, 'pop');
  }

  private onCleared(stage: number): void {
    const run = this.run!;
    // 한 방에 깨면 모아 둔 피해 숫자가 보스와 함께 사라지던 것 (사용자 2026-11-12) → 쓰러지기 전에 바로 띄움
    if (this.boss && this.dmgAcc > 0) {
      this.float.show(`-${formatNum(this.dmgAcc)}`, this.boss.chest(_aim), 'big');
      this.dmgAcc = 0;
      this.floatT = 0;
    }
    this.clearedMax = stageHp(stage);
    this.boss?.defeat();
    audio.play('bossDown');
    for (const toy of this.toys) { toy.t = FLIGHT; toy.mesh.visible = false; }
    this.dying?.dispose();
    this.dying = this.boss;
    this.boss = null;
    this.game.cam.shake(0.15);
    this.callout.flash('rgba(255, 211, 77, 0.9)');
    this.float.show(t('battle.cleared', { s: stageLabel(stage) }), _chest.set(BOSS_AT.x, 3, BOSS_AT.z), 'coin big');
    if (run.done) this.endT = 0;
    if (run.done === 'worldClear') {
      this.cheerT = 0;
      audio.play('cheer');
      this.game.pose.aimAt = null;
    }
  }

  private update(dt: number): void {
    this.clock += dt;
    // 월드 클리어 축하: 만세 + 통통 점프 (결과 카드가 닫힐 때까지, 사용자 2026-11-12)
    if (this.cheerT >= 0) {
      const g = this.game;
      this.cheerT += dt;
      g.pose.cheer = Math.min(1, this.cheerT * 4);
      const hop = Math.abs(Math.sin(this.cheerT * Math.PI * 1.4)) * 0.55;
      g.pos.y = hop;
      g.pose.grounded = hop < 0.05;
    }
    this.boss?.update(dt);
    if (this.dying) {
      this.dying.update(dt);
      if (this.dying.gone) { this.dying.dispose(); this.dying = null; }
    }
    const run = this.run;
    if (!run) return;
    const g = this.game;
    if (this.introT < INTRO_SEC) {
      this.introT += dt;
      const k = Math.min(1, this.introT / (INTRO_SEC - 0.4));
      const e = k * k * (3 - 2 * k);
      g.cam.yaw = INTRO_YAW * (1 - e);
      if (!this.goShown && this.introT >= INTRO_SEC - 0.6) {
        this.goShown = true;
        this.callout.show({ title: stageLabel(run.stage), big: t('battle.go') });
        window.setTimeout(() => { if (this.run) this.callout.hide(); }, 700);
      }
    }
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
      this.landed = HITS;
      this.hud.setMyHp(0);
      g.pose.dead = true;
      g.pose.aimAt = null;
      // 날아가던 장난감이 공중에 멈춰 있지 않게 치움
      for (const toy of this.toys) { toy.t = FLIGHT; toy.mesh.visible = false; }
      this.callout.show({ title: t('battle.timeUp'), big: t('battle.failed', { s: stageLabel(run.stage) }) });
      return;
    }
    this.updateToys(dt);
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
      // 머리 위가 아니라 가슴 높이: 멀리 작은 보스면 머리 위 숫자가 화면 위 체력바·DPS와 겹침
      this.float.show(`-${formatNum(this.dmgAcc)}`, this.boss.chest(_aim), 'big');
      this.dmgAcc = 0;
    }
    const b = run.battle;
    this.boss?.setHpRatio(b.hp / b.maxHp);
    // 쉬는 시간: 다음 보스가 나오기 전까지는 방금 깬 보스 체력 0, 나오면 새 체력
    if (run.gap > 0 && !this.boss) this.hud.update(0, this.clearedMax, autoDps(run.from));
    else this.hud.update(run.gap > 0 ? stageHp(run.stage) : b.hp, b.maxHp, autoDps(run.from));
  }

  /** 보스가 칸마다 장난감 공을 던짐 (도착 시각 = 칸 경계), 닿으면 내 체력 한 칸 */
  private updateToys(dt: number): void {
    const run = this.run!;
    const g = this.game;
    const boss = this.boss;
    if (boss && run.gap <= 0 && !run.done) {
      const elapsed = this.stageT - run.battle.timeLeft;
      const step = this.stageT / HITS;
      while (this.launched < HITS && (this.launched + 1) * step - FLIGHT <= elapsed) {
        const toy = this.toys.find((x) => x.t >= FLIGHT);
        this.launched++;
        if (!toy) continue;
        boss.throwToy();
        audio.play('bossThrow');
        boss.chest(toy.from);
        toy.from.y = boss.height * 0.7;
        toy.from.z += boss.height * 0.15;
        toy.to.set(g.pos.x, 1.1, g.pos.z);
        toy.t = 0;
        toy.mesh.visible = true;
        toy.mesh.scale.setScalar(Math.max(1.6, boss.height / 2.4));
      }
    }
    for (const toy of this.toys) {
      if (toy.t >= FLIGHT) continue;
      toy.t += dt;
      const k = Math.min(1, toy.t / FLIGHT);
      toy.mesh.position.lerpVectors(toy.from, toy.to, k);
      toy.mesh.position.y += Math.sin(k * Math.PI) * 1.6;
      toy.mesh.rotation.x += dt * 12;
      toy.mesh.rotation.z += dt * 7;
      if (k < 1) continue;
      toy.mesh.visible = false;
      this.landed = Math.min(HITS, this.landed + 1);
      this.hud.setMyHp(1 - this.landed / HITS);
      this.hud.hurt();
      audio.play('playerHit');
      this.hurtT = 0;
      this.callout.flash('rgba(255, 80, 95, 0.55)');
      g.cam.shake(0.07);
    }
    // 맞으면 뒤로 살짝 밀렸다 돌아옴
    if (this.hurtT < 1) {
      this.hurtT = Math.min(1, this.hurtT + dt * 4);
      g.pos.z = PLAYER_AT.z + Math.sin(this.hurtT * Math.PI) * 0.35;
    }
  }

  private finish(): void {
    const run = this.run!;
    const g = this.game;
    const res = finishRun(g.state, run.cleared, Date.now());
    const prevBest = g.state.bestStage;
    g.setState(res.state, true);
    // 월드 대장 첫 클리어 = 다음 월드 열림 → 결과 카드 닫으면 그 광장으로 (사용자 2026-11-12: 월드마다 광장 따로)
    const bossStage = run.world * BALANCE.stage.perWorld;
    this.opened = run.done === 'worldClear' && prevBest < bossStage && run.world < BALANCE.stage.worlds ? run.world + 1 : 0;
    audio.play(run.cleared.length > 0 ? 'win' : 'lose');
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
      // 이번에 기록을 넘어 영입된 멘토 (모든 훈련 ×1.28)
      mentors: MENTORS.filter((m) => m.needStage > prevBest && m.needStage <= res.state.bestStage).map((m) => t(`mentor.${m.id}` as StrKey)),
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
    g.pose.dead = false;
    this.cheerT = -1;
    g.pose.cheer = 0;
    g.pose.grounded = true;
    g.pos.y = 0;
    for (const toy of this.toys) { toy.t = FLIGHT; toy.mesh.visible = false; }
    g.cam.focus = 0;
    g.cam.lookUp = 0;
    g.hud.setVisible(true);
    g.setMode('hub');
    audio.setMusic('hub');
    g.placeAt(PORTAL_SPOT.x, PORTAL_SPOT.z + 3.2, Math.PI);
    if (this.opened) {
      const w = this.opened;
      this.opened = 0;
      this.callout.flash('rgba(255, 255, 255, 1)');
      g.setWorld(w);
      this.callout.show({ title: t('travel.opened', { w }), big: t(`world.${w}` as StrKey) });
      window.setTimeout(() => this.callout.hide(), 1800);
    }
  }

  dispose(): void {
    this.boss?.dispose();
    this.dying?.dispose();
    for (const o of this.owned) o.dispose();
    this.arena.removeFromParent();
  }
}
