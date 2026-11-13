import type { Game } from '../core/Game';
import { t } from '../i18n/i18n';
import type { Premium } from '../platform/Premium';
import { DAILY } from '../sim/premium.ts';
import { audio } from '../audio/audio';
import { button, el } from './dom';
import { icon } from './icons';

/**
 * 출석 창 (사용자 2026-11-12: 가볍게). 7칸 한 줄 + [받기] 하나. 받은 칸은 체크, 오늘 칸은 노란 테두리.
 * 하루 첫 접속 때 다른 창(오프라인 보상·닉네임)이 없으면 한 번 자동으로 뜸, 오른쪽 [선물] 버튼으로도 열림. 지급은 서버(Premium.claimDaily).
 */
export class DailyPanel {
  private readonly game: Game;
  private readonly ui: HTMLElement;
  private readonly prem: Premium;
  private wrap: HTMLDivElement | null = null;
  private autoShown = false;

  /** canAuto = 자동으로 띄워도 되는지 (닉네임을 정한 뒤에만: 첫 접속은 닉네임 창이 먼저) */
  constructor(game: Game, ui: HTMLElement, prem: Premium, canAuto: () => boolean = () => true) {
    this.game = game;
    this.ui = ui;
    this.prem = prem;
    // 하루 첫 접속: 서버 값을 받은 뒤, 닉네임이 정해졌고 가리는 창이 없을 때 한 번
    game.onTick(() => {
      if (this.autoShown || !this.prem.known || !this.prem.daily.ready || !canAuto()) return;
      if (ui.querySelector('.result-wrap:not([hidden])') || ui.querySelector('.sheet:not([hidden])')) return;
      this.autoShown = true;
      window.setTimeout(() => this.open(), 1200);
    });
  }

  get isOpen(): boolean {
    return !!this.wrap?.isConnected;
  }

  open(): void {
    if (this.isOpen) return;
    const wrap = el('div', 'result-wrap ui-on in daily-wrap');
    const card = el('div', 'result-card daily-card');
    const close = el('button', 'sheet-x ui-on daily-x');
    close.type = 'button';
    close.append(icon('close'));
    close.addEventListener('pointerup', (e) => { e.preventDefault(); this.close(); });
    card.append(close, el('div', 'result-title', t('daily.title')), el('div', 'result-tip', t('daily.body')));
    const row = el('div', 'daily-row');
    const today = this.prem.daily.idx;
    const ready = this.prem.daily.ready;
    DAILY.forEach((r, i) => {
      const cell = el('div', `daily-cell${i < today ? ' got' : ''}${ready && i === today ? ' today' : ''}${i === 6 ? ' big' : ''}`);
      cell.append(el('div', 'daily-day', t('daily.day', { n: i + 1 })));
      if ('gems' in r) cell.append(icon('gem'), el('div', 'daily-val', `+${r.gems}`));
      else cell.append(icon('coin'), el('div', 'daily-val', t('daily.boost', { m: r.boostMin })));
      if (i < today) cell.append(el('div', 'daily-check', '✓'));
      row.append(cell);
    });
    card.append(row);
    const go = button(ready ? t('daily.claim') : t('daily.done'), () => void this.claim(go), 'btn big');
    go.disabled = !ready || !this.prem.online;
    card.append(go);
    wrap.append(card);
    wrap.addEventListener('pointerup', (e) => { if (e.target === wrap) this.close(); });
    this.ui.append(wrap);
    this.wrap = wrap;
    this.game.moveLock = Math.max(this.game.moveLock, 0.1);
  }

  private async claim(btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    const idx = await this.prem.claimDaily();
    if (idx === null) { btn.textContent = t('daily.done'); return; }
    audio.play('coin');
    // 받은 칸 표시 후 잠깐 뒤 닫음
    const cell = this.wrap?.querySelectorAll('.daily-cell')[idx];
    cell?.classList.remove('today');
    cell?.classList.add('got', 'pop');
    cell?.append(el('div', 'daily-check', '✓'));
    btn.textContent = t('daily.done');
    window.setTimeout(() => this.close(), 1100);
  }

  close(): void {
    this.wrap?.remove();
    this.wrap = null;
  }
}
