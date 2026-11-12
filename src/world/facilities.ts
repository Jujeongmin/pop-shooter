import { t } from '../i18n/i18n.ts';

export type FacilityId = 'range' | 'treadmill' | 'fountain' | 'upgrade' | 'guns' | 'altar' | 'portal' | 'chars';

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
/**
 * 사격장 = 공격 훈련만 (사용자 2026-11-12): 넓은 발판 하나, 과녁 3개를 번갈아 쏨. 과녁은 hub.targets.
 * 연사 = 러닝머신, 골드 보너스 = 동전 분수 (사격 말고 다른 방식, 아래 TREADMILL·FOUNTAIN).
 */
export const RANGE_LANES = [
  { id: 'range', kind: 'atk', x: RANGE_SPOT.x, color: '#ff6b6b', mat: '#ffc2c2' },
] as const;
export type RangeLane = (typeof RANGE_LANES)[number];
/** 러닝머신(연사): 서는 자리 (벨트 위, 북쪽(−z)을 보고 달림) */
export const TREADMILL = { x: -12.6, z: 6.6 };
/** 동전 분수(골드 보너스): 서는 자리 (기계는 북쪽 1.4m) */
export const FOUNTAIN = { x: -7.6, z: 5.6 };
/** 포털 고리 중심 (구역은 그 앞 PORTAL_SPOT) */
export const PORTAL_GATE = { x: 0, z: -10 };
export const PORTAL_SPOT = { x: 0, z: -6.5 };

export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_SPOT.x, z: RANGE_SPOT.z, radius: 2.4, label: t('fac.range') },
  { id: 'treadmill', x: TREADMILL.x, z: TREADMILL.z, radius: 1.2, label: t('fac.treadmill') },
  { id: 'fountain', x: FOUNTAIN.x, z: FOUNTAIN.z, radius: 1.2, label: t('fac.fountain') },
  { id: 'upgrade', x: 9, z: 4, radius: 2.6, label: t('fac.upgrade') },
  { id: 'guns', x: 4.5, z: -3.5, radius: 2.4, label: t('fac.guns') },
  { id: 'altar', x: -8, z: 11, radius: 2.6, label: t('fac.altar') },
  { id: 'chars', x: 8, z: 11, radius: 2.4, label: t('fac.chars') },
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
