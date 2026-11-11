import { BALANCE } from './balance.ts';
import { STAGE_HP } from './stageTable.ts';

/** 스테이지 번호 = 1..40 정수 (월드 1 = 1~10) */
export function worldOf(s: number): number {
  return Math.floor((s - 1) / BALANCE.stage.perWorld) + 1;
}

export function isBoss(s: number): boolean {
  return s % BALANCE.stage.perWorld === 0;
}

/** 보스 체력 = 시뮬레이터가 맞춘 표 (대장 포함) */
export function stageHp(s: number): number {
  return STAGE_HP[s - 1] ?? Infinity;
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
