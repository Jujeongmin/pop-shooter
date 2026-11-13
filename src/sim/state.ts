export type CharId = 'blue' | 'yellow' | 'red' | 'pink' | 'white' | 'black';
export const CHAR_IDS: readonly CharId[] = ['blue', 'yellow', 'red', 'pink', 'white', 'black'];

/**
 * 저장 상태 v2 (2026-11-11 성장 개편: 훈련 = 주 성장, 골드 = 전투). v1의 공격력·공격 속도 레벨은 없어짐 (normalize가 옮김).
 */
export interface GameState {
  v: 2;
  /** 골드 (전투·오프라인으로만 얻음) */
  coins: number;
  gems: number;
  /** 가진 가장 높은 총 index (장착 = 이것). 환생해도 유지 */
  gun: number;
  /** 클리어한 최고 스테이지 0..40 (환생해도 유지) */
  bestStage: number;
  /** 이번 회차 최고 클리어 */
  runBest: number;
  rebirths: number;
  /** 환생 배율 단계 (환생마다 +1, 훈련 속도 = rebirthMult(tokens): ×1.5, ×2, ×3, ×4 …) */
  tokens: number;
  /** 공격력 패스 배율 1 | 2 | 4 … 64 */
  passMult: number;
  /** 골드 2배 끝나는 시각 (ms epoch) */
  boostUntil: number;
  /** 마지막 저장 시각 (ms epoch) */
  lastSeen: number;
  char: CharId;
  chars: CharId[];
  /** 튜토리얼 단계, 끝 = 99 */
  tutorial: number;
  /** 훈련치: 공격 = 점수(피해 ×(1+점수)), 연사·코인 = %. 한도 없음(연사는 초당 12발까지). 환생하면 0 */
  trAtk: number;
  trSpd: number;
  trCoin: number;
  /** 훈련 기구 레벨 (공격·연사·코인), 골드로 올림. 환생해도 유지 */
  mAtk: number;
  mSpd: number;
  mCoin: number;
  /** 가진 장비 비트 (GEAR 순서). 환생해도 유지 */
  gear: number;
}

export function newState(now: number): GameState {
  return {
    v: 2, coins: 0, gems: 0, gun: 0, bestStage: 0, runBest: 0,
    rebirths: 0, tokens: 0, passMult: 1, boostUntil: 0, lastSeen: now,
    char: 'blue', chars: ['blue'], tutorial: 0,
    trAtk: 0, trSpd: 0, trCoin: 0, mAtk: 0, mSpd: 0, mCoin: 0, gear: 0,
  };
}
