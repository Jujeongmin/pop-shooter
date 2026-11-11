import { t } from '../i18n/i18n';
import { button, el } from './dom';
import { icon } from './icons';

export interface ResultInfo {
  title: string;
  /** 깬 스테이지 라벨들 + 실패한 스테이지 (있으면) */
  cleared: string[];
  failed: string | null;
  coins: string;
  /** 패배 안내 (필요 DPS 등) */
  tip: string | null;
  unlocked: string[];
  mentors?: string[];
}

/** 연속 도전 결과: 깬 개수 + 코인. 이어하기 없음, 버튼은 [광장으로] 하나 */
export class ResultCard {
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'result-wrap ui-on');
    this.card = el('div', 'result-card');
    this.root.appendChild(this.card);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(r: ResultInfo, onClose: () => void): void {
    this.onClose = onClose;
    this.card.replaceChildren();
    this.card.append(el('div', 'result-title', r.title));
    const chips = el('div', 'result-chips');
    const chip = (label: string, ok: boolean): HTMLSpanElement => {
      const c = el('span', `chip ${ok ? 'ok' : 'fail'}`);
      c.append(icon(ok ? 'check' : 'cross'), el('span', '', label));
      return c;
    };
    for (const c of r.cleared) chips.append(chip(c, true));
    if (r.failed) chips.append(chip(r.failed, false));
    this.card.append(chips);
    const coin = el('div', 'result-coins');
    coin.append(icon('coin', 'big'), el('span', '', `+${r.coins}`));
    this.card.append(coin);
    for (const u of r.unlocked) this.card.append(el('div', 'result-unlock', t('result.unlock', { c: u })));
    for (const m of r.mentors ?? []) this.card.append(el('div', 'result-unlock', t('mentor.new', { n: m })));
    if (r.tip) this.card.append(el('div', 'result-tip', r.tip));
    this.card.append(button(t('result.toHub'), () => this.close(), 'btn big'));
    this.root.hidden = false;
    this.root.classList.remove('in');
    void this.root.offsetWidth;
    this.root.classList.add('in');
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }
}
