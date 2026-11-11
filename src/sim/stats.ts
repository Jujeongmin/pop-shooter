import { BALANCE } from './balance.ts';

export type StatKind = 'atk' | 'spd';

export function atkValue(lv: number): number {
  return (1 + lv) * 2 ** Math.floor(lv / BALANCE.atk.doubleEvery);
}

export function atkCost(lv: number): number {
  return BALANCE.atk.baseCost * BALANCE.atk.costGrowth ** lv;
}

export function spdMaxLevel(): number {
  return Math.round((BALANCE.spd.cap - 1) / BALANCE.spd.step);
}

export function spdValue(lv: number): number {
  return Math.min(BALANCE.spd.cap, 1 + BALANCE.spd.step * lv);
}

export function spdCost(lv: number): number {
  if (lv >= spdMaxLevel()) return Infinity;
  return BALANCE.spd.baseCost * BALANCE.spd.costGrowth ** lv;
}

function curve(kind: StatKind): { base: number; g: number; maxLv: number } {
  return kind === 'atk'
    ? { base: BALANCE.atk.baseCost, g: BALANCE.atk.costGrowth, maxLv: Infinity }
    : { base: BALANCE.spd.baseCost, g: BALANCE.spd.costGrowth, maxLv: spdMaxLevel() };
}

/** lv에서 n레벨 올리는 비용 합 (등비수열). 최대 레벨을 넘으면 Infinity */
export function bulkCost(kind: StatKind, lv: number, n: number): number {
  if (n <= 0) return 0;
  const { base, g, maxLv } = curve(kind);
  if (lv + n > maxLv) return Infinity;
  return (base * g ** lv * (g ** n - 1)) / (g - 1);
}

/** 코인으로 살 수 있는 최대 레벨 수와 그 비용. 비용은 늘 유한 */
export function maxAffordable(kind: StatKind, lv: number, coins: number): { n: number; cost: number } {
  const { base, g, maxLv } = curve(kind);
  const first = base * g ** lv;
  if (!Number.isFinite(coins) || coins <= 0 || !Number.isFinite(first) || first > coins || lv >= maxLv) return { n: 0, cost: 0 };
  let n = Math.floor(Math.log(1 + (coins * (g - 1)) / first) / Math.log(g));
  n = Math.max(0, Math.min(n, maxLv - lv));
  while (n > 0 && !(bulkCost(kind, lv, n) <= coins)) n--;
  while (lv + n + 1 <= maxLv && bulkCost(kind, lv, n + 1) <= coins) n++;
  return { n, cost: bulkCost(kind, lv, n) };
}

export function rebirthMult(tokens: number): number {
  return 1 + BALANCE.rebirth.multPerToken * tokens;
}
