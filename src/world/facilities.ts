import { t } from '../i18n/i18n.ts';

export type FacilityId = 'range' | 'upgrade' | 'guns' | 'altar' | 'portal';

export interface Facility {
  id: FacilityId;
  x: number;
  z: number;
  /** 이 거리 안에 들어가면 바로 동작 */
  radius: number;
  label: string;
}

/** 광장 32×32m, 울타리·집·나무로 둘러막힘. 남쪽 스폰 바로 앞(북쪽)에 월드 포털 (들어가면 그 월드 1번부터 연속 도전) */
export const HUB_BOUNDS = { hx: 15.5, hz: 15.5 };
export const HUB_SPAWN = { x: 0, z: 6 };
export const RANGE_SPOT = { x: -9, z: 1 };
export const RANGE_TARGET = { x: -9, z: -7 };
/** 포털 고리 중심 (구역은 그 앞 PORTAL_SPOT) */
export const PORTAL_GATE = { x: 0, z: -10 };
export const PORTAL_SPOT = { x: 0, z: -6.5 };

export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_SPOT.x, z: RANGE_SPOT.z, radius: 2.6, label: t('fac.range') },
  { id: 'upgrade', x: 9, z: 4, radius: 2.6, label: t('fac.upgrade') },
  { id: 'guns', x: 4.5, z: -3.5, radius: 2.4, label: t('fac.guns') },
  { id: 'altar', x: 0, z: 11.5, radius: 2.6, label: t('fac.altar') },
  { id: 'portal', x: PORTAL_SPOT.x, z: PORTAL_SPOT.z, radius: 2.4, label: t('fac.portal', { w: 1 }) },
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
