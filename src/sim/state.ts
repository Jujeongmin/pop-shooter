export type CharId = 'blue' | 'yellow' | 'red' | 'pink' | 'white' | 'black';
export const CHAR_IDS: readonly CharId[] = ['blue', 'yellow', 'red', 'pink', 'white', 'black'];

export interface GameState {
  v: 1;
  coins: number;
  gems: number;
  atkLv: number;
  spdLv: number;
  /** 가진 가장 높은 총 index (장착 = 이것) */
  gun: number;
  /** 클리어한 최고 스테이지 0..40 (환생해도 유지) */
  bestStage: number;
  /** 이번 회차 최고 클리어 (환생 토큰 계산용) */
  runBest: number;
  rebirths: number;
  tokens: number;
  /** 공격력 패스 배율 1 | 2 | 4 … 64 (계획 2가 채움) */
  passMult: number;
  /** 코인 2배 끝나는 시각 (ms epoch) */
  boostUntil: number;
  /** 마지막 저장 시각 (ms epoch) */
  lastSeen: number;
  char: CharId;
  chars: CharId[];
  /** 튜토리얼 단계, 끝 = 99 */
  tutorial: number;
}

export function newState(now: number): GameState {
  return {
    v: 1, coins: 0, gems: 0, atkLv: 0, spdLv: 0, gun: 0, bestStage: 0, runBest: 0,
    rebirths: 0, tokens: 0, passMult: 1, boostUntil: 0, lastSeen: now,
    char: 'blue', chars: ['blue'], tutorial: 0,
  };
}
