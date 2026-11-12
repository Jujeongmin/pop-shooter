import { t } from '../i18n/i18n';
import { formatNum } from '../sim/format.ts';
import { el, setText } from './dom';
import { icon } from './icons';

/** 전투 화면: 위 = 스테이지·보스 체력바·남은 시간·내 DPS, 아래 = 탭 유도 */
export class BattleHud {
  private readonly root: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly hpText: HTMLDivElement;
  private readonly dps: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly me: HTMLDivElement;
  private readonly meFill: HTMLDivElement;
  private readonly meCells: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.root = el('div', 'bhud');
    const top = el('div', 'bhud-top');
    this.stage = el('div', 'bhud-stage', '1-1');
    const bar = el('div', 'bhud-bar');
    this.fill = el('div', 'bhud-fill');
    this.hpText = el('div', 'bhud-hp', '');
    bar.append(this.fill, this.hpText);
    const row = el('div', 'bhud-row');
    this.dps = el('span', 'bhud-val', '');
    const d = el('span', 'bhud-chip');
    d.append(icon('bolt'), this.dps);
    row.append(d);
    top.append(this.stage, bar, row);
    // 내 체력: 아래쪽, 10칸 (보스 장난감 한 번 맞을 때마다 한 칸)
    this.me = el('div', 'bhud-me');
    const meBar = el('div', 'bhud-mebar');
    this.meFill = el('div', 'bhud-mefill');
    meBar.append(this.meFill);
    for (let i = 1; i < 10; i++) {
      const c = el('div', 'bhud-mecut');
      c.style.left = `${i * 10}%`;
      meBar.append(c);
      this.meCells.push(c);
    }
    this.me.append(icon('heart'), meBar);
    this.root.append(this.me);
    this.hint = el('div', 'bhud-hint');
    this.hint.append(icon('hand', 'bhud-hand'), el('span', '', t('battle.hint')));
    // 탭 안내는 안 보임 (탭으로 더 쏘기 없음, 사용자 2026-11-12)
    this.hint.hidden = true;
    this.root.append(top, this.hint);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(on: boolean): void {
    this.root.hidden = !on;
  }

  /** 스테이지 바뀔 때 (대장이면 빨간 표시) */
  setStage(label: string, boss: boolean): void {
    setText(this.stage, boss ? t('battle.boss', { s: label }) : label);
    this.stage.classList.toggle('boss', boss);
    this.stage.classList.remove('pop');
    void this.stage.offsetWidth;
    this.stage.classList.add('pop');
  }

  /** 내 체력 비율 0..1 (낮으면 빨갛게 깜빡) */
  setMyHp(r: number): void {
    this.meFill.style.transform = `scaleX(${Math.max(0, r)})`;
    this.me.classList.toggle('low', r <= 0.3);
  }

  /** 맞았을 때 체력바 흔들기 */
  hurt(): void {
    this.me.classList.remove('hurt');
    void this.me.offsetWidth;
    this.me.classList.add('hurt');
  }

  update(hp: number, maxHp: number, dps: number): void {
    const r = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
    this.fill.style.transform = `scaleX(${r})`;
    setText(this.hpText, `${formatNum(Math.ceil(hp))} / ${formatNum(maxHp)}`);
    setText(this.dps, formatNum(dps));
  }
}
