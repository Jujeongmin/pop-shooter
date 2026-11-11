import { coinPerShot, highestWorld, shotsPerSec } from './actions.ts';
import { BALANCE } from './balance.ts';
import type { GameState } from './state.ts';

/**
 * 자리 비운 동안 훈련 보상: 가장 높은 열린 월드 사격장 기준, offline.rate 속도, 부스트 없음.
 * 시계가 뒤로 가면 0, capSec에서 자름. (계획 2에서 서버 시각으로 같은 함수 사용)
 */
export function offlineReward(s: GameState, now: number, capSec: number = BALANCE.offline.capSec): { coins: number; seconds: number } {
  const raw = (now - s.lastSeen) / 1000;
  const seconds = Number.isFinite(raw) ? Math.max(0, Math.min(capSec, raw)) : 0;
  if (seconds <= 0) return { coins: 0, seconds: 0 };
  const perShot = coinPerShot({ ...s, boostUntil: 0 }, highestWorld(s), 0);
  return { coins: perShot * shotsPerSec(s) * BALANCE.offline.rate * seconds, seconds };
}
