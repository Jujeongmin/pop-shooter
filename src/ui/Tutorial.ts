import * as THREE from 'three';
import type { Game } from '../core/Game';
import { t, type StrKey } from '../i18n/i18n';
import { stageLabel } from '../sim/stages.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { button, el, setText } from './dom';
import { pickGuide, TUTORIAL_DONE, tutorialFinished, type GuideKind } from './guidePick';
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
  enabled = guideEnabled();

  constructor(game: Game, ui: HTMLElement) {
    this.game = game;
    this.bar = el('div', 'tut-bar');
    this.text = el('span', 'tut-text');
    this.bar.append(icon('hand', 'tut-ico'), this.text, button(t('g.close'), () => { this.dismissed = this.kind; this.show(null); }, 'btn small tut-skip'));
    this.bar.hidden = true;
    ui.append(this.bar);
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
      return pickGuide(s) === f.id;
    };
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
