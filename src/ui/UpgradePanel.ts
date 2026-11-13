import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { t, type StrKey } from '../i18n/i18n';
import { formatNum } from '../sim/format.ts';
import type { GameState } from '../sim/state.ts';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import {
  buyGear, buyMachine, GEAR, gearPrice, gearUnlocked, gainPerShot, hasGear, machineAffordable, machineCost, machineLv, MENTORS, TRAIN_KINDS, type TrainKind,
} from '../sim/training.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { MENTOR_CHAR } from '../world/MentorNpcs';
import { bakeCharIcons } from './charIcons';
import { button, el, setText } from './dom';
import type { FloatText } from './FloatText';
import { icon, type IconName } from './icons';
import { pickGuide } from './guidePick';
import { Spotlight } from './Spotlight';
import { bump, Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

type Unit = 1 | 10 | 'max';
type Tab = 'mach' | 'gear' | 'mentor';
const TABS: readonly Tab[] = ['mach', 'gear', 'mentor'];
const UNIT_KEY = 'pop-shooter.buyUnit';
const TAB_KEY = 'pop-shooter.upTab';
const MACH_ICON: Record<TrainKind, IconName> = { atk: 'target', spd: 'rapid', coin: 'coin' };
export const GEAR_ICON: Record<TrainKind, IconName> = { atk: 'gloves', spd: 'goggles', coin: 'piggy' };
const _at = new THREE.Vector3();

interface MachRow { kind: TrainKind; root: HTMLDivElement; lv: HTMLSpanElement; val: HTMLDivElement; btn: HTMLButtonElement; cost: HTMLSpanElement; n: HTMLSpanElement }
interface GearRow { i: number; root: HTMLDivElement; btn: HTMLButtonElement; cost: HTMLSpanElement; n: HTMLSpanElement }
interface MentorRow { i: number; root: HTMLDivElement; status: HTMLDivElement; face: HTMLImageElement }

/** 훈련 % 보기 좋게 (작은 값은 소수까지) */
export function pct(v: number): string {
  if (v >= 100) return formatNum(Math.round(v));
  if (v >= 10) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(v >= 1 ? 2 : 3).replace(/\.?0+$/, '');
}

/** 이번에 올릴 기계 레벨 수와 비용 */
export function planMachine(k: TrainKind, s: GameState, unit: Unit): { n: number; cost: number } {
  const lv = machineLv(s, k);
  if (unit === 'max') {
    const m = machineAffordable(lv, s.coins);
    return m.n > 0 ? m : { n: 0, cost: machineCost(lv, 1) };
  }
  const cost = machineCost(lv, unit);
  return { n: cost <= s.coins ? unit : 0, cost };
}

/**
 * 업그레이드: 구역에 들어가면 폴짝 + 아래 창, 나가면 닫힘. 탭 3개 (2026-11-11 성장 개편, 골드로 사는 건 배율만):
 * 훈련 기구(한 발 훈련량 ×machineStep, 레벨) / 장비(종류별 ×gearMult, 한 번 구매) / 멘토(스테이지 기록으로 영입, 보기만).
 * 구매 단위 [×1 | ×10 | 최대]와 고른 탭은 기기에 기억. 비용·개수는 sim 함수 그대로.
 */
export class UpgradePanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly float: FloatText;
  private readonly zone: ZoneEntry;
  private readonly segBtns = new Map<Unit, HTMLButtonElement>();
  private unit: Unit;
  private tab: Tab;
  private readonly tabBtns = new Map<Tab, HTMLButtonElement>();
  private readonly sections = new Map<Tab, HTMLDivElement>();
  private readonly seg: HTMLDivElement;
  private readonly machRows: MachRow[] = [];
  private readonly gearRows: GearRow[] = [];
  private readonly mentorRows: MentorRow[] = [];
  /** 튜토리얼 강조 (첫 클리어 뒤 '업그레이드' 안내 동안: 살 수 있는 기구 구매 버튼만 밝게·눌리게 + 손가락) */
  private readonly spot = new Spotlight();

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout, float: FloatText) {
    this.game = game;
    this.float = float;
    this.unit = this.loadUnit();
    this.tab = this.loadTab();
    this.panel = new Panel(ui, t('up.title'));
    const tabs = el('div', 'tabs');
    for (const tb of TABS) {
      const b = el('button', tb === this.tab ? 'on' : '', t(`up.tab.${tb}`));
      b.type = 'button';
      b.addEventListener('pointerup', (e) => { e.preventDefault(); this.setTab(tb); });
      this.tabBtns.set(tb, b);
      tabs.append(b);
      const sec = el('div', 'up-sec');
      sec.hidden = tb !== this.tab;
      this.sections.set(tb, sec);
    }
    const seg = el('div', 'seg');
    this.seg = seg;
    for (const u of [1, 10, 'max'] as const) {
      const b = el('button', u === this.unit ? 'on' : '', u === 'max' ? t('up.max') : `×${u}`);
      b.type = 'button';
      b.addEventListener('pointerup', (e) => { e.preventDefault(); this.setUnit(u); });
      this.segBtns.set(u, b);
      seg.append(b);
    }
    // 탭·수량 선택은 스크롤해도 위에 붙어 있음 (사용자 2026-11-13)
    const head = el('div', 'sheet-sticky');
    head.append(tabs, seg);
    this.panel.body.append(head, ...this.sections.values());
    seg.hidden = this.tab === 'gear' || this.tab === 'mentor';
    this.sections.get('mach')!.append(el('div', 'up-hint', t('tr.hint')));
    for (const k of TRAIN_KINDS) this.machRows.push(this.machRow(k));
    GEAR.forEach((_, i) => this.gearRows.push(this.gearRow(i)));
    MENTORS.forEach((_, i) => this.mentorRows.push(this.mentorRow(i)));
    const f = WORLD1_FACILITIES.find((x) => x.id === 'upgrade')!;
    this.zone = new ZoneEntry(game, callout, f, {
      color: '#ff8a5b',
      flash: 'rgba(255, 138, 91, 0.8)',
      face: { x: f.x, z: f.z - 2 },
      text: null,
      spot: { x: f.x, z: f.z + 1.1 },
      cam: { focus: -0.4, lookUp: -1.4 },
    });
    this.zone.onLanded = () => {
      // 튜토리얼 '업그레이드' 안내로 왔으면 훈련 기구 탭 (마지막에 본 장비 탭이 열려 뭘 할지 몰랐음, 사용자 2026-11-13)
      if (pickGuide(this.game.state) === 'upgrade' && this.tab !== 'mach') this.setTab('mach');
      this.panel.open();
      this.refresh();
    };
    game.facilityActions.upgrade = () => this.zone.enter();
    game.facilityLeave.upgrade = () => { this.zone.leave(); this.panel.close(); this.spot.hide(); };
    game.onTick((dt) => this.zone.update(dt));
    game.onStateChange(() => { if (this.panel.isOpen) this.refresh(); });
  }

  private buyBtn(onPress: () => void): { btn: HTMLButtonElement; cost: HTMLSpanElement; n: HTMLSpanElement } {
    const cost = el('span', '');
    const n = el('span', 'n');
    const btn = button('', onPress, 'btn buy');
    const c = el('span', 'cost');
    c.append(icon('coin'), cost);
    btn.replaceChildren(c, n);
    return { btn, cost, n };
  }

  private machRow(kind: TrainKind): MachRow {
    const root = el('div', 'up-row');
    const mid = el('div', 'up-mid');
    const title = el('div', 'up-name');
    const lv = el('span', 'up-lv');
    title.append(el('span', '', t(`mach.${kind}`)), lv);
    const val = el('div', 'up-val');
    mid.append(title, val);
    const b = this.buyBtn(() => this.buyMach(kind));
    root.append(icon(MACH_ICON[kind]), mid, b.btn);
    this.sections.get('mach')!.append(root);
    return { kind, root, lv, val, ...b };
  }

  private gearRow(i: number): GearRow {
    const g = GEAR[i]!;
    const root = el('div', 'up-row');
    const mid = el('div', 'up-mid');
    mid.append(el('div', 'up-name', t(`gear.${g.id}` as StrKey)), el('div', 'up-val', t('gear.desc', { s: t(`tr.${g.kind}`), m: BALANCE.train.gearMult })));
    const b = this.buyBtn(() => this.buyGearAt(i));
    const ic = icon(GEAR_ICON[g.kind], `tier${g.tier}`);
    root.append(ic, mid, b.btn);
    this.sections.get('gear')!.append(root);
    return { i, root, ...b };
  }

  private mentorRow(i: number): MentorRow {
    const m = MENTORS[i]!;
    const root = el('div', 'up-row mentor');
    const mid = el('div', 'up-mid');
    mid.append(el('div', 'up-name', t(`mentor.${m.id}` as StrKey)), el('div', 'up-val', t('mentor.desc', { m: BALANCE.train.mentorMult })));
    const status = el('div', 'mentor-st');
    // 멘토 = 팝배틀 캐릭터 (광장 NPC와 같은 얼굴)
    // 그림은 멘토 탭을 처음 열 때 (시작 때 오프스크린 렌더러를 만들지 않게)
    const face = el('img', 'mentor-face');
    face.alt = '';
    root.append(face, mid, status);
    this.sections.get('mentor')!.append(root);
    return { i, root, status, face };
  }

  private loadUnit(): Unit {
    try {
      const v = localStorage.getItem(UNIT_KEY);
      return v === '10' ? 10 : v === 'max' ? 'max' : 1;
    } catch { return 1; }
  }

  private loadTab(): Tab {
    try {
      const v = localStorage.getItem(TAB_KEY) as Tab | null;
      return v && TABS.includes(v) ? v : 'mach';
    } catch { return 'mach'; }
  }

  private setUnit(u: Unit): void {
    this.unit = u;
    try { localStorage.setItem(UNIT_KEY, String(u)); } catch { /* 기억 못 해도 이번엔 적용 */ }
    for (const [k, b] of this.segBtns) b.classList.toggle('on', k === u);
    this.refresh();
  }

  private setTab(tb: Tab): void {
    this.tab = tb;
    try { localStorage.setItem(TAB_KEY, tb); } catch { /* 기억 못 해도 이번엔 적용 */ }
    for (const [k, b] of this.tabBtns) b.classList.toggle('on', k === tb);
    for (const [k, sec] of this.sections) sec.hidden = k !== tb;
    this.seg.hidden = tb === 'gear' || tb === 'mentor';
    if (tb !== 'mach') this.spot.hide();
    this.refresh();
  }

  private celebrate(root: HTMLElement, text: string): void {
    audio.play('upgrade');
    bump(root);
    this.game.avatar.getMuzzle(_at);
    _at.y += 0.6;
    this.float.show(text, _at, 'coin big');
    this.refresh();
  }

  private buyMach(k: TrainKind): void {
    const g = this.game;
    const p = planMachine(k, g.state, this.unit);
    if (p.n <= 0) return;
    const next = buyMachine(g.state, k, p.n);
    if (!next) return;
    g.setState(next, true);
    this.celebrate(this.machRows.find((r) => r.kind === k)!.root, p.n > 1 ? `${t('up.levelUp')} +${p.n}` : t('up.levelUp'));
  }

  private buyGearAt(i: number): void {
    const g = this.game;
    const next = buyGear(g.state, i);
    if (!next) return;
    g.setState(next, true);
    this.celebrate(this.gearRows[i]!.root, t('gear.owned'));
  }

  private refresh(): void {
    const s = this.game.state;
    if (this.tab === 'mach') this.refreshMach(s);
    else if (this.tab === 'gear') this.refreshGear(s);
    else this.refreshMentor(s);
  }

  private refreshMach(s: GameState): void {
    for (const r of this.machRows) {
      const lv = machineLv(s, r.kind);
      const p = planMachine(r.kind, s, this.unit);
      const show = p.n > 0 ? p.n : this.unit === 'max' ? 1 : this.unit;
      const after: GameState = r.kind === 'atk' ? { ...s, mAtk: lv + show } : r.kind === 'spd' ? { ...s, mSpd: lv + show } : { ...s, mCoin: lv + show };
      const w = this.game.world;
      const unit = r.kind === 'atk' ? '' : '%';
      const gv = (x: GameState): string => (r.kind === 'atk' ? formatNum(gainPerShot(x, r.kind, w)) : pct(gainPerShot(x, r.kind, w)));
      setText(r.lv, t('up.lv', { n: lv }));
      r.val.replaceChildren(
        el('span', '', t(`mach.desc.${r.kind}` as StrKey, { s: t(`tr.${r.kind}`), g: `${gv(s)}${unit}` })),
        el('br'),
        el('b', '', `→ +${gv(after)}${unit}`),
      );
      setText(r.cost, formatNum(p.cost));
      setText(r.n, `+${show}`);
      r.btn.disabled = p.n <= 0;
    }
    this.placePoint(s);
  }

  /** 튜토리얼 강조: 살 수 있는 기구 중 공격(사격장 과녁) 먼저. 창이 닫히거나 안내가 끝나면(뭐든 사면) 치움 */
  private placePoint(s: GameState): void {
    const row = this.machRows.find((r) => !r.btn.disabled);
    if (pickGuide(s) !== 'upgrade' || this.tab !== 'mach' || !this.panel.isOpen || !row) { this.spot.hide(); return; }
    this.spot.show(row.btn);
  }

  private refreshGear(s: GameState): void {
    for (const r of this.gearRows) {
      const g = GEAR[r.i]!;
      const owned = hasGear(s, r.i);
      const open = gearUnlocked(s, r.i);
      r.root.classList.toggle('owned', owned);
      r.root.classList.toggle('locked', !open);
      setText(r.n, '');
      if (owned) { setText(r.cost, t('gear.owned')); r.btn.disabled = true; continue; }
      if (!open) { setText(r.cost, t('gear.need', { st: stageLabel(g.needStage) })); r.btn.disabled = true; continue; }
      setText(r.cost, formatNum(gearPrice(r.i)));
      r.btn.disabled = !(gearPrice(r.i) <= s.coins);
    }
  }

  private refreshMentor(s: GameState): void {
    for (const r of this.mentorRows) {
      const m = MENTORS[r.i]!;
      const joined = s.bestStage >= m.needStage;
      if (!r.face.src) r.face.src = bakeCharIcons()[MENTOR_CHAR[m.id] ?? 'yellow'];
      r.root.classList.toggle('locked', !joined);
      r.status.replaceChildren(joined ? icon('check') : el('span', '', t('mentor.need', { st: stageLabel(m.needStage) })));
    }
  }

}

