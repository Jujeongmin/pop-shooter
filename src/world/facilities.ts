export type FacilityId = 'range' | 'upgrade' | 'guns' | 'altar' | 'portal';

export interface Facility {
  id: FacilityId;
  x: number;
  z: number;
  /** 이 거리 안에 들어가면 바로 동작 */
  radius: number;
  label: string;
}

/** 광장 60×60m. 가운데 시계탑, 남쪽 스폰, 북쪽 끝에 월드 포털 하나 (들어가면 그 월드 1번부터 연속 도전) */
export const HUB_BOUNDS = { hx: 30, hz: 30 };
export const HUB_SPAWN = { x: 0, z: 8 };
export const RANGE_SPOT = { x: -15, z: 2 };
export const RANGE_TARGET = { x: -15, z: -8 };
/** 포털 고리 중심 (구역은 그 앞 PORTAL_SPOT) */
export const PORTAL_GATE = { x: 0, z: -24 };
export const PORTAL_SPOT = { x: 0, z: -20.5 };

export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_SPOT.x, z: RANGE_SPOT.z, radius: 3, label: '사격장' },
  { id: 'upgrade', x: 12, z: 4, radius: 3, label: '업그레이드' },
  { id: 'guns', x: 16, z: -6, radius: 3, label: '총 상점' },
  { id: 'altar', x: 0, z: 20, radius: 3.2, label: '환생 제단' },
  { id: 'portal', x: PORTAL_SPOT.x, z: PORTAL_SPOT.z, radius: 2.4, label: '월드 1 포털' },
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
