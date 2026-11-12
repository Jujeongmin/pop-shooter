import { t } from '../i18n/i18n';
import { autoDps, damagePerShot, rebirthReq, shotsPerSec } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { formatMult, formatNum } from '../sim/format.ts';
import type { GameState } from '../sim/state.ts';
import { rebirthMult, TRAIN_KINDS, trainValue, type TrainKind } from '../sim/training.ts';
import { button, el, setText } from './dom';
import { icon, type IconName } from './icons';

/** 배율 표기: 1000 미만은 소수 둘째 자리까지, 그 위는 큰 수 표기 */
function multText(m: number): string {
  return m < 1000 ? m.toFixed(2) : formatNum(m);
}

export interface HudActions {
  menu: (which: 'settings' | 'shop') => void;
}

/** 광장 HUD: 위 = 코인·팝젬·환생 배율, 왼쪽 = 능력치. 시설은 들어가면 바로 동작(버튼 없음) */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly coins: HTMLSpanElement;
  private readonly gems: HTMLSpanElement;
  private readonly mult: HTMLSpanElement;
  private readonly atk: HTMLSpanElement;
  private readonly sps: HTMLSpanElement;
  private readonly dps: HTMLSpanElement;
  /** 훈련 (공격·연사·코인): 공격 막대 = 환생까지, 연사 막대 = 최대(초당 12발)까지, 코인 = 숫자만 (한도 없음) */
  private readonly bars = new Map<TrainKind, { fill: HTMLDivElement; v: HTMLSpanElement }>();

  constructor(parent: HTMLElement, actions: HudActions) {
    this.root = el('div', 'hud');
    const top = el('div', 'hud-top');
    const pill = (name: IconName): HTMLSpanElement => {
      const p = el('div', 'pill');
      p.append(icon(name), el('span', 'val', '0'));
      top.appendChild(p);
      return p.querySelector('.val') as HTMLSpanElement;
    };
    this.coins = pill('coin');
    this.gems = pill('gem');
    this.mult = pill('reb');
    const menu = el('div', 'hud-menu');
    // 골드 2배 남은 시간 (켜져 있을 때만)
    this.boostEl = el('div', 'pill boost-pill');
    this.boostEl.append(icon('coin'), el('span', 'val', ''));
    this.boostEl.hidden = true;
    top.appendChild(this.boostEl);
    const shop = button(t('hud.shop'), () => actions.menu('shop'), 'btn small shop-btn');
    shop.prepend(icon('gem'));
    menu.append(shop, button(t('hud.settings'), () => actions.menu('settings'), 'btn small'));
    top.appendChild(menu);

    const stats = el('div', 'hud-stats');
    const row = (label: string, ic: IconName): HTMLSpanElement => {
      const r = el('div', 'stat');
      const v = el('span', 'stat-v', '0');
      const l = el('span', 'stat-l');
      l.append(icon(ic), el('span', '', label));
      r.append(l, v);
      stats.appendChild(r);
      return v;
    };
    this.atk = row(t('stat.atk'), 'bullet');
    this.sps = row(t('stat.sps'), 'timer');
    this.dps = row(t('stat.dps'), 'bolt');
    const tr = el('div', 'hud-train');
    tr.append(el('div', 'tr-head', t('tr.title')));
    for (const k of TRAIN_KINDS) {
      const r = el('div', `tr-row tr-${k}`);
      const bar = el('div', 'tr-bar');
      const fill = el('div', 'tr-fill');
      bar.append(fill);
      const v = el('span', 'tr-v', '+0%');
      r.append(el('span', 'tr-l', t(`tr.${k}`)), bar, v);
      tr.append(r);
      this.bars.set(k, { fill, v });
    }
    stats.append(tr);

    this.root.append(top, stats);
    parent.appendChild(this.root);
  }

  /** 지난 프레임에 그린 상태 (같은 객체면 건너뜀: 상태는 바뀔 때마다 새 객체) */
  private last: GameState | null = null;

  update(s: GameState): void {
    if (s === this.last) return;
    this.last = s;
    setText(this.coins, formatNum(s.coins));
    setText(this.gems, formatNum(s.gems));
    setText(this.mult, `×${formatMult(rebirthMult(s.tokens) * s.passMult)}`);
    setText(this.atk, formatNum(damagePerShot(s)));
    setText(this.sps, shotsPerSec(s).toFixed(2).replace(/\.?0+$/, ''));
    setText(this.dps, formatNum(autoDps(s)));
    for (const [k, b] of this.bars) {
      const v = trainValue(s, k);
      const goal = k === 'atk' ? rebirthReq(s) : k === 'spd' ? BALANCE.train.spdMax : 0;
      b.fill.parentElement!.hidden = goal <= 0;
      if (goal > 0) {
        b.fill.style.transform = `scaleX(${Math.min(1, v / goal)})`;
        b.fill.classList.toggle('full', v >= goal);
      }
      // 연사·골드는 지금 배율로 (처음 '+0%'가 '0% 오름'으로 읽혀서, 사용자 2026-11-12)
      setText(b.v, k === 'atk' ? `+${formatNum(v)}` : `×${multText(1 + Math.min(v, k === 'spd' ? BALANCE.train.spdMax : v) / 100)}`);
    }
  }

  private readonly boostEl: HTMLDivElement;

  /** 골드 2배 남은 시간 (매 프레임 불러도 글자가 바뀔 때만 씀) */
  boost(leftMs: number): void {
    const on = leftMs > 0;
    if (this.boostEl.hidden === on) this.boostEl.hidden = !on;
    if (!on) return;
    const s = Math.ceil(leftMs / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    setText(this.boostEl.lastElementChild as HTMLElement, `×2 ${h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`}`);
  }

  setVisible(on: boolean): void {
    this.root.hidden = !on;
  }
}
