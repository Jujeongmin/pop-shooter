import { BALANCE, STAGE_COUNT } from './balance.ts';
import { gunMult, gunPrice, GUNS } from './guns.ts';
import { firstClearCoins, isBoss, replayCoins, worldOf } from './stages.ts';
import type { CharId, GameState } from './state.ts';
import { atkTrainMult, coinTrainMult, spdTrainMult } from './training.ts';

/** 월드 대장 첫 클리어로 열리는 캐릭터 (월드 1~3) */
const BOSS_UNLOCKS: readonly CharId[] = ['yellow', 'red', 'pink'];

export function charMult(c: CharId): number {
  return BALANCE.charMult[c];
}

/** 한 발 피해 = (1 + 공격 훈련 점수) × 총 × 캐릭터 × 패스 */
export function damagePerShot(s: GameState): number {
  return atkTrainMult(s) * gunMult(s.gun) * s.passMult * charMult(s.char);
}

/** 초당 발사 = 1 × (1 + 연사 훈련%) (12발까지) */
export function shotsPerSec(s: GameState): number {
  return spdTrainMult(s);
}

export function autoDps(s: GameState): number {
  return damagePerShot(s) * shotsPerSec(s);
}

export function maxDps(s: GameState): number {
  return damagePerShot(s) * (shotsPerSec(s) + BALANCE.tap.maxPerSec);
}

/** 전투 골드 배율 = 코인 훈련 × 부스트 */
export function goldMult(s: GameState, now: number): number {
  return coinTrainMult(s) * (now < s.boostUntil ? BALANCE.boost.coinMult : 1);
}

export function worldUnlocked(s: GameState, w: number): boolean {
  return w >= 1 && w <= BALANCE.stage.worlds && s.bestStage >= (w - 1) * BALANCE.stage.perWorld;
}

export function highestWorld(s: GameState): number {
  let w = 1;
  while (worldUnlocked(s, w + 1)) w++;
  return w;
}

export function buyNextGun(s: GameState): GameState | null {
  const next = GUNS[s.gun + 1];
  if (!next || !worldUnlocked(s, next.world)) return null;
  const price = gunPrice(next.index);
  if (!(price <= s.coins)) return null;
  return { ...s, coins: s.coins - price, gun: next.index };
}

export function addCoins(s: GameState, c: number): GameState {
  if (!(c > 0) || !Number.isFinite(c)) return s;
  return { ...s, coins: s.coins + c };
}

export function canAttempt(s: GameState, stage: number): boolean {
  return Number.isInteger(stage) && stage >= 1 && stage <= STAGE_COUNT && stage <= s.bestStage + 1;
}

export interface ClearResult {
  state: GameState;
  coins: number;
  firstClear: boolean;
  unlockedChar: CharId | null;
}

/** 스테이지 클리어 보상 (골드 × 코인 훈련 × 부스트). now = 부스트 판단 시각 */
export function clearStage(s: GameState, stage: number, now = 0): ClearResult {
  const firstClear = stage > s.bestStage;
  const coins = (firstClear ? firstClearCoins(stage) : replayCoins(stage)) * goldMult(s, now);
  let next: GameState = { ...s, coins: s.coins + coins, runBest: Math.max(s.runBest, stage) };
  let unlockedChar: CharId | null = null;
  if (firstClear) {
    next.bestStage = stage;
    if (isBoss(stage)) {
      next.gems += BALANCE.gems.worldBossFirst;
      const c = BOSS_UNLOCKS[worldOf(stage) - 1];
      if (c && !next.chars.includes(c)) {
        unlockedChar = c;
        next = { ...next, chars: [...next.chars, c] };
      }
    }
  }
  return { state: next, coins, firstClear, unlockedChar };
}

/** 다음 환생에 필요한 공격 훈련 점수 */
export function rebirthReq(s: GameState): number {
  return BALANCE.rebirth.reqBase * BALANCE.rebirth.reqGrowth ** s.rebirths;
}

export function canRebirth(s: GameState): boolean {
  return s.trAtk >= rebirthReq(s);
}

/** 훈련치(공격·연사·코인)와 이번 회차 기록만 초기화, 환생 배율 +1단계. 유지: 골드·총·기구·장비·기록·팝젬·캐릭터 */
export function doRebirth(s: GameState): GameState | null {
  if (!canRebirth(s)) return null;
  return {
    ...s,
    trAtk: 0, trSpd: 0, trCoin: 0, runBest: 0,
    tokens: s.tokens + 1,
    rebirths: s.rebirths + 1,
    gems: s.gems + BALANCE.gems.perRebirth,
  };
}
