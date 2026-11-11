import * as THREE from 'three';
import { audio } from '../audio/audio';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { t, type StrKey } from '../i18n/i18n';
import { formatNum } from '../sim/format.ts';
import { bulkCost, maxAffordable, spdMaxLevel, type StatKind } from '../sim/stats.ts';
import { buyAtk, buySpd, damagePerShot, shotsPerSec } from '../sim/actions.ts';
import type { GameState } from '../sim/state.ts';
import { BALANCE } from '../sim/balance.ts';
import { stageLabel } from '../sim/stages.ts';
import {
  buyGear, buyMachine, GEAR, gearUnlocked, gainPerShot, hasGear, machineAffordable, machineCost, machineLv, MENTORS, TRAIN_KINDS, trainCap, type TrainKind,
} from '../sim/training.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { button, el, setText } from './dom';
import type { FloatText } from './FloatText';
import { icon, type IconName } from './icons';
import { bump, Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

type Unit = 1 | 10 | 'max';
type Tab = 'stats' | 'mach' | 'gear' | 'mentor';
const TABS: readonly Tab[] = ['stats', 'mach', 'gear', 'mentor'];
const UNIT_KEY = 'pop-shooter.buyUnit';
const TAB_KEY = 'pop-shooter.upTab';
const MACH_ICON: Record<TrainKind, IconName> = { atk: 'target', spd: 'rapid', coin: 'cointarget' };
export const GEAR_ICON: Record<TrainKind, IconName> = { atk: 'gloves', spd: 'goggles', coin: 'piggy' };
const _at = new THREE.Vector3();

interface Row {
  kind: StatKind;
  root: HTMLDivElement;
  lv: HTMLSpanElement;
  val: HTMLDivElement;
  btn: HTMLButtonElement;
  cost: HTMLSpanElement;
  n: HTMLSpanElement;
}
interface MachRow { kind: TrainKind; root: HTMLDivElement; lv: HTMLSpanElement; val: HTMLDivElement; btn: HTMLButtonElement; cost: HTMLSpanElement; n: HTMLSpanElement }
interface GearRow { i: number; root: HTMLDivElement; btn: HTMLButtonElement; cost: HTMLSpanElement; n: HTMLSpanElement }
interface MentorRow { i: number; root: HTMLDivElement; status: HTMLDivElement }

/** 훈련 % 보기 좋게 (작은 값은 소수까지) */
export function pct(v: number): string {
  if (v >= 100) return formatNum(Math.round(v));
  if (v >= 10) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(v >= 1 ? 2 : 3).replace(/\.?0+$/, '');
}

/** 이번에 살 개수와 비용 (못 사면 n = 0) */
export function plan(kind: StatKind, s: GameState, unit: Unit): { n: number; cost: number; maxed: boolean } {
  const lv = kind === 'atk' ? s.atkLv : s.spdLv;
  const maxed = kind === 'spd' && lv >= spdMaxLevel();
  if (maxed) return { n: 0, cost: Infinity, maxed };
  if (unit === 'max') {
    const m = maxAffordable(kind, lv, s.coins);
    // 하나도 못 사면 1개 가격을 보여 줌
    return m.n > 0 ? { ...m, maxed } : { n: 0, cost: bulkCost(kind, lv, 1), maxed };
  }
  const n = kind === 'spd' ? Math.min(unit, spdMaxLevel() - lv) : unit;
  const cost = bulkCost(kind, lv, n);
  return { n: cost <= s.coins ? n : 0, cost, maxed };
}

/** 이번에 올릴 기계 레벨 수와 비용 */
export function planMachine(k: TrainKind, s: GameState, unit: Unit): { n: number; cost: number } {
  const lv = machineLv(s, k);
  if (unit === 'max') {
    const m = machineAffordable(k, lv, s.coins);
    return m.n > 0 ? m : { n: 0, cost: machineCost(k, lv, 1) };
  }
  const cost = machineCost(k, lv, unit);
  return { n: cost <= s.coins ? unit : 0, cost };
}

/**
 * 업그레이드 기계: 구역에 들어가면 폴짝 + 아래 창, 나가면 닫힘. 탭 4개 (포키 +1 MMA Fighter 방식):
 * 능력치(공격력·초당 발사 레벨) / 훈련 기계(한 발 훈련량·한도) / 장비(종류별 ×1.45, 한 번 구매) / 멘토(스테이지 기록으로 영입, 보기만).
 * 구매 단위 [×1 | ×10 | 최대]와 고른 탭은 기기에 기억. 비용·개수는 sim 함수 그대로.
 */
export class UpgradePanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly float: FloatText;
  private readonly zone: ZoneEntry;
  private readonly rows: Row[];
  private readonly segBtns = new Map<Unit, HTMLButtonElement>();
  private unit: Unit;
  private tab: Tab;
  private readonly tabBtns = new Map<Tab, HTMLButtonElement>();
  private readonly sections = new Map<Tab, HTMLDivElement>();
  private readonly seg: HTMLDivElement;
  private readonly machRows: MachRow[] = [];
  private readonly gearRows: GearRow[] = [];
  private readonly mentorRows: MentorRow[] = [];

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
    this.panel.body.append(tabs, seg, ...this.sections.values());
    seg.hidden = this.tab === 'gear' || this.tab === 'mentor';
    this.rows = [this.row('atk', 'bullet', t('stat.atk'), t('up.atkDesc')), this.row('spd', 'timer', t('stat.sps'), t('up.spsDesc'))];
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
    this.zone.onLanded = () => { this.refresh(); this.panel.open(); };
    game.facilityActions.upgrade = () => this.zone.enter();
    game.facilityLeave.upgrade = () => { this.zone.leave(); this.panel.close(); };
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

  private row(kind: StatKind, ic: IconName, name: string, desc: string): Row {
    const root = el('div', 'up-row');
    const mid = el('div', 'up-mid');
    const title = el('div', 'up-name');
    const lv = el('span', 'up-lv');
    title.append(el('span', '', name), lv);
    const val = el('div', 'up-val');
    val.title = desc;
    mid.append(title, val);
    const b = this.buyBtn(() => this.buy(kind));
    root.append(icon(ic), mid, b.btn);
    this.sections.get('stats')!.append(root);
    return { kind, root, lv, val, ...b };
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
    root.append(icon('medal', `m${i}`), mid, status);
    this.sections.get('mentor')!.append(root);
    return { i, root, status };
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
      return v && TABS.includes(v) ? v : 'stats';
    } catch { return 'stats'; }
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

  private buy(kind: StatKind): void {
    const g = this.game;
    const p = plan(kind, g.state, this.unit);
    if (p.n <= 0) return;
    const next = kind === 'atk' ? buyAtk(g.state, p.n) : buySpd(g.state, p.n);
    if (!next) return;
    g.setState(next, true);
    this.celebrate(this.rows.find((x) => x.kind === kind)!.root, p.n > 1 ? `${t('up.levelUp')} +${p.n}` : t('up.levelUp'));
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
    else if (this.tab === 'mentor') this.refreshMentor(s);
    else this.refreshStats(s);
  }

  private refreshMach(s: GameState): void {
    for (const r of this.machRows) {
      const lv = machineLv(s, r.kind);
      const p = planMachine(r.kind, s, this.unit);
      const show = p.n > 0 ? p.n : this.unit === 'max' ? 1 : this.unit;
      const after: GameState = r.kind === 'atk' ? { ...s, mAtk: lv + show } : r.kind === 'spd' ? { ...s, mSpd: lv + show } : { ...s, mCoin: lv + show };
      setText(r.lv, t('up.lv', { n: lv }));
      r.val.replaceChildren(
        el('span', '', t('mach.desc', { s: t(`tr.${r.kind}`), g: pct(gainPerShot(s, r.kind)), c: pct(trainCap(s, r.kind)) })),
        el('br'),
        el('b', '', `→ +${pct(gainPerShot(after, r.kind))}% · ${pct(trainCap(after, r.kind))}%`),
      );
      setText(r.cost, formatNum(p.cost));
      setText(r.n, `+${show}`);
      r.btn.disabled = p.n <= 0;
    }
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
      setText(r.cost, formatNum(g.price));
      r.btn.disabled = !(g.price <= s.coins);
    }
  }

  private refreshMentor(s: GameState): void {
    for (const r of this.mentorRows) {
      const m = MENTORS[r.i]!;
      const joined = s.bestStage >= m.needStage;
      r.root.classList.toggle('locked', !joined);
      r.status.replaceChildren(joined ? icon('check') : el('span', '', t('mentor.need', { st: stageLabel(m.needStage) })));
    }
  }

  private refreshStats(s: GameState): void {
    for (const r of this.rows) {
      const lv = r.kind === 'atk' ? s.atkLv : s.spdLv;
      const p = plan(r.kind, s, this.unit);
      setText(r.lv, t('up.lv', { n: lv }));
      const show = p.n > 0 ? p.n : this.unit === 'max' ? 1 : this.unit;
      // HUD와 같은 값(총·환생·훈련 배율 포함)으로 보여 줌
      const now = r.kind === 'atk' ? damagePerShot(s) : shotsPerSec(s);
      const after = r.kind === 'atk' ? damagePerShot({ ...s, atkLv: lv + show }) : shotsPerSec({ ...s, spdLv: Math.min(spdMaxLevel(), lv + show) });
      const fmt = (v: number): string => (r.kind === 'atk' ? formatNum(v) : v.toFixed(2).replace(/\.?0+$/, ''));
      if (p.maxed) {
        r.val.replaceChildren(el('span', '', fmt(now)));
        setText(r.cost, t('up.maxed'));
        setText(r.n, '');
        r.btn.disabled = true;
        continue;
      }
      r.val.replaceChildren(el('span', '', `${fmt(now)} → `), el('b', '', fmt(after)));
      setText(r.cost, formatNum(p.cost));
      setText(r.n, `+${show}`);
      r.btn.disabled = p.n <= 0;
    }
  }
}

