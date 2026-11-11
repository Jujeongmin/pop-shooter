/** 떠다니는 조이스틱 (터치): 이동 칸 안에서 누른 곳에 뜸. 모바일에선 안 쓸 때 쉬는 자리에 흐리게 보임. 가운데 DEAD_PX 안은 0 (짧은 탭이 걸음으로 새지 않게) */
const DEAD_PX = 10;

export class Joystick {
  readonly el: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private id: number | null = null;
  private ox = 0;
  private oy = 0;
  private readonly radius = 56;
  x = 0;
  y = 0;
  /** 누른 뒤 가장 멀리 끈 거리(px): 거의 안 끌었으면 탭으로 침 */
  maxDrag = 0;
  private restAt: { x: number; y: number } | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'joy';
    this.knob = document.createElement('div');
    this.knob.className = 'joy-knob';
    this.el.appendChild(this.knob);
    parent.appendChild(this.el);
  }

  get active(): boolean {
    return this.id !== null;
  }

  owns(pointerId: number): boolean {
    return this.id === pointerId;
  }

  begin(e: PointerEvent): void {
    this.id = e.pointerId;
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.x = this.y = 0;
    this.maxDrag = 0;
    this.el.style.left = `${this.ox}px`;
    this.el.style.top = `${this.oy}px`;
    this.el.classList.add('on');
    this.el.classList.remove('rest');
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  move(e: PointerEvent): void {
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    this.maxDrag = Math.max(this.maxDrag, d);
    if (d > this.radius) { dx *= this.radius / d; dy *= this.radius / d; }
    // 데드존 밖만 0..1로 다시 펼침
    const k = d <= DEAD_PX ? 0 : (Math.min(d, this.radius) - DEAD_PX) / (this.radius - DEAD_PX) / Math.min(d, this.radius);
    this.x = dx * k;
    this.y = dy * k;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  end(): void {
    this.id = null;
    this.x = this.y = 0;
    this.el.classList.remove('on');
    this.showRest();
  }

  /** 쉬는 자리 (모바일 이동 칸 안내) */
  rest(x: number, y: number): void {
    this.restAt = { x, y };
    if (!this.active) this.showRest();
  }

  hideRest(): void {
    this.restAt = null;
    this.el.classList.remove('rest');
  }

  private showRest(): void {
    if (!this.restAt) return;
    this.el.style.left = `${this.restAt.x}px`;
    this.el.style.top = `${this.restAt.y}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.el.classList.add('rest');
  }
}
