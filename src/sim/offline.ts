import { goldMult } from './actions.ts';
import { BALANCE } from './balance.ts';
import { replayCoins, stageTime } from './stages.ts';
import type { GameState } from './state.ts';

/**
 * 자리 비운 동안 보상 (서버 시각 기준, 부스트 없음): 골드만 (사용자 2026-11-12: 꺼 둔 동안 공격력은 안 오름 → 훈련은 켜 두고 기구 위에서만).
 * 골드 = 기록 스테이지 반복 도전을 goldRate 효율로 한 것 (반복 보상 × 코인 훈련 ÷ 스테이지 시간). 시계가 뒤로 가면 0, capSec에서 자름.
 */
export function offlineReward(s: GameState, now: number, capSec: number = BALANCE.offline.capSec): { coins: number; seconds: number } {
  const raw = (now - s.lastSeen) / 1000;
  const seconds = Number.isFinite(raw) ? Math.max(0, Math.min(capSec, raw)) : 0;
  if (seconds <= 0) return { coins: 0, seconds: 0 };
  const coins = s.bestStage >= 1
    ? (replayCoins(s.bestStage) * goldMult({ ...s, boostUntil: 0 }, 0) / stageTime(s.bestStage)) * BALANCE.offline.goldRate * seconds
    : 0;
  return { coins, seconds };
}
