import { autoDps, damagePerShot, shotsPerSec } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { stageHp, stageTime } from '../sim/stages.ts';
import type { GameState } from '../sim/state.ts';

/** 안내가 가리키는 곳 (시설 id와 같음) */
export type GuideKind = 'portal' | 'upgrade' | 'range' | 'treadmill';

/** 전투 판단에 넣는 탭 속도: 0 (탭으로 더 쏘기 없음, 자동 사격만 — 2026-11-12 1-1을 못 깨는데 포털 안내가 뜨던 것) */
const GUIDE_TAPS = 0;
/** 이 광장(월드 1)의 마지막 스테이지 */
const HUB_LAST_STAGE = BALANCE.stage.perWorld;
/** 튜토리얼 끝 표시 (state.tutorial) */
export const TUTORIAL_DONE = 99;

/**
 * 첫 튜토리얼 (CrazyGames 점검 2026-11-16, 사용자 승인): 사격장(공격) → 자동 DPS가 1-1을 약 10초에 깰 만큼 되면 포털 →
 * 첫 클리어 뒤 러닝머신(연사) → 골드로 강화.
 * 예전(2026-11-13)엔 사격장 → 러닝머신 → DPS = 1-1 체력 절반까지 사격장 → 포털이라 첫 적이 약 75초 뒤에 나왔음
 * (1분 이상 플레이 비율이 낮은 주원인). 지금은 사격장 약 17초, 첫 전투까지 약 30초
 */
export const TUT_SPD = 50;
/** 첫 전투에서 1-1을 깨는 데 걸리는 시간(초, 자동 사격만) */
const FIRST_CLEAR_SEC = 10;

/** 포털 안내 DPS = 1-1 체력 / FIRST_CLEAR_SEC (탭하면 더 빨리 깸) */
export function portalDps(): number {
  return stageHp(1) / FIRST_CLEAR_SEC;
}

/** 지금 공격력으로 다음 스테이지를 깰 수 있는지 (자동 사격만, 여유 margin배) */
export function canBeatNext(s: GameState, margin = 1): boolean {
  const next = s.bestStage + 1;
  if (next > HUB_LAST_STAGE) return false;
  return damagePerShot(s) * (shotsPerSec(s) + GUIDE_TAPS) * stageTime(next) >= stageHp(next) * margin;
}

/** 골드로 뭔가 산 적이 있음 (기구·장비·총) — 튜토리얼 마지막 단계 끝 */
export function boughtAnything(s: GameState): boolean {
  return s.mAtk + s.mSpd + s.mCoin > 0 || s.gear !== 0 || s.gun > 0;
}

export function tutorialFinished(s: GameState): boolean {
  return s.tutorial >= TUTORIAL_DONE || (s.bestStage >= 1 && boughtAnything(s));
}

/**
 * 안내: 처음 한 번만 사격장(공격) → 포털(1-1) → 러닝머신(연사) → 골드로 강화. 끝나면 안내 없음 (환생은 오른쪽 버튼이 알림).
 */
export function pickGuide(s: GameState): GuideKind | null {
  if (!tutorialFinished(s)) {
    if (s.bestStage < 1) return autoDps(s) >= portalDps() ? 'portal' : 'range';
    if (s.trSpd < TUT_SPD) return 'treadmill';
    return 'upgrade';
  }
  // 환생은 안내하지 않음 (제단 없음, 오른쪽 환생 버튼이 차오르고 반짝여 알림, 사용자 2026-11-13)
  return null;
}
