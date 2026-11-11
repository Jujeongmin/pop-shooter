import * as THREE from 'three';
import type { Game } from '../core/Game';
import { ZoneEntry } from '../core/ZoneEntry';
import { t } from '../i18n/i18n';
import { formatNum } from '../sim/format.ts';
import { bulkCost, maxAffordable, spdMaxLevel, spdValue, type StatKind } from '../sim/stats.ts';
import { buyAtk, buySpd, damagePerShot } from '../sim/actions.ts';
import type { GameState } from '../sim/state.ts';
import { WORLD1_FACILITIES } from '../world/facilities';
import { button, el, setText } from './dom';
import type { FloatText } from './FloatText';
import { icon, type IconName } from './icons';
import { bump, Panel } from './Panel';
import type { ZoneCallout } from './ZoneCallout';

type Unit = 1 | 10 | 'max';
const UNIT_KEY = 'pop-shooter.buyUnit';
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

/**
 * 업그레이드 기계: 구역에 들어가면 폴짝 + 아래 창 (공격력·초당 발사), 나가면 닫힘.
 * 구매 단위 [×1 | ×10 | 최대]는 기기에 기억. 비용·개수는 sim 함수(bulkCost·maxAffordable) 그대로.
 */
export class UpgradePanel {
  private readonly game: Game;
  private readonly panel: Panel;
  private readonly float: FloatText;
  private readonly zone: ZoneEntry;
  private readonly rows: Row[];
  private readonly segBtns = new Map<Unit, HTMLButtonElement>();
  private unit: Unit;

  constructor(game: Game, ui: HTMLElement, callout: ZoneCallout, float: FloatText) {
    this.game = game;
    this.float = float;
    this.unit = this.loadUnit();
    this.panel = new Panel(ui, t('up.title'));
    const seg = el('div', 'seg');
    for (const u of [1, 10, 'max'] as const) {
      const b = el('button', u === this.unit ? 'on' : '', u === 'max' ? t('up.max') : `×${u}`);
      b.type = 'button';
      b.addEventListener('pointerup', (e) => { e.preventDefault(); this.setUnit(u); });
      this.segBtns.set(u, b);
      seg.append(b);
    }
    this.panel.body.append(seg);
    this.rows = [this.row('atk', 'bullet', t('stat.atk'), t('up.atkDesc')), this.row('spd', 'timer', t('stat.sps'), t('up.spsDesc'))];
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

  private row(kind: StatKind, ic: IconName, name: string, desc: string): Row {
    const root = el('div', 'up-row');
    const mid = el('div', 'up-mid');
    const title = el('div', 'up-name');
    const lv = el('span', 'up-lv');
    title.append(el('span', '', name), lv);
    const val = el('div', 'up-val');
    val.title = desc;
    mid.append(title, val);
    const cost = el('span', '');
    const n = el('span', 'n');
    const btn = button('', () => this.buy(kind), 'btn buy');
    const c = el('span', 'cost');
    c.append(icon('coin'), cost);
    btn.replaceChildren(c, n);
    root.append(icon(ic), mid, btn);
    this.panel.body.append(root);
    return { kind, root, lv, val, btn, cost, n };
  }

  private loadUnit(): Unit {
    try {
      const v = localStorage.getItem(UNIT_KEY);
      return v === '10' ? 10 : v === 'max' ? 'max' : 1;
    } catch { return 1; }
  }

  private setUnit(u: Unit): void {
    this.unit = u;
    try { localStorage.setItem(UNIT_KEY, String(u)); } catch { /* 기억 못 해도 이번엔 적용 */ }
    for (const [k, b] of this.segBtns) b.classList.toggle('on', k === u);
    this.refresh();
  }

  private buy(kind: StatKind): void {
    const g = this.game;
    const p = plan(kind, g.state, this.unit);
    if (p.n <= 0) return;
    const next = kind === 'atk' ? buyAtk(g.state, p.n) : buySpd(g.state, p.n);
    if (!next) return;
    g.setState(next, true);
    const r = this.rows.find((x) => x.kind === kind)!;
    bump(r.root);
    g.avatar.getMuzzle(_at);
    _at.y += 0.6;
    this.float.show(p.n > 1 ? `${t('up.levelUp')} +${p.n}` : t('up.levelUp'), _at, 'coin big');
    this.refresh();
  }

  private refresh(): void {
    const s = this.game.state;
    for (const r of this.rows) {
      const lv = r.kind === 'atk' ? s.atkLv : s.spdLv;
      const p = plan(r.kind, s, this.unit);
      setText(r.lv, t('up.lv', { n: lv }));
      const show = p.n > 0 ? p.n : this.unit === 'max' ? 1 : this.unit;
      // 공격력은 HUD와 같은 '한 발 피해'(총·환생 배율 포함)로 보여 줌
      const now = r.kind === 'atk' ? damagePerShot(s) : spdValue(lv);
      const after = r.kind === 'atk' ? damagePerShot({ ...s, atkLv: lv + show }) : spdValue(Math.min(spdMaxLevel(), lv + show));
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
