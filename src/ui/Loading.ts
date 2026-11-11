import { el } from './dom';

/** 로고 글자마다 색 (장난감 블록 색) */
const LOGO_COLORS = ['#ff6b6b', '#ffb347', '#ffd34d', '#4cc56a', '#5aa9ff', '#9b87ff'];

/**
 * 첫 로딩 화면: "POP Shooter" 로고 + 진행 바. 에셋을 다 받으면 위로 걷힘.
 * 3D·글꼴 준비 전이라 DOM·CSS만 씀.
 */
export class Loading {
  private readonly root: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly pct: HTMLDivElement;
  private shown = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'loading');
    const logo = el('div', 'loading-logo');
    const word = (text: string, offset: number): HTMLDivElement => {
      const w = el('div', 'loading-word');
      [...text].forEach((ch, i) => {
        const s = el('span', '', ch);
        s.style.color = LOGO_COLORS[(i + offset) % LOGO_COLORS.length]!;
        s.style.animationDelay = `${(i + offset) * 0.07}s`;
        w.append(s);
      });
      return w;
    };
    logo.append(word('POP', 0), word('Shooter', 3));
    const bar = el('div', 'loading-bar');
    this.fill = el('div', 'loading-fill');
    bar.append(this.fill);
    this.pct = el('div', 'loading-pct', '0%');
    this.root.append(logo, bar, this.pct);
    parent.append(this.root);
  }

  /** 0..1 (뒤로 가지 않음) */
  set(p: number): void {
    this.shown = Math.max(this.shown, Math.min(1, p));
    this.fill.style.transform = `scaleX(${this.shown})`;
    this.pct.textContent = `${Math.round(this.shown * 100)}%`;
  }

  /** 다 됨: 꽉 채우고 위로 걷힌 뒤 제거 */
  done(): void {
    this.set(1);
    this.root.classList.add('out');
    window.setTimeout(() => this.root.remove(), 600);
  }
}
