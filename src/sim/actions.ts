import { BALANCE, STAGE_COUNT } from './balance.ts';
import { gunMult, gunPrice, GUNS } from './guns.ts';
import { firstClearCoins, isBoss, replayCoins, worldOf } from './stages.ts';
import type { CharId, GameState } from './state.ts';
import { atkValue, bulkCost, rebirthMult, spdValue } from './stats.ts';
import { atkTrainMult, coinTrainMult, spdTrainMult } from './training.ts';

/** 월드 대장 첫 클리어로 열리는 캐릭터 (월드 1~3) */
const BOSS_UNLOCKS: readonly CharId[] = ['yellow', 'red', 'pink'];

export function charMult(c: CharId): number {
  return BALANCE.charMult[c];
}

export function damagePerShot(s: GameState): number {
  return atkValue(s.atkLv) * gunMult(s.gun) * rebirthMult(s.tokens) * s.passMult * charMult(s.char) * atkTrainMult(s);
}

export function shotsPerSec(s: GameState): number {
  return spdValue(s.spdLv) * spdTrainMult(s);
}

export function autoDps(s: GameState): number {
  return damagePerShot(s) * shotsPerSec(s);
}

export function maxDps(s: GameState): number {
  return damagePerShot(s) * (shotsPerSec(s) + BALANCE.tap.maxPerSec);
}

/** 사격장 발사 1회 코인. 부스트는 코인에만 붙음 */
export function coinPerShot(s: GameState, world: number, now: number): number {
  const range = BALANCE.range.multByWorld[world - 1] ?? 1;
  return damagePerShot(s) * range * coinTrainMult(s) * (now < s.boostUntil ? BALANCE.boost.coinMult : 1);
}

export function worldUnlocked(s: GameState, w: number): boolean {
  return w >= 1 && w <= BALANCE.stage.worlds && s.bestStage >= (w - 1) * BALANCE.stage.perWorld;
}

export function highestWorld(s: GameState): number {
  let w = 1;
  while (worldUnlocked(s, w + 1)) w++;
  return w;
}

function buyStat(s: GameState, kind: 'atk' | 'spd', n: number): GameState | null {
  if (n <= 0) return null;
  const lv = kind === 'atk' ? s.atkLv : s.spdLv;
  const cost = bulkCost(kind, lv, n);
  if (!(cost <= s.coins)) return null;
  return kind === 'atk' ? { ...s, coins: s.coins - cost, atkLv: lv + n } : { ...s, coins: s.coins - cost, spdLv: lv + n };
}

export function buyAtk(s: GameState, n: number): GameState | null {
  return buyStat(s, 'atk', n);
}

export function buySpd(s: GameState, n: number): GameState | null {
  return buyStat(s, 'spd', n);
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

export function clearStage(s: GameState, stage: number): ClearResult {
  const firstClear = stage > s.bestStage;
  const coins = firstClear ? firstClearCoins(stage) : replayCoins(stage);
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

/** 다음 환생에 필요한 공격력 레벨 (환생할수록 오름) */
export function rebirthReqLevel(s: GameState): number {
  return Math.round(BALANCE.rebirth.reqBase + BALANCE.rebirth.reqStep * s.rebirths);
}

export function canRebirth(s: GameState): boolean {
  return s.atkLv >= rebirthReqLevel(s);
}

/** 코인·스탯·총·훈련(훈련치·기계·장비)·이번 회차 기록 초기화, 토큰 +1 (배율 +multPerToken). 유지: bestStage·팝젬·캐릭터·패스·부스트·튜토리얼 */
export function doRebirth(s: GameState): GameState | null {
  if (!canRebirth(s)) return null;
  return {
    ...s,
    coins: 0, atkLv: 0, spdLv: 0, gun: 0, runBest: 0,
    trAtk: 0, trSpd: 0, trCoin: 0, mAtk: 0, mSpd: 0, mCoin: 0, gear: 0,
    tokens: s.tokens + 1,
    rebirths: s.rebirths + 1,
    gems: s.gems + BALANCE.gems.perRebirth,
  };
}
