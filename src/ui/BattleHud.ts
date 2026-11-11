import { formatNum } from '../sim/format.ts';
import { el, setText } from './dom';
import { icon } from './icons';

/** 전투 화면: 위 = 스테이지·보스 체력바·남은 시간·내 DPS, 아래 = 탭 유도 */
export class BattleHud {
  private readonly root: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly time: HTMLSpanElement;
  private readonly dps: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly timeChip: HTMLSpanElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'bhud');
    const top = el('div', 'bhud-top');
    this.stage = el('div', 'bhud-stage', '1-1');
    const bar = el('div', 'bhud-bar');
    this.fill = el('div', 'bhud-fill');
    this.hpText = el('div', 'bhud-hp', '');
    bar.append(this.fill, this.hpText);
    const row = el('div', 'bhud-row');
    this.time = el('span', 'bhud-val', '');
    this.dps = el('span', 'bhud-val', '');
    const t = el('span', 'bhud-chip bhud-time');
    t.append(icon('timer'), this.time);
    const d = el('span', 'bhud-chip');
    d.append(icon('bolt'), this.dps);
    row.append(t, d);
    this.timeChip = t;
    top.append(this.stage, bar, row);
    this.hint = el('div', 'bhud-hint');
    this.hint.append(icon('hand', 'bhud-hand'), el('span', '', '화면을 탭하면 더 쏴요!'));
    this.root.append(top, this.hint);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  /** 스테이지 바뀔 때 (대장이면 빨간 표시) */
  setStage(label: string, boss: boolean): void {
    setText(this.stage, boss ? `${label} 대장` : label);
    this.stage.classList.toggle('boss', boss);
    this.stage.classList.remove('pop');
    void this.stage.offsetWidth;
    this.stage.classList.add('pop');
  }

  update(hp: number, maxHp: number, timeLeft: number, dps: number): void {
    const r = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    this.fill.style.transform = `scaleX(${r})`;
    setText(this.hpText, `${formatNum(Math.ceil(hp))} / ${formatNum(maxHp)}`);
    setText(this.time, `${timeLeft.toFixed(1)}초`);
    this.timeChip.classList.toggle('low', timeLeft <= 5);
    setText(this.dps, formatNum(dps));
  }
}
