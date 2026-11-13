import { t } from '../i18n/i18n.ts';

export type FacilityId = 'range' | 'treadmill' | 'fountain' | 'upgrade' | 'guns' | 'portal' | 'chars' | 'travel';

export interface Facility {
  id: FacilityId;
  x: number;
  z: number;
  /** 이 거리 안에 들어가면 바로 동작 */
  radius: number;
  label: string;
}

/**
 * 광장 44×42m (2026-11-12 사용자: 훈련 시설 사이 길이 좁음 → 넓힘), 울타리·소품으로 둘러막힘.
 * 남쪽 스폰 앞(북쪽)에 월드 포털 (들어가면 그 월드 1번부터 연속 도전). 서쪽 = 훈련(사격장·러닝머신·동전 분수), 동쪽 = 상점·멘토.
 */
export const HUB_BOUNDS = { hx: 22, hz: 21 };
export const HUB_SPAWN = { x: 0, z: 8 };
export const RANGE_SPOT = { x: -14, z: 0 };
export const RANGE_TARGET = { x: -14, z: -9 };
/**
 * 사격장 = 공격 훈련만 (사용자 2026-11-12): 넓은 발판 하나, 과녁 3개를 번갈아 쏨. 과녁은 hub.targets.
 * 연사 = 러닝머신, 골드 보너스 = 동전 분수 (사격 말고 다른 방식, 아래 TREADMILL·FOUNTAIN).
 */
export const RANGE_LANES = [
  { id: 'range', kind: 'atk', x: RANGE_SPOT.x, color: '#ff6b6b', mat: '#ffc2c2' },
] as const;
export type RangeLane = (typeof RANGE_LANES)[number];
/** 러닝머신(연사) 세 대 가운데 (북쪽(−z)을 보고 달림). 여러 명이 겹치지 않게 빈 벨트를 고름 */
export const TREADMILL = { x: -18.5, z: 10 };
export const TREADMILL_LANES: readonly number[] = [-1.6, 0, 1.6];
/** 러닝머신 벨트 윗면 높이 (m) */
export const BELT_Y = 0.34;

/** 이 자리가 러닝머신 벨트 위면 벨트 높이, 아니면 0 (다른 사람이 벨트에 묻히지 않게) */
export function standY(x: number, z: number): number {
  if (Math.abs(z - (TREADMILL.z + 0.05)) > 1.25) return 0;
  for (const dx of TREADMILL_LANES) if (Math.abs(x - (TREADMILL.x + dx)) < 0.6) return BELT_Y;
  return 0;
}
/** 동전 분수(골드 보너스): 받는 자리 가운데 (기계는 북쪽 1.5m), 좌우로 세 자리 */
export const FOUNTAIN = { x: -9.5, z: 9 };
export const FOUNTAIN_SPOTS: readonly number[] = [0, -1.1, 1.1];
/** 포털 고리 중심 (구역은 그 앞 PORTAL_SPOT) */
export const PORTAL_GATE = { x: 0, z: -14 };
export const PORTAL_SPOT = { x: 0, z: -10.5 };
/** 월드 이동 정류장 (남서쪽, 예전 환생 제단 자리 — 2026-11-13 북서쪽 구석에서 옮김: 시작 지점에서 가까움). 열린 월드 광장으로 이동 (사용자 2026-11-12: 월드마다 광장 따로) */
export const TRAVEL_SPOT = { x: -11, z: 17 };
/** 총 상점 가판대 기준점 (몸체·진열은 여기서). 들어가는 원은 가판대 앞(+z, 진열대가 보이는 쪽) — 사용자 2026-11-12: 원이 가판대 밑에 깔려 어색함 */
export const GUN_SHOP_AT = { x: 7, z: -5 };

// 환생 제단은 없앰 (사용자 2026-11-13): 환생은 오른쪽 환생 버튼으로만
export const WORLD1_FACILITIES: readonly Facility[] = [
  { id: 'range', x: RANGE_SPOT.x, z: RANGE_SPOT.z, radius: 2.4, label: t('fac.range') },
  { id: 'treadmill', x: TREADMILL.x, z: TREADMILL.z, radius: 2.3, label: t('fac.treadmill') },
  { id: 'fountain', x: FOUNTAIN.x, z: FOUNTAIN.z, radius: 1.8, label: t('fac.fountain') },
  { id: 'upgrade', x: 13, z: 4, radius: 2.6, label: t('fac.upgrade') },
  { id: 'guns', x: 8.8, z: -1.4, radius: 2.2, label: t('fac.guns') },
  { id: 'chars', x: 11, z: 16, radius: 2.4, label: t('fac.chars') },
  { id: 'portal', x: PORTAL_SPOT.x, z: PORTAL_SPOT.z, radius: 2.4, label: t('fac.portal', { w: 1 }) },
  { id: 'travel', x: TRAVEL_SPOT.x, z: TRAVEL_SPOT.z, radius: 2.2, label: t('fac.travel') },
];

/**
 * 시설 몸체 자리·크기 (월드별 꾸미기 HubDecor가 씀, 2026-11-12 실측 = 간판 제외 실제 도형 범위).
 * cap = 위에 지붕류를 씌워도 되는지 (떠서 도는 고리·지구본·동전 꼭대기는 안 씌움).
 */
export interface Footprint { id: string; x: number; z: number; w: number; d: number; h: number; cap: boolean }
export const FOOTPRINTS: readonly Footprint[] = [
  { id: 'upgrade', x: 13, z: 2.4, w: 2.4, d: 1.8, h: 3.0, cap: true },
  { id: 'guns', x: 8.8, z: -4.9, w: 3.6, d: 1.8, h: 3.2, cap: true },
  { id: 'chars', x: 11.3, z: 14, w: 4.0, d: 1.8, h: 2.8, cap: true },
  { id: 'travel', x: -11, z: 15.4, w: 3.6, d: 3.6, h: 2.9, cap: false },
  { id: 'treadmill', x: -18.5, z: 10, w: 4.8, d: 2.8, h: 2.0, cap: false },
  { id: 'fountain', x: -9.5, z: 7.5, w: 2.1, d: 2.1, h: 3.8, cap: false },
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
