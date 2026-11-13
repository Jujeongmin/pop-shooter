import { el } from './dom';
import { icon } from './icons';

/**
 * 튜토리얼 강조 (사용자 2026-11-13): 화면 전체를 어둡게 하고 버튼 하나만 밝게 + 손가락이 그 버튼을 톡톡.
 * 그 버튼 말고는 눌리지 않음: 구멍 둘레 네 칸이 입력을 막고, 구멍 자리는 비어 있어 아래 버튼이 그대로 눌림.
 * 버튼이 움직여도(창 열림 애니메이션·화면 회전) 매 프레임 따라감. 보일 때만 RAF.
 */
export class Spotlight {
  private readonly root: HTMLDivElement;
  private readonly hole: HTMLDivElement;
  private readonly blocks: HTMLDivElement[];
  private readonly hand: HTMLSpanElement;
  private target: HTMLElement | null = null;
  private raf = 0;
  private last = '';

  constructor(parent: HTMLElement = document.body) {
    this.root = el('div', 'spot ui-on');
    this.hole = el('div', 'spot-hole');
    this.blocks = [0, 1, 2, 3].map(() => {
      const b = el('div', 'spot-block');
      // 막는 칸: 아래로 아무것도 안 감 (튜토리얼 버튼만 누르게)
      for (const ev of ['pointerdown', 'pointerup', 'click', 'touchstart', 'wheel'] as const) {
        b.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
      }
      return b;
    });
    this.hand = icon('hand', 'spot-hand');
    this.root.append(this.hole, ...this.blocks, this.hand);
    this.root.hidden = true;
    parent.append(this.root);
  }

  show(target: HTMLElement): void {
    if (this.target === target && !this.root.hidden) return;
    this.target = target;
    this.root.hidden = false;
    this.last = '';
    if (!this.raf) this.loop();
  }

  hide(): void {
    this.target = null;
    this.root.hidden = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (): void => {
    this.raf = 0;
    const t = this.target;
    if (!t || !t.isConnected) { this.hide(); return; }
    this.place(t.getBoundingClientRect());
    this.raf = requestAnimationFrame(this.loop);
  };

  private place(r: DOMRect): void {
    const pad = 6;
    const x = Math.round(r.left - pad), y = Math.round(r.top - pad);
    const w = Math.round(r.width + pad * 2), h = Math.round(r.height + pad * 2);
    const key = `${x},${y},${w},${h},${innerWidth},${innerHeight}`;
    if (key === this.last) return;
    this.last = key;
    const W = innerWidth, H = innerHeight;
    Object.assign(this.hole.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    const rects: Array<[number, number, number, number]> = [
      [0, 0, W, Math.max(0, y)],
      [0, y + h, W, Math.max(0, H - y - h)],
      [0, y, Math.max(0, x), h],
      [x + w, y, Math.max(0, W - x - w), h],
    ];
    rects.forEach(([l, tp, bw, bh], i) => Object.assign(this.blocks[i]!.style, { left: `${l}px`, top: `${tp}px`, width: `${bw}px`, height: `${bh}px` }));
    // 손가락 (그림은 아래를 가리킴): 버튼 위에서 손끝이 버튼 윗변을 누르는 모양 (버튼 글자를 가리지 않게, 사용자 2026-11-13)
    Object.assign(this.hand.style, { left: `${x + w * 0.5 - 24}px`, top: `${y - 40}px` });
  }
}
