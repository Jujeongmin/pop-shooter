import { BALANCE } from './balance.ts';
import { STAGE_HP } from './stageTable.ts';

/** 스테이지 번호 = 1..40 정수 (월드 1 = 1~10) */
export function worldOf(s: number): number {
  return Math.floor((s - 1) / BALANCE.stage.perWorld) + 1;
}

export function isBoss(s: number): boolean {
  return s % BALANCE.stage.perWorld === 0;
}

/**
 * 보스 체력: 1-1 = firstHp(첫 승리용)에서 스테이지마다 ×firstRamp로 늘다가, 시뮬레이터 표(STAGE_HP)에 닿으면 표를 따름
 * (사용자 2026-11-11: 1-1만 쉽고 1-2부터 갑자기 표 값이면 벽처럼 느껴짐). 둘 다 늘어나므로 작은 쪽도 늘 늘어남.
 */
export function stageHp(s: number): number {
  const table = (STAGE_HP[s - 1] ?? Infinity) * (BALANCE.worldHpMult[worldOf(s) - 1] ?? 1);
  return Math.min(table, BALANCE.stage.firstHp * BALANCE.stage.firstRamp ** (s - 1));
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
