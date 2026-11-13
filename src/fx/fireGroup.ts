/**
 * 한 번에 여러 발 (사용자 2026-11-13: 연사 상한을 풀되, 화면은 초당 FIRE_VIS_MAX번까지만 쏘고 넘는 총알은 같이 나감).
 * 스탯의 초당 발사 수 = 실제 나가는 총알 수 (초당 20발이면 초당 12번 쏘면서 그중 8번은 2발). 그림은 한 번에 최대 MULTI_DRAW_MAX줄기.
 * 순수 계산만 (three 없음): 사격장·전투가 각자 FireGroup 하나로 "이번 프레임에 몇 번, 한 번에 몇 발"을 받음.
 */
export const FIRE_VIS_MAX = 12;
export const MULTI_DRAW_MAX = 3;

export class FireGroup {
  /** 다음 발사까지 쌓인 발사 횟수 (1 넘으면 쏨) */
  private evAcc = 0;
  /** 아직 화면에 안 나간 총알 */
  private bullets = 0;

  reset(): void {
    this.evAcc = 0;
    this.bullets = 0;
  }

  /** 쌓인 총알 더하기 (전투: sim이 이번 프레임에 쏜 수) */
  add(n: number): void {
    this.bullets += n;
  }

  /**
   * 이번 프레임에 쏠 발사들: sps = 초당 총알 수. 반환 = 발사마다 총알 수 목록 (보통 0~1개, 매 프레임 새 배열 대신 out 재사용).
   * fromRate = true면 총알도 sps × dt만큼 여기서 만듦 (사격장), false면 add로 받은 것만 나눔 (전투).
   */
  step(dt: number, sps: number, out: number[], fromRate: boolean): number[] {
    out.length = 0;
    if (!(sps > 0)) return out;
    if (fromRate) this.bullets += sps * dt;
    // 전투에서 초당 12발 이하: sim이 쏜 그 프레임에 바로 한 발씩 (박자를 따로 세면 체력과 화면이 어긋남)
    if (!fromRate && sps <= FIRE_VIS_MAX) {
      while (this.bullets >= 1) { this.bullets -= 1; out.push(1); }
      return out;
    }
    this.evAcc += Math.min(sps, FIRE_VIS_MAX) * dt;
    const per = Math.max(1, sps / FIRE_VIS_MAX);
    // 발사 기회는 실제로 쏠 때만 씀: 예전엔 총알이 아직 없을 때 기회를 버려서, 전투(총알은 sim이 따로 셈)에서
    // 체력은 깎였는데 화면 총알이 다음 기회(최대 1/sps초 뒤)에야 나갔음 (사용자 2026-11-13 '총알은 안 나가는데 체력이 깎임')
    while (this.evAcc >= 1 && this.bullets >= 1) {
      this.evAcc -= 1;
      // 한 번에 per발 올림 (남은 총알보다 많이는 안 씀 → 평균은 정확히 sps)
      const n = Math.min(Math.floor(this.bullets), Math.ceil(per));
      this.bullets -= n;
      out.push(n);
    }
    // 쏠 총알을 기다리는 동안 기회는 하나만 쥠 (몰아서 쏘지 않게) → 총알이 오는 프레임에 바로 나감
    if (this.evAcc > 1) this.evAcc = 1;
    return out;
  }

  /** 남은 총알 전부 (전투에서 보스를 깨는 순간 한 번에) */
  drain(): number {
    const n = Math.floor(this.bullets);
    this.bullets -= n;
    return n;
  }
}
