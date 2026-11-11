import { BALANCE } from './balance.ts';

/** 스테이지 번호 = 1..40 정수 (월드 1 = 1~10) */
export function worldOf(s: number): number {
  return Math.floor((s - 1) / BALANCE.stage.perWorld) + 1;
}

export function isBoss(s: number): boolean {
  return s % BALANCE.stage.perWorld === 0;
}

/** 보스 체력 = 1-1 체력 × hpGrowth^(번호−1) × 월드 배수 (대장 ×bossMult). 숫자는 시뮬레이터로 맞춤 */
export function stageHp(s: number): number {
  if (!(s >= 1)) return 0;
  const st = BALANCE.stage;
  return st.firstHp * st.hpGrowth ** (s - 1) * (BALANCE.worldHpMult[worldOf(s) - 1] ?? 1) * (isBoss(s) ? st.bossMult : 1);
}

export function stageTime(s: number): number {
  return isBoss(s) ? BALANCE.stage.timeBoss : BALANCE.stage.timeNormal;
}

export function firstClearCoins(s: number): number {
  const st = BALANCE.stage;
  return st.goldBase * st.goldGrowth ** (s - 1) * (isBoss(s) ? st.bossGold : 1);
}

export function replayCoins(s: number): number {
  return firstClearCoins(s) * BALANCE.stage.replayMult;
}

export function stageLabel(s: number): string {
  return `${worldOf(s)}-${((s - 1) % BALANCE.stage.perWorld) + 1}`;
}
