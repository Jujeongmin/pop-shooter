export type FacilityId = 'range' | 'upgrade' | 'guns' | 'altar' | `gate${number}`;

export interface Facility {
  id: FacilityId;
  x: number;
  z: number;
  /** 이 거리 안이면 사용 버튼 */
  radius: number;
  label: string;
}

/** 스테이지 문 번호 (월드 안 1~10) */
export function gateIndex(id: FacilityId): number | null {
  return id.startsWith('gate') ? Number(id.slice(4)) : null;
}

/** 광장 60×60m. 가운데 시계탑, 남쪽 스폰, 북쪽 길 따라 스테이지 문 10개 */
export const HUB_BOUNDS = { hx: 30, hz: 30 };
export const HUB_SPAWN = { x: 0, z: 8 };
export const RANGE_SPOT = { x: -15, z: 2 };
export const RANGE_TARGET = { x: -15, z: -8 };

export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_SPOT.x, z: RANGE_SPOT.z, radius: 3, label: '사격장' },
  { id: 'upgrade', x: 12, z: 4, radius: 3, label: '업그레이드' },
  { id: 'guns', x: 16, z: -6, radius: 3, label: '총 상점' },
  { id: 'altar', x: 0, z: 20, radius: 3.2, label: '환생 제단' },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `gate${i + 1}` as FacilityId,
    x: -22.5 + i * 5,
    z: -22,
    radius: 2.6,
    label: `1-${i + 1}`,
  })),
];

export function nearestFacility(x: number, z: number, list: readonly Facility[]): Facility | null {
  let best: Facility | null = null;
  let bestD = Infinity;
  for (const f of list) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d <= f.radius && d < bestD) { best = f; bestD = d; }
  }
  return best;
}
