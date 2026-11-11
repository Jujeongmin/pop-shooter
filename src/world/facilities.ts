import { t } from '../i18n/i18n.ts';

export type FacilityId = 'range' | 'rangeSpd' | 'rangeCoin' | 'upgrade' | 'guns' | 'altar' | 'portal' | 'chars';

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
 * 훈련장 세 줄 (사용자 2026-11-11, +1 MMA Fighter 방식): 그 줄 발판에서 쏘면 그 능력치만 훈련.
 * 왼쪽 = 공격 과녁(빨강), 가운데 = 연사 움직이는 표적(파랑), 오른쪽 = 코인 과녁(금색). 과녁은 hub.targets 같은 순서.
 */
export const RANGE_LANES = [
  { id: 'range', kind: 'atk', x: RANGE_SPOT.x - 2, color: '#ff6b6b', mat: '#ffb3b3' },
  { id: 'rangeSpd', kind: 'spd', x: RANGE_SPOT.x, color: '#4f9dff', mat: '#a8d4ff' },
  { id: 'rangeCoin', kind: 'coin', x: RANGE_SPOT.x + 2, color: '#ffc928', mat: '#ffe48a' },
] as const;
export type RangeLane = (typeof RANGE_LANES)[number];
/** 포털 고리 중심 (구역은 그 앞 PORTAL_SPOT) */
export const PORTAL_GATE = { x: 0, z: -10 };
export const PORTAL_SPOT = { x: 0, z: -6.5 };

export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_LANES[0].x, z: RANGE_SPOT.z, radius: 0.95, label: t('fac.rangeAtk') },
  { id: 'rangeSpd', x: RANGE_LANES[1].x, z: RANGE_SPOT.z, radius: 0.95, label: t('fac.rangeSpd') },
  { id: 'rangeCoin', x: RANGE_LANES[2].x, z: RANGE_SPOT.z, radius: 0.95, label: t('fac.rangeCoin') },
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
