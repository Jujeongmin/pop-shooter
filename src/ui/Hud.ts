import { t } from '../i18n/i18n';
import { atkShown, autoDps, damagePerShot, rebirthReq, shotsPerSec } from '../sim/actions.ts';
import { formatMult, formatNum } from '../sim/format.ts';
import type { GameState } from '../sim/state.ts';
import { spdTrainMult, trainSpeedMult, TRAIN_KINDS, trainValue, type TrainKind } from '../sim/training.ts';
import { trainNeeds } from '../sim/trainNeed.ts';
import { FIRE_VIS_MAX } from '../fx/fireGroup';
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
  private readonly bars = new Map<TrainKind, { fill: HTMLDivElement; v: HTMLSpanElement; sign: HTMLSpanElement }>();

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
    // 팝젬 칸 안 [+] = 팝젬 충전 (상점 팝젬 탭). 오른쪽 위 상점 버튼 대신 (사용자 2026-11-13)
    // '+' 글자는 글꼴에서 위로 떠 보여서 CSS 막대 두 개로 그림 (사용자 2026-11-13)
    const plus = el('button', 'pill-plus ui-on');
    plus.setAttribute('aria-label', '+');
    plus.type = 'button';
    plus.addEventListener('pointerup', (e) => { e.preventDefault(); e.stopPropagation(); actions.menu('shop'); });
    this.gems.parentElement!.append(plus);
    this.mult = pill('reb');
    const menu = el('div', 'hud-menu');
    // 골드 2배 남은 시간 (켜져 있을 때만)
    this.boostEl = el('div', 'pill boost-pill');
    this.boostEl.append(icon('coin'), el('span', 'val', ''));
    this.boostEl.hidden = true;
    top.appendChild(this.boostEl);
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
    this.sps = row(t('stat.sps'), 'rapid');
    this.dps = row(t('stat.dps'), 'bolt');
    const tr = el('div', 'hud-train');
    tr.append(el('div', 'tr-head', t('tr.title')));
    for (const k of TRAIN_KINDS) {
      const r = el('div', `tr-row tr-${k}`);
      const bar = el('div', 'tr-bar');
      const fill = el('div', 'tr-fill');
      bar.append(fill);
      // 값 칸: 기호(+ ×)는 왼쪽, 숫자는 오른쪽 끝 (줄마다 칸 폭이 같아 위아래가 맞음, 사용자 2026-11-12)
      const v = el('span', 'tr-v');
      const sign = el('span', 'tr-sign', '+');
      const num = el('span', 'tr-num', '0');
      v.append(sign, num);
      r.append(el('span', 'tr-l', t(`tr.${k}`)), bar, v);
      tr.append(r);
      this.bars.set(k, { fill, v: num, sign });
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
    setText(this.mult, `×${formatMult(trainSpeedMult(s))}`);
    setText(this.atk, formatNum(damagePerShot(s)));
    setText(this.sps, shotsPerSec(s).toFixed(2).replace(/\.?0+$/, ''));
    setText(this.dps, formatNum(autoDps(s)));
    const need = trainNeeds(s);
    for (const [k, b] of this.bars) {
      const v = trainValue(s, k);
      // 지금 필요한 훈련 색 (빨강·주황·초록, 골드 줄은 막대 없음)
      if (k !== 'coin') { b.fill.dataset.need = need[k]; b.v.dataset.need = need[k]; }
      // 막대가 없는 줄도 칸은 남김 (값 칸이 왼쪽으로 밀려 줄이 안 맞던 것)
      b.fill.parentElement!.style.visibility = k === 'coin' ? 'hidden' : '';
      if (k === 'atk') {
        const goal = rebirthReq(s);
        b.fill.style.transform = `scaleX(${Math.min(1, v / goal)})`;
        b.fill.classList.toggle('full', v >= goal);
      } else if (k === 'spd') {
        // 연사는 상한 없음: 막대 = 다음 '한 번에 한 발 더'(초당 12·24·36…발)까지
        const sps = spdTrainMult(s);
        const lo = sps < FIRE_VIS_MAX ? 1 : Math.floor(sps / FIRE_VIS_MAX) * FIRE_VIS_MAX;
        const hi = sps < FIRE_VIS_MAX ? FIRE_VIS_MAX : lo + FIRE_VIS_MAX;
        b.fill.style.transform = `scaleX(${Math.min(1, (sps - lo) / (hi - lo))})`;
        b.fill.classList.remove('full');
      }
      // 연사·골드는 지금 배율로 (처음 '+0%'가 '0% 오름'으로 읽혀서, 사용자 2026-11-12)
      setText(b.sign, k === 'atk' ? '+' : '×');
      // 연사는 실제 초당 발사 배율 (12발 넘으면 로그로 줄어든 값)
      setText(b.v, k === 'atk' ? formatNum(atkShown(v)) : multText(k === 'spd' ? spdTrainMult(s) : 1 + v / 100));
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
