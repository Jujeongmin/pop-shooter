import { el } from './dom';

export interface CalloutText {
  /** 큰 글씨 위 작은 띠 (예: '사격장 훈련 중!') */
  title: string;
  /** 가운데 큰 글씨 (예: '화면을 탭하면 2배 빨라요!') */
  big: string;
  /** 가운데 손 아이콘 (탭 유도) */
  hand?: boolean;
}

/**
 * 구역에 들어가면 가운데에 띠 + 큰 글씨가 통 튀어나옴, 나가면 반대로 사라짐.
 * 노드는 한 번 만들고 재사용 (CSS 애니메이션은 클래스 다시 붙여서 재시작).
 */
export class ZoneCallout {
  private readonly top: HTMLDivElement;
  private readonly center: HTMLDivElement;
  private readonly bigText: HTMLDivElement;
  private readonly hand: HTMLDivElement;
  private hideTimer = 0;

  constructor(parent: HTMLElement) {
    this.top = el('div', 'zone-top', '');
    this.center = el('div', 'zone-center');
    this.bigText = el('div', 'zone-big');
    this.hand = el('div', 'zone-hand', '👆');
    this.center.append(this.top, this.bigText, this.hand);
    this.center.hidden = true;
    parent.append(this.center);
  }

  show(t: CalloutText): void {
    clearTimeout(this.hideTimer);
    this.top.textContent = t.title;
    this.bigText.textContent = t.big;
    this.hand.hidden = !t.hand;
    const n = this.center;
    n.hidden = false;
    n.classList.remove('out', 'in');
    void n.offsetWidth; // 애니메이션 재시작
    n.classList.add('in');
  }

  hide(): void {
    if (this.center.hidden) return;
    this.center.classList.remove('in');
    this.center.classList.add('out');
    this.hideTimer = window.setTimeout(() => { this.center.hidden = true; }, 220);
  }
}
