/** 최근 1초 창에 maxPerSec개까지만 탭 인정 (연타·여러 손가락 제한) */
export class TapLimiter {
  private readonly times: number[] = [];
  private readonly maxPerSec: number;

  constructor(maxPerSec: number) {
    this.maxPerSec = maxPerSec;
  }

  accept(tSec: number): boolean {
    const t = this.times;
    while (t.length > 0 && t[0]! <= tSec - 1) t.shift();
    if (t.length >= this.maxPerSec) return false;
    t.push(tSec);
    return true;
  }
}
