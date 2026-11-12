import { goldMult, highestWorld, maxDps, rebirthReq, trainRate } from './actions.ts';
import { BALANCE } from './balance.ts';
import { gunPrice } from './guns.ts';
import { RUN_GAP_SEC } from './run.ts';
import { firstClearCoins, isBoss, replayCoins, stageHp, stageTime } from './stages.ts';
import type { CharId, GameState } from './state.ts';
import { gainPerShot, TRAIN_KINDS, trainValue, trainWorth, type TrainKind } from './training.ts';

/**
 * 서버 경제 검사 (서버·테스트 공용 순수 함수). 2026-11-11 성장 개편: 훈련 = 주 성장(한도 없음), 골드 = 전투·오프라인.
 * 프리미엄 값(팝젬·패스·부스트·유료 캐릭터)은 서버 소유: 클라이언트 값 대신 Premium으로 덮어씀.
 * - 훈련치: 늘어난 양 ≤ 여유 × 그 시간 최대 발 수 × 한 발 최대 양(기구·장비는 이전·지금 중 큰 쪽, 가장 높은 월드 훈련장) + 바닥값. 넘으면 자름.
 * - 골드: "가치" = 골드 + 산 총·기구·장비 값. 늘어난 가치 ≤ 여유 × (새 첫 클리어 + 반복 도전 한도 + 오프라인 한도) + 바닥값.
 *   넘으면 골드를 자름. 산 것 값만으로 넘거나, 깰 수 없는 스테이지·조건 안 된 환생이면 거절 (이전 저장 유지).
 */

/** 서버가 가진 프리미엄 값 */
export interface Premium {
  gems: number;
  /** 공격력 패스 배율 1·2·4…64 */
  passMult: number;
  /** 골드 2배 끝 시각 (ms) */
  boostUntil: number;
  /** VX로 산 캐릭터 */
  paid: CharId[];
  /** 광고로 받은 오프라인 보상 2배분: 다음 저장에서 그만큼 골드를 더 허용 (쓰고 나면 0) */
  extra?: number;
}

export const MARGIN = 1.5;
/** 아주 초반 값 흔들림 허용 (골드) */
const FLOOR = 500;
/** 훈련치 흔들림 허용 */
const TRAIN_FLOOR = 2;
const TR_FIELD: Record<TrainKind, 'trAtk' | 'trSpd' | 'trCoin'> = { atk: 'trAtk', spd: 'trSpd', coin: 'trCoin' };
/** 월드 대장 첫 클리어로 열리는 캐릭터 (actions의 BOSS_UNLOCKS와 같은 순서) */
const FREE_BY_STAGE: readonly [CharId, number][] = [['yellow', 10], ['red', 20], ['pink', 30]];
/** 유료 캐릭터 */
export const PAID_CHARS: readonly CharId[] = ['white', 'black'];

/** 산 것 값: 총 + 기구 + 장비 */
export function levelWorth(s: GameState): number {
  let g = 0;
  for (let i = 1; i <= s.gun; i++) g += gunPrice(i);
  return g + trainWorth(s);
}

export function worth(s: GameState): number {
  return s.coins + levelWorth(s);
}

/** 이 진행이면 가질 수 있는 캐릭터 (무료 = 클리어로, 유료 = 서버 구매 기록) */
export function allowedChars(bestStage: number, paid: readonly CharId[]): CharId[] {
  const out: CharId[] = ['blue'];
  for (const [c, st] of FREE_BY_STAGE) if (bestStage >= st) out.push(c);
  for (const c of PAID_CHARS) if (paid.includes(c)) out.push(c);
  return out;
}

/** 새로 깬 월드 대장 수 (첫 클리어 팝젬용) */
export function newWorldBosses(prevBest: number, nextBest: number): number {
  let n = 0;
  for (let s = prevBest + 1; s <= nextBest; s++) if (isBoss(s)) n++;
  return n;
}

/** 기구·장비·기록은 이전·지금 중 큰 쪽으로 (그 사이 산 것으로 더 빨리 훈련했을 수 있음) */
function richest(prev: GameState, s: GameState): GameState {
  return {
    ...s,
    mAtk: Math.max(prev.mAtk, s.mAtk), mSpd: Math.max(prev.mSpd, s.mSpd), mCoin: Math.max(prev.mCoin, s.mCoin),
    gear: prev.gear | s.gear, bestStage: Math.max(prev.bestStage, s.bestStage), tokens: Math.max(prev.tokens, s.tokens),
  };
}

export type CheckResult =
  | { ok: true; state: GameState; clamped: boolean; prem: Premium }
  | { ok: false; reason: 'rebirth_skip' | 'rebirth_early' | 'stage' | 'levels' };

/**
 * prev = 서버에 있던 저장 (없으면 첫 저장: 프리미엄 덮기만), next = 클라이언트가 보낸 저장 (normalize 뒤),
 * elapsedSec = 서버 시각 기준 지난 시간, prem = 서버 프리미엄 (부스트 판단은 prem.boostUntil).
 */
export function checkSave(prev: GameState | null, next: GameState, elapsedSec: number, prem: Premium, now: number): CheckResult {
  const rebirthGain = prev ? next.rebirths - prev.rebirths : 0;
  const bestPrev = prev ? prev.bestStage : 0;
  const gems = prem.gems + Math.max(0, rebirthGain) * BALANCE.gems.perRebirth + newWorldBosses(bestPrev, next.bestStage) * BALANCE.gems.worldBossFirst;
  const prem2: Premium = { ...prem, gems };
  const chars = allowedChars(Math.max(bestPrev, next.bestStage), prem.paid);
  let s: GameState = {
    ...next,
    gems,
    passMult: prem.passMult,
    boostUntil: prem.boostUntil,
    chars,
    char: chars.includes(next.char) ? next.char : 'blue',
    tokens: prev ? prev.tokens + Math.max(0, rebirthGain) : next.tokens,
    bestStage: Math.max(bestPrev, next.bestStage),
  };
  if (!prev) return { ok: true, state: s, clamped: false, prem: prem2 };
  if (rebirthGain < 0 || rebirthGain > 1) return { ok: false, reason: 'rebirth_skip' };
  const dt = Math.max(0, elapsedSec);
  const rich = richest(prev, s);
  const world = highestWorld(rich);
  // 그 시간에 쏠 수 있는 최대 발 수 (연사는 이전·지금 중 큰 쪽 + 최대 탭)
  // 그 시간에 할 수 있는 최대 훈련 동작 수 (종류별: 공격 = 발사, 연사·골드 = 고정 동작) + 최대 탭
  const shotsOf = (k: TrainKind): number => dt * (Math.max(trainRate(prev, k), trainRate(s, k)) + BALANCE.tap.maxPerSec);
  // 훈련치 상한 (환생했으면 0부터). prevUp = 이전 저장에서 그 사이 오를 수 있었던 최대 (환생 조건·스테이지 검사용)
  let clamped = false;
  const prevUp: GameState = { ...rich };
  for (const k of TRAIN_KINDS) {
    const room = MARGIN * shotsOf(k) * gainPerShot(rich, k, world) + TRAIN_FLOOR;
    prevUp[TR_FIELD[k]] = trainValue(prev, k) + room;
    const cap = (rebirthGain === 1 ? 0 : trainValue(prev, k)) + room;
    if (trainValue(s, k) > cap) { s = { ...s, [TR_FIELD[k]]: cap }; clamped = true; }
  }
  if (rebirthGain === 1 && prevUp.trAtk < rebirthReq(prev)) return { ok: false, reason: 'rebirth_early' };
  // 새로 깬 스테이지는 그 사이 능력치(이전 + 훈련 한도, 지금 중 센 쪽)로 제한 시간 안에 깰 수 있어야
  const dps = Math.max(maxDps(prevUp), maxDps(s));
  for (let st = bestPrev + 1; st <= s.bestStage; st++) {
    if (dps * stageTime(st) < stageHp(st) * 0.999) return { ok: false, reason: 'stage' };
  }
  // 벌 수 있는 골드: 새 첫 클리어 + 반복 도전(스테이지 사이 쉬는 시간마다 기록 스테이지 한 번) + 오프라인, 골드 배율은 큰 쪽
  const boosted = prem.boostUntil > now - dt * 1000;
  const gm = Math.max(goldMult({ ...prev, boostUntil: 0 }, 0), goldMult({ ...prevUp, boostUntil: 0 }, 0)) * (boosted ? BALANCE.boost.coinMult : 1);
  let firsts = 0;
  for (let st = bestPrev + 1; st <= s.bestStage; st++) firsts += firstClearCoins(st);
  const best = Math.max(1, s.bestStage);
  const earn = gm * (firsts + (dt / RUN_GAP_SEC) * replayCoins(best) + (dt * replayCoins(best) * BALANCE.offline.goldRate) / stageTime(best));
  const allowed = worth(prev) + MARGIN * earn + FLOOR + (prem.extra ?? 0);
  const lv = levelWorth(s);
  if (lv > allowed) return { ok: false, reason: 'levels' };
  if (s.coins + lv > allowed) {
    s = { ...s, coins: Math.max(0, allowed - lv) };
    clamped = true;
  }
  return { ok: true, state: s, clamped, prem: { ...prem2, extra: 0 } };
}
