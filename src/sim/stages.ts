import { BALANCE } from './balance.ts';

/** 스테이지 번호 = 1..40 정수 (월드 1 = 1~10) */
export function worldOf(s: number): number {
  return Math.floor((s - 1) / BALANCE.stage.perWorld) + 1;
}

export function isBoss(s: number): boolean {
  return s % BALANCE.stage.perWorld === 0;
}

export function stageHp(s: number): number {
  const st = BALANCE.stage;
  return st.baseHp * st.hpGrowth ** (s - 1) * (isBoss(s) ? st.bossMult : 1);
}

export function stageTime(s: number): number {
  return isBoss(s) ? BALANCE.stage.timeBoss : BALANCE.stage.timeNormal;
}

export function firstClearCoins(s: number): number {
  return stageHp(s) * BALANCE.stage.firstClearCoinMult;
}

export function replayCoins(s: number): number {
  return stageHp(s) * BALANCE.stage.replayCoinMult;
}

export function stageLabel(s: number): string {
  return `${worldOf(s)}-${((s - 1) % BALANCE.stage.perWorld) + 1}`;
}
