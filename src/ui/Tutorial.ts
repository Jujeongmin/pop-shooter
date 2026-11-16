import * as THREE from 'three';
import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import { autoDps } from '../sim/actions.ts';
import { formatNum } from '../sim/format.ts';
import { stageLabel } from '../sim/stages.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { button, el, setText } from './dom';
import { pickGuide, portalDps, TUTORIAL_DONE, tutorialFinished, type GuideKind } from './guidePick';
import { icon } from './icons';

const _to = new THREE.Vector3();
/** 바닥 화살표 높이: 사격장 매트(윗면 0.08m)·길보다 위 */
const ARROW_Y = 0.12;
/** 상황 다시 판단 간격(초), 안내가 바뀐 뒤 최소 유지 시간(초): 깜빡이지 않게 */
const CHECK_SEC = 0.5;
const HOLD_SEC = 2.5;
/** 안내 켜기·끄기 (기기 설정) */
const KEY = 'pop-shooter.guide';
/** 위쪽 안내 글 줄 (사용자 2026-11-13: 안 뜨는 게 낫다 → 끔). 바닥 화살표·목표 위 표시만 남김. 다시 켜려면 true */
const SHOW_TEXT = false;

/** 처음 움직이기 전 조작 안내: 이만큼(m) 움직이면 사라짐 */
const MOVE_HINT_DIST = 1.5;
/** 막힌 포털 안내를 다시 띄우기까지(초) */
const GATE_TIP_SEC = 3.5;

const TEXT: Record<GuideKind, StrKey> = { portal: 'g.portal', upgrade: 'g.upgrade', range: 'g.range', treadmill: 'g.treadmill' };

export function guideEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setGuideEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* 이번 세션만 */ }
}

/**
 * 안내 (사용자 2026-11-11): 처음 한 번 훈련장 → 포탈(1-1) → 골드로 강화, 끝나면 안내 없음, 그 뒤로는 환생할 수 있을 때만 환생 제단.
 * 위쪽 한 줄 + 바닥 화살표 + 목표 위 화살표로 가리킴 (판단 guidePick). 목표에 들어가 있으면 숨김.
 * [닫기]는 지금 안내만 닫음(상황이 바뀌면 다시 뜸). 설정에서 아예 끌 수 있음.
 * 소유: 화살표 geometry·material (게임 내내 씀).
 */
export class Tutorial {
  private readonly game: Game;
  private readonly bar: HTMLDivElement;
  private readonly text: HTMLSpanElement;
  private readonly group = new THREE.Group();
  private readonly chevrons: THREE.Mesh[] = [];
  private readonly marker = new THREE.Group();
  private clock = 0;
  private checkT = CHECK_SEC;
  private holdT = 0;
  private kind: GuideKind | null = null;
  /** 닫은 안내 (같은 안내는 상황이 바뀔 때까지 안 띄움) */
  private dismissed: GuideKind | null = null;
  /** 조작 안내 (튜토리얼 중, 이번 방문에 처음 움직이기 전까지, CrazyGames 점검 2026-11-16) */
  private readonly moveHint: HTMLDivElement;
  private moveFrom: { x: number; z: number } | null = null;
  private moveTouch: boolean | null = null;
  /** 튜토리얼 중 막힌 포털에 들어갔을 때 한 줄 (전엔 아무 반응이 없었음) */
  private readonly gateTip: HTMLDivElement;
  private gateT = 0;
  /** 첫 클리어 전 화면 줄이기 (#ui.first-run: 훈련 줄 숨김, 오른쪽 이벤트 버튼 흐리게 — 이동·화살표만 눈에 띄게) */
  private readonly ui: HTMLElement;
  private firstRun: boolean | null = null;
  enabled = guideEnabled();

  constructor(game: Game, ui: HTMLElement) {
    this.game = game;
    this.ui = ui;
    this.bar = el('div', 'tut-bar');
    this.text = el('span', 'tut-text');
    this.bar.append(icon('hand', 'tut-ico'), this.text, button(t('g.close'), () => { this.dismissed = this.kind; this.show(null); }, 'btn small tut-skip'));
    this.bar.hidden = true;
    this.moveHint = el('div', 'move-hint');
    this.moveHint.hidden = true;
    this.gateTip = el('div', 'gate-tip');
    this.gateTip.hidden = true;
    ui.append(this.bar, this.moveHint, this.gateTip);
    // 바닥 화살표: 납작한 삼각형 셋 (캐릭터 앞에서 목표 쪽으로 흐름)
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.35);
    tri.lineTo(0.32, -0.15);
    tri.lineTo(0.12, -0.15);
    tri.lineTo(0, 0.05);
    tri.lineTo(-0.12, -0.15);
    tri.lineTo(-0.32, -0.15);
    tri.closePath();
    // 카메라가 멀어서 크게 (폭 약 1.4m)
    const triGeo = new THREE.ShapeGeometry(tri).rotateX(-Math.PI / 2).scale(2.2, 1, 2.2);
    const triMat = new THREE.MeshBasicMaterial({ color: '#ff8a5b', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(triGeo, triMat);
      m.position.y = ARROW_Y;
      m.renderOrder = 3;
      this.chevrons.push(m);
      this.group.add(m);
    }
    // 목표 위 화살표: 아래를 가리키는 원뿔 + 막대
    const cone = new THREE.ConeGeometry(0.45, 0.7, 20).rotateX(Math.PI);
    const stick = new THREE.CylinderGeometry(0.16, 0.16, 0.6, 12);
    const markMat = new THREE.MeshStandardMaterial({ color: '#ffd34d', emissive: '#ffb000', emissiveIntensity: 0.4 });
    const c = new THREE.Mesh(cone, markMat);
    const s = new THREE.Mesh(stick, markMat);
    s.position.y = 0.6;
    this.marker.add(c, s);
    this.group.add(this.marker);
    this.group.visible = false;
    game.hub.root.add(this.group);
    game.onTick((dt) => this.update(dt));
    // 첫 튜토리얼 동안은 안내하는 시설에만 들어감 (화살표를 따라가다 길에 있는 동전 분수·총 상점에 끌려 들어가던 것,
    // 총을 사면 튜토리얼이 끝나 업그레이드 안내를 건너뛰던 것 — 2026-11-13 점검). 안내를 끄면 제한 없음
    game.facilityGate = (f) => {
      const s = game.state;
      if (!this.enabled || tutorialFinished(s)) return true;
      const pick = pickGuide(s);
      if (pick === f.id) return true;
      if (f.id === 'portal') this.showGateTip(pick);
      return false;
    };
  }

  /** 막힌 포털: 무엇을 하면 열리는지 (서 있는 동안 GATE_TIP_SEC마다 한 번만 새로 띄움) */
  private showGateTip(pick: GuideKind | null): void {
    if (this.gateT > 0) { this.gateT = GATE_TIP_SEC; return; }
    this.gateT = GATE_TIP_SEC;
    const s = this.game.state;
    const fac = WORLD1_FACILITIES.find((x) => x.id === pick);
    // 첫 클리어 전엔 사격장에서 DPS만 채우면 열림
    const text = pick === 'range'
      ? t('g.portalLocked', { n: formatNum(portalDps()), m: formatNum(Math.floor(autoDps(s))) })
      : t('g.portalFirst', { f: fac?.label ?? '' });
    setText(this.gateTip, text);
    this.gateTip.hidden = false;
    this.gateTip.classList.remove('pop');
    void this.gateTip.offsetWidth;
    this.gateTip.classList.add('pop');
  }

  /** 조작 안내: 튜토리얼 중 광장에서, 처음 MOVE_HINT_DIST만큼 움직일 때까지 */
  private updateMoveHint(): void {
    const g = this.game;
    if (!this.moveFrom) {
      if (!this.enabled || tutorialFinished(g.state) || g.mode !== 'hub') { this.moveHint.hidden = true; return; }
      this.moveFrom = { x: g.pos.x, z: g.pos.z };
    }
    if (this.moveFrom.x === Infinity) return;
    if (Math.hypot(g.pos.x - this.moveFrom.x, g.pos.z - this.moveFrom.z) > MOVE_HINT_DIST || g.mode !== 'hub') {
      this.moveFrom = { x: Infinity, z: Infinity };
      this.moveHint.hidden = true;
      return;
    }
    const touch = g.controls.touchMode;
    if (touch !== this.moveTouch) {
      this.moveTouch = touch;
      setText(this.moveHint, t(touch ? 'hint.moveTouch' : 'hint.moveKeys'));
      this.moveHint.classList.toggle('touch', touch);
    }
    this.moveHint.hidden = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    setGuideEnabled(on);
    if (!on) this.show(null);
  }

  private show(kind: GuideKind | null): void {
    const changed = kind !== this.kind;
    this.kind = kind;
    this.bar.hidden = !SHOW_TEXT || !kind;
    this.group.visible = !!kind;
    if (!kind) return;
    setText(this.text, t(TEXT[kind], { s: stageLabel(this.game.state.bestStage + 1) }));
    if (!changed) return;
    this.holdT = HOLD_SEC;
    this.bar.classList.remove('pop');
    void this.bar.offsetWidth;
    this.bar.classList.add('pop');
  }

  private update(dt: number): void {
    const g = this.game;
    this.clock += dt;
    this.holdT -= dt;
    this.updateMoveHint();
    const first = this.enabled && g.state.bestStage < 1 && !tutorialFinished(g.state);
    if (first !== this.firstRun) { this.firstRun = first; this.ui.classList.toggle('first-run', first); }
    if (this.gateT > 0) {
      this.gateT -= dt;
      if (this.gateT <= 0 || g.mode !== 'hub') { this.gateT = 0; this.gateTip.hidden = true; }
    }
    if (!this.enabled || g.mode === 'battle') {
      this.bar.hidden = true;
      return;
    }
    this.checkT += dt;
    if (this.checkT >= CHECK_SEC) {
      this.checkT = 0;
      // 튜토리얼 끝을 저장해 둠 (다시 켜도 처음 안내가 안 나오게)
      if (g.state.tutorial < TUTORIAL_DONE && tutorialFinished(g.state)) g.setState({ ...g.state, tutorial: TUTORIAL_DONE }, true);
      const next = pickGuide(g.state);
      if (next !== this.dismissed) this.dismissed = null;
      const want = next === this.dismissed ? null : next;
      // 바뀐 지 얼마 안 됐으면 유지 (단, 할 일이 없어진 경우는 바로 내림)
      if (want !== this.kind && (this.holdT <= 0 || want === null)) this.show(want);
      else if (this.kind) this.bar.hidden = !SHOW_TEXT;
    }
    const kind = this.kind;
    if (!kind) return;
    const f = WORLD1_FACILITIES.find((x) => x.id === kind)!;
    // 목표에 들어와 있으면 화살표·안내 숨김
    const there = g.near?.id === f.id;
    this.bar.hidden = !SHOW_TEXT || there;
    this.group.visible = !there;
    if (there) return;
    this.marker.position.set(f.x, 3.2 + Math.abs(Math.sin(this.clock * 3)) * 0.5, f.z);
    this.marker.rotation.y += dt * 2;
    _to.set(f.x - g.pos.x, 0, f.z - g.pos.z);
    const d = _to.length();
    _to.normalize();
    const yaw = Math.atan2(_to.x, _to.z);
    this.chevrons.forEach((c, i) => {
      const k = ((this.clock * 1.2 + i / 3) % 1);
      const dist = Math.min(d - 0.8, 1.4 + k * 3.6);
      c.visible = dist > 0.5;
      c.position.set(g.pos.x + _to.x * dist, ARROW_Y, g.pos.z + _to.z * dist);
      // 모양 끝이 -z를 가리키므로 반 바퀴 더
      c.rotation.y = yaw + Math.PI;
      c.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2);
    });
  }
}
