import { t } from '../i18n/i18n';
import { autoDps, damagePerShot, shotsPerSec } from '../sim/actions.ts';
import { formatMult, formatNum } from '../sim/format.ts';
import { rebirthMult } from '../sim/stats.ts';
import type { GameState } from '../sim/state.ts';
import { TRAIN_KINDS, trainCap, trainValue, type TrainKind } from '../sim/training.ts';
import { pct } from './UpgradePanel';
import { button, el, setText } from './dom';
import { icon, type IconName } from './icons';

export interface HudActions {
  menu: (which: 'settings') => void;
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
  /** 훈련 막대 (공격·연사·코인): 채움 = 훈련치 / 한도 */
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
    menu.append(button(t('hud.settings'), () => actions.menu('settings'), 'btn small'));
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
      const cap = trainCap(s, k);
      b.fill.style.transform = `scaleX(${cap > 0 ? Math.min(1, v / cap) : 0})`;
      b.fill.classList.toggle('full', v >= cap * 0.999);
      setText(b.v, `+${pct(v)}%`);
    }
  }

  setVisible(on: boolean): void {
    this.root.hidden = !on;
  }
}
