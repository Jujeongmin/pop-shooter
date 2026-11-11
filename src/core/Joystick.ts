/** 떠다니는 조이스틱 (마우스·터치): 화면 왼쪽 영역에서 누른 곳에 뜸 */
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
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  move(e: PointerEvent): void {
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const d = Math.hypot(dx, dy);
    this.maxDrag = Math.max(this.maxDrag, d);
    if (d > this.radius) { dx *= this.radius / d; dy *= this.radius / d; }
    this.x = dx / this.radius;
    this.y = dy / this.radius;
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  end(): void {
    this.id = null;
    this.x = this.y = 0;
    this.el.classList.remove('on');
  }
}
