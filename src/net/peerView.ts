// 남의 플레이어 표시 규칙 (순수 계산, three.js·i18n 없음 → node 테스트).
import { PORTAL_SPOT } from '../world/facilities.ts';

/** 계정 문자열 → 0..1 (같은 계정은 늘 같은 값). 화면에 계정을 내지 않고 자리만 정함 */
export function accountUnit(account: string): number {
  let h = 2166136261;
  for (let i = 0; i < account.length; i++) {
    h ^= account.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * 전투 중인 사람이 서 있는 자리: 포털 구역(PORTAL_SPOT) 앞 반원, 계정마다 고정된 자리.
 * 겹쳐도 됨(사용자 2026-11-11) — 여러 명이면 대개 흩어져 보이게만. 포털 쪽(북, -z)을 바라봄
 */
export function battleSpot(account: string, out: { x: number; z: number; yaw: number }): void {
  const u = accountUnit(account);
  const a = (u - 0.5) * Math.PI * 0.9;
  const r = 1.2 + ((u * 7) % 1) * 0.8;
  out.x = PORTAL_SPOT.x + Math.sin(a) * r;
  out.z = PORTAL_SPOT.z + Math.cos(a) * r;
  out.yaw = Math.PI;
}
