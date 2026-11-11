import { canRebirth, damagePerShot, shotsPerSec } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { stageHp, stageTime } from '../sim/stages.ts';
import type { GameState } from '../sim/state.ts';

/** 안내가 가리키는 곳 (시설 id와 같음) */
export type GuideKind = 'altar' | 'portal' | 'upgrade' | 'range';

/** 전투 판단에 넣는 탭 속도 (보통 플레이어가 치는 정도) */
const GUIDE_TAPS = 3;
/** 이 광장(월드 1)의 마지막 스테이지 */
const HUB_LAST_STAGE = BALANCE.stage.perWorld;
/** 튜토리얼 끝 표시 (state.tutorial) */
export const TUTORIAL_DONE = 99;

/** 지금 공격력으로 다음 스테이지를 깰 수 있는지 (자동 + 보통 탭) */
export function canBeatNext(s: GameState): boolean {
  const next = s.bestStage + 1;
  if (next > HUB_LAST_STAGE) return false;
  return damagePerShot(s) * (shotsPerSec(s) + GUIDE_TAPS) * stageTime(next) >= stageHp(next);
}

/** 골드로 뭔가 산 적이 있음 (기구·장비·총) — 튜토리얼 마지막 단계 끝 */
export function boughtAnything(s: GameState): boolean {
  return s.mAtk + s.mSpd + s.mCoin > 0 || s.gear !== 0 || s.gun > 0;
}

export function tutorialFinished(s: GameState): boolean {
  return s.tutorial >= TUTORIAL_DONE || (s.bestStage >= 1 && boughtAnything(s));
}

/**
 * 안내 (사용자 2026-11-11): 처음 한 번만 훈련장 → 포탈(1-1) → 골드로 강화. 끝나면 안내 없음,
 * 그 뒤로는 환생할 수 있을 때만 환생 제단.
 */
export function pickGuide(s: GameState): GuideKind | null {
  if (!tutorialFinished(s)) {
    if (s.bestStage < 1) return canBeatNext(s) ? 'portal' : 'range';
    return 'upgrade';
  }
  return canRebirth(s) ? 'altar' : null;
}
