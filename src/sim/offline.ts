import { highestWorld, shotsPerSec, goldMult } from './actions.ts';
import { BALANCE } from './balance.ts';
import { replayCoins, stageTime } from './stages.ts';
import type { GameState } from './state.ts';

/**
 * 자리 비운 동안 보상 (서버 시각 기준, 부스트 없음):
 * - 훈련: 공격 훈련장(가장 높은 열린 월드)에서 offline.rate 속도로 쏜 발 수 → 받을 때 train(state, 'atk', shots, world)
 * - 골드: 기록 스테이지 반복 도전을 goldRate 효율로 한 것 (반복 보상 × 코인 훈련 ÷ 스테이지 시간)
 * 시계가 뒤로 가면 0, capSec에서 자름.
 */
export function offlineReward(s: GameState, now: number, capSec: number = BALANCE.offline.capSec): { coins: number; seconds: number; shots: number; world: number } {
  const raw = (now - s.lastSeen) / 1000;
  const seconds = Number.isFinite(raw) ? Math.max(0, Math.min(capSec, raw)) : 0;
  const world = highestWorld(s);
  if (seconds <= 0) return { coins: 0, seconds: 0, shots: 0, world };
  const shots = shotsPerSec(s) * BALANCE.offline.rate * seconds;
  const coins = s.bestStage >= 1
    ? (replayCoins(s.bestStage) * goldMult({ ...s, boostUntil: 0 }, 0) / stageTime(s.bestStage)) * BALANCE.offline.goldRate * seconds
    : 0;
  return { coins, seconds, shots, world };
}
