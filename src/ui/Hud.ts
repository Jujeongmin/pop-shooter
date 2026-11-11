import { autoDps, damagePerShot, shotsPerSec } from '../sim/actions.ts';
import { formatNum } from '../sim/format.ts';
import { rebirthMult } from '../sim/stats.ts';
import type { GameState } from '../sim/state.ts';
import { button, el, setText } from './dom';
import { icon, type IconName } from './icons';

export interface HudActions {
  menu: (which: 'character' | 'settings') => void;
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
    menu.append(button('캐릭터', () => actions.menu('character'), 'btn small'), button('설정', () => actions.menu('settings'), 'btn small'));
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
    this.atk = row('공격력', 'bullet');
    this.sps = row('초당 발사', 'timer');
    this.dps = row('DPS', 'bolt');

    this.root.append(top, stats);
    parent.appendChild(this.root);
  }

  update(s: GameState): void {
    setText(this.coins, formatNum(s.coins));
    setText(this.gems, formatNum(s.gems));
    setText(this.mult, `×${formatNum(rebirthMult(s.tokens) * s.passMult)}`);
    setText(this.atk, formatNum(damagePerShot(s)));
    setText(this.sps, shotsPerSec(s).toFixed(2).replace(/\.?0+$/, ''));
    setText(this.dps, formatNum(autoDps(s)));
  }

  setVisible(on: boolean): void {
    this.root.hidden = !on;
  }
}
