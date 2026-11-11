import { el } from './dom';
import { icon } from './icons';

/**
 * 시설 창 공통: 화면 아래에서 올라오는 시트 (캐릭터는 위에 보이게). 제목 + 닫기(X) + 내용.
 * 구역에 들어가면 열고, 나가면 닫음.
 */
export class Panel {
  readonly body: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private closeTimer = 0;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement, title: string, cls = '') {
    this.root = el('div', `sheet ui-on ${cls}`);
    const head = el('div', 'sheet-head');
    head.append(el('div', 'sheet-title', title));
    const x = el('button', 'sheet-x ui-on');
    x.type = 'button';
    x.append(icon('close'));
    x.addEventListener('pointerup', (e) => { e.preventDefault(); this.close(); });
    head.append(x);
    this.body = el('div', 'sheet-body');
    this.root.append(head, this.body);
    this.root.hidden = true;
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden && !this.root.classList.contains('out');
  }

  open(): void {
    // PC 마우스 잠금 중이면 풀어서 창 버튼을 누를 수 있게
    if (document.pointerLockElement) document.exitPointerLock?.();
    clearTimeout(this.closeTimer);
    this.root.hidden = false;
    this.root.classList.remove('out', 'in');
    void this.root.offsetWidth;
    this.root.classList.add('in');
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.classList.remove('in');
    this.root.classList.add('out');
    this.closeTimer = window.setTimeout(() => { this.root.hidden = true; }, 200);
    this.onClose?.();
  }
}

/** 버튼을 통 튀게 (구매 성공 등) */
export function bump(e: HTMLElement): void {
  e.classList.remove('bump');
  void e.offsetWidth;
  e.classList.add('bump');
}
