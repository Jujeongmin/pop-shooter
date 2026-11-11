import * as THREE from 'three';
import type { Game } from '../core/Game';
import { t } from '../i18n/i18n';
import { WORLD1_FACILITIES, type FacilityId } from '../world/facilities';
import { button, el, setText } from './dom';
import { icon } from './icons';

/** 튜토리얼 단계 (state.tutorial): 0 사격장 가기 → 1 코인 모으기 → 2 업그레이드 사기 → 3 포털 도전 → 99 끝 */
const DONE = 99;
const COIN_GOAL = 100;
const STEPS: readonly { target: FacilityId | null; text: () => string }[] = [
  { target: 'range', text: () => t('tut.range') },
  { target: null, text: () => t('tut.coins', { n: COIN_GOAL }) },
  { target: 'upgrade', text: () => t('tut.upgrade') },
  { target: 'portal', text: () => t('tut.portal') },
];

const _to = new THREE.Vector3();
/** 바닥 화살표 높이: 사격장 매트(윗면 0.08m)·길보다 위 */
const ARROW_Y = 0.12;

/**
 * 처음 3분 안내: 위쪽 한 줄 안내 + 바닥 화살표(캐릭터 → 목표 방향) + 목표 위 통통 튀는 화살표, [건너뛰기].
 * 단계는 저장(state.tutorial)에 남아서 새로고침해도 이어짐. 끝나면 3D 오브젝트 해제.
 * 소유: 화살표 geometry·material → finish()에서 dispose.
 */
export class Tutorial {
  private readonly game: Game;
  private readonly bar: HTMLDivElement;
  private readonly text: HTMLSpanElement;
  private readonly group = new THREE.Group();
  private readonly chevrons: THREE.Mesh[] = [];
  private readonly marker = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private clock = 0;
  private startAtk: number;

  constructor(game: Game, ui: HTMLElement) {
    this.game = game;
    this.startAtk = game.state.atkLv;
    this.bar = el('div', 'tut-bar');
    this.text = el('span', 'tut-text');
    this.bar.append(icon('hand', 'tut-ico'), this.text, button(t('tut.skip'), () => this.finish(), 'btn small tut-skip'));
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
    const triMat = new THREE.MeshBasicMaterial({ color: '#ff8a5b', transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.owned.push(triGeo, triMat);
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
    this.owned.push(cone, stick, markMat);
    const c = new THREE.Mesh(cone, markMat);
    const s = new THREE.Mesh(stick, markMat);
    s.position.y = 0.6;
    this.marker.add(c, s);
    this.group.add(this.marker);
    game.hub.root.add(this.group);
    game.onTick((dt) => this.update(dt));
    this.refresh();
  }

  private get step(): number {
    return this.game.state.tutorial;
  }

  private setStep(n: number): void {
    this.game.setState({ ...this.game.state, tutorial: n }, true);
    if (n === 2) this.startAtk = this.game.state.atkLv;
    this.refresh();
  }

  private refresh(): void {
    const st = STEPS[this.step];
    const on = !!st;
    this.bar.hidden = !on;
    this.group.visible = on;
    if (!on) return;
    setText(this.text, st.text());
    this.bar.classList.remove('pop');
    void this.bar.offsetWidth;
    this.bar.classList.add('pop');
  }

  private finish(): void {
    if (this.step !== DONE) this.game.setState({ ...this.game.state, tutorial: DONE }, true);
    this.bar.remove();
    this.group.removeFromParent();
    for (const o of this.owned) o.dispose();
    this.owned.length = 0;
  }

  private update(dt: number): void {
    const g = this.game;
    const step = this.step;
    if (step >= DONE || !this.owned.length) return;
    // 단계 넘기기
    if (step === 0 && g.near?.id === 'range') this.setStep(1);
    else if (step === 1 && g.state.coins >= COIN_GOAL) this.setStep(2);
    else if (step === 2 && g.state.atkLv > this.startAtk) this.setStep(3);
    else if (step === 3 && (g.mode === 'battle' || g.state.bestStage >= 1)) { this.finish(); return; }
    // 전투 중엔 숨김 (광장이 숨겨지면 화살표도 같이 숨음, 안내 줄만)
    this.bar.hidden = g.mode === 'battle';
    const st = STEPS[this.step];
    if (!st) return;
    this.clock += dt;
    const f = st.target ? WORLD1_FACILITIES.find((x) => x.id === st.target) : null;
    // 목표에 들어와 있으면 화살표 숨김
    const there = !f || g.near?.id === f.id;
    for (const c of this.chevrons) c.visible = !there;
    this.marker.visible = !!f;
    if (!f) return;
    this.marker.position.set(f.x, 3.2 + Math.abs(Math.sin(this.clock * 3)) * 0.5, f.z);
    this.marker.rotation.y += dt * 2;
    if (there) return;
    _to.set(f.x - g.pos.x, 0, f.z - g.pos.z);
    const d = _to.length();
    _to.normalize();
    const yaw = Math.atan2(_to.x, _to.z);
    this.chevrons.forEach((c, i) => {
      // 0.8m 간격으로 앞으로 흐름
      const k = ((this.clock * 1.2 + i / 3) % 1);
      const dist = Math.min(d - 0.8, 1.4 + k * 3.6);
      c.position.set(g.pos.x + _to.x * dist, ARROW_Y, g.pos.z + _to.z * dist);
      // 모양 끝이 -z를 가리키므로 반 바퀴 더
      c.rotation.y = yaw + Math.PI;
      (c.material as THREE.MeshBasicMaterial).opacity = 0.9;
      c.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.2);
    });
  }
}
