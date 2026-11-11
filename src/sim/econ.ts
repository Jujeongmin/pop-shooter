import { coinPerShot, highestWorld, maxDps, rebirthReqLevel, shotsPerSec } from './actions.ts';
import { BALANCE } from './balance.ts';
import { gunPrice } from './guns.ts';
import { RUN_GAP_SEC } from './run.ts';
import { firstClearCoins, isBoss, replayCoins, stageHp, stageTime } from './stages.ts';
import type { CharId, GameState } from './state.ts';
import { bulkCost } from './stats.ts';

/**
 * 서버 경제 검사 (서버·테스트 공용 순수 함수, 스펙 7장).
 * 프리미엄 값(팝젬·패스·부스트·유료 캐릭터)은 서버 소유: 클라이언트 값 대신 Premium으로 덮어씀.
 * 진행 검사: "가치" = 코인 + 산 공격력·공격 속도 레벨 비용 + 산 총 가격 (이번 회차).
 * 저장 사이에 늘어난 가치 ≤ 여유 × (그 시간에 벌 수 있는 최대 코인 + 새로 깬 스테이지 첫 보상 + 반복 도전 보상 한도) + 바닥값.
 * 넘으면 코인을 상한으로 자름. 레벨·총 값만으로 넘거나, 깰 수 없는 스테이지·건너뛴 환생이면 거절 (이전 저장 유지).
 */

/** 서버가 가진 프리미엄 값 */
export interface Premium {
  gems: number;
  /** 공격력 패스 배율 1·2·4…64 */
  passMult: number;
  /** 코인 2배 끝 시각 (ms) */
  boostUntil: number;
  /** VX로 산 캐릭터 */
  paid: CharId[];
}

export const MARGIN = 1.5;
/** 아주 초반 값 흔들림 허용 (코인) */
const FLOOR = 500;
/** 월드 대장 첫 클리어로 열리는 캐릭터 (actions의 BOSS_UNLOCKS와 같은 순서) */
const FREE_BY_STAGE: readonly [CharId, number][] = [['yellow', 10], ['red', 20], ['pink', 30]];
/** 유료 캐릭터 */
export const PAID_CHARS: readonly CharId[] = ['white', 'black'];

export function levelWorth(s: GameState): number {
  let g = 0;
  for (let i = 1; i <= s.gun; i++) g += gunPrice(i);
  return bulkCost('atk', 0, s.atkLv) + bulkCost('spd', 0, s.spdLv) + g;
}

export function worth(s: GameState): number {
  return s.coins + levelWorth(s);
}

/** 1초에 벌 수 있는 최대 코인 (가장 높은 사격장, 자동 + 최대 탭, 부스트 포함 여부) */
export function maxIncomePerSec(s: GameState, boosted: boolean): number {
  const per = coinPerShot({ ...s, boostUntil: 0 }, highestWorld(s), 0) * (boosted ? BALANCE.boost.coinMult : 1);
  return per * (shotsPerSec(s) + BALANCE.tap.maxPerSec);
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

export type CheckResult =
  | { ok: true; state: GameState; clamped: boolean; prem: Premium }
  | { ok: false; reason: 'rebirth_skip' | 'rebirth_early' | 'stage' | 'levels' };

/**
 * prev = 서버에 있던 저장 (없으면 첫 저장: 프리미엄 덮기만), next = 클라이언트가 보낸 저장 (normalize 뒤),
 * elapsedSec = 서버 시각 기준 지난 시간, prem = 서버 프리미엄 (부스트 판단은 prem.boostUntil).
 * 돌려주는 prem = 이번 저장으로 바뀐 프리미엄 (환생·대장 첫 클리어 팝젬).
 */
export function checkSave(prev: GameState | null, next: GameState, elapsedSec: number, prem: Premium, now: number): CheckResult {
  const rebirthGain = prev ? next.rebirths - prev.rebirths : 0;
  const bestPrev = prev ? prev.bestStage : 0;
  const gems = prem.gems + Math.max(0, rebirthGain) * BALANCE.gems.perRebirth + newWorldBosses(bestPrev, next.bestStage) * BALANCE.gems.worldBossFirst;
  const prem2: Premium = { ...prem, gems };
  // 프리미엄·캐릭터는 서버 값으로
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
  const boosted = prem.boostUntil > now - dt * 1000;
  // 벌 수 있는 양: 이전·지금 능력치 중 큰 쪽 수입 (그 사이 산 레벨이 공격력 2배 구간을 넘으면 수입이 중간에 2배).
  // 지금 능력치를 부풀려도 레벨 비용(25레벨에 ×17)이 수입(×2)보다 훨씬 빨리 커서 levels 검사에 걸림.
  // 이번 저장에서 새 월드가 열렸으면 그 사격장 수입까지 (같은 30초 안에 대장 깨고 훈련)
  const best = Math.max(prev.bestStage, s.bestStage);
  const earn = dt * Math.max(maxIncomePerSec({ ...prev, bestStage: best }, boosted), maxIncomePerSec({ ...s, bestStage: best }, boosted))
    + (dt / RUN_GAP_SEC) * replayCoins(Math.max(1, s.bestStage));
  let firsts = 0;
  for (let st = bestPrev + 1; st <= s.bestStage; st++) firsts += firstClearCoins(st);

  if (rebirthGain === 1) {
    // 환생 전 필요 레벨에 닿을 수 있었는지 (이전 가치 + 번 것으로 그 레벨 비용을 낼 수 있었나)
    const need = bulkCost('atk', 0, rebirthReqLevel(prev));
    if (worth(prev) + MARGIN * (earn + firsts) + FLOOR < need) return { ok: false, reason: 'rebirth_early' };
  }
  // 새로 깬 스테이지는 그 사이 능력치(이전·지금 중 센 쪽, 최대 DPS)로 제한 시간 안에 깰 수 있어야 (깨고 바로 환생한 경우 지금은 약함)
  const dps = Math.max(maxDps(prev), maxDps(s));
  for (let st = bestPrev + 1; st <= s.bestStage; st++) {
    if (dps * stageTime(st) < stageHp(st) * 0.999) return { ok: false, reason: 'stage' };
  }
  const base = rebirthGain === 1 ? 0 : worth(prev);
  const allowed = base + MARGIN * (earn + firsts) + FLOOR;
  const lv = levelWorth(s);
  if (lv > allowed) return { ok: false, reason: 'levels' };
  let clamped = false;
  if (s.coins + lv > allowed) {
    s = { ...s, coins: Math.max(0, allowed - lv) };
    clamped = true;
  }
  return { ok: true, state: s, clamped, prem: prem2 };
}
