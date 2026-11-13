import { autoDps, highestWorld, trainRate } from './actions.ts';
import { BALANCE } from './balance.ts';
import { stageHp, stageTime } from './stages.ts';
import type { GameState } from './state.ts';
import { train } from './training.ts';

/** 훈련 막대 색 (사용자 2026-11-12): 빨강 = 지금 이걸 훈련, 주황 = 다음으로 도움, 초록 = 충분 */
export type Need = 'red' | 'orange' | 'green';

/** 다음 스테이지를 지금 자동 공격력으로 깰 수 있는지 (다 깼으면 true) */
export function nextClearable(s: GameState): boolean {
  const next = s.bestStage + 1;
  if (next > BALANCE.stage.perWorld * BALANCE.stage.worlds) return true;
  return autoDps(s) * stageTime(next) >= stageHp(next);
}

/** 그 훈련장에서 1초 훈련하면 오르는 자동 DPS */
function dpsPerSec(s: GameState, k: 'atk' | 'spd'): number {
  return autoDps(train(s, k, trainRate(s, k), highestWorld(s))) - autoDps(s);
}

/**
 * 공격·연사 훈련 막대 색. 다음 스테이지를 못 깨면: DPS가 더 빨리 오르는 쪽 빨강, 다른 쪽 주황.
 * 깰 수 있으면 둘 다 초록 (포털로 가면 됨).
 */
export function trainNeeds(s: GameState): { atk: Need; spd: Need } {
  if (nextClearable(s)) return { atk: 'green', spd: 'green' };
  const a = dpsPerSec(s, 'atk');
  const p = dpsPerSec(s, 'spd');
  if (p <= 0) return { atk: 'red', spd: 'green' };
  return a >= p ? { atk: 'red', spd: 'orange' } : { atk: 'orange', spd: 'red' };
}
