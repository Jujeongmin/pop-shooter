import { bulkCost } from '../sim/stats.ts';
import { canRebirth, damagePerShot, shotsPerSec, worldUnlocked } from '../sim/actions.ts';
import { BALANCE } from '../sim/balance.ts';
import { gunPrice, GUNS } from '../sim/guns.ts';
import { stageHp, stageTime } from '../sim/stages.ts';
import type { GameState } from '../sim/state.ts';

/** 안내가 가리키는 곳 (시설 id와 같음) */
export type GuideKind = 'altar' | 'portal' | 'guns' | 'upgrade' | 'range';

/** 전투 판단에 넣는 탭 속도 (보통 플레이어가 치는 정도) */
const GUIDE_TAPS = 3;
/** 업그레이드 안내: 공격력을 이만큼 한 번에 살 수 있을 때 (조금 모였을 때마다 끌고 가지 않게) */
const UPGRADE_BATCH = 5;
/** 이 광장(월드 1)의 마지막 스테이지 */
const HUB_LAST_STAGE = BALANCE.stage.perWorld;

/** 지금 공격력으로 다음 스테이지를 깰 수 있는지 (자동 + 보통 탭) */
export function canBeatNext(s: GameState): boolean {
  const next = s.bestStage + 1;
  if (next > HUB_LAST_STAGE) return false;
  return damagePerShot(s) * (shotsPerSec(s) + GUIDE_TAPS) * stageTime(next) >= stageHp(next);
}

/**
 * 상황 안내 (정해진 순서가 아니라 지금 할 만한 것 하나): 환생 가능 → 다음 스테이지 깰 수 있음 → 새 총 살 수 있음
 * → 공격력 여러 단계 살 수 있음 → (훈련 중이 아니면) 사격장. 훈련 중이고 할 게 없으면 안내 없음.
 */
export function pickGuide(s: GameState, training: boolean): GuideKind | null {
  if (canRebirth(s)) return 'altar';
  if (canBeatNext(s)) return 'portal';
  const g = GUNS[s.gun + 1];
  if (g && worldUnlocked(s, g.world) && gunPrice(g.index) <= s.coins) return 'guns';
  if (bulkCost('atk', s.atkLv, UPGRADE_BATCH) <= s.coins) return 'upgrade';
  return training ? null : 'range';
}
