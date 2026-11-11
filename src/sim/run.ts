import { clearStage, worldUnlocked } from './actions.ts';
import { BALANCE } from './balance.ts';
import { startBattle, stepBattle, tapBattle, type Battle } from './battle.ts';
import { isBoss } from './stages.ts';
import type { CharId, GameState } from './state.ts';

/** 스테이지 사이 쉬는 시간(초): 다음 보스 등장 연출 */
export const RUN_GAP_SEC = 1.2;

/**
 * 연속 도전: 월드 입구에 들어가면 그 월드 1번부터 자동 전투, 이기면 바로 다음 스테이지(타이머 새로),
 * 시간 안에 못 깨면 끝(fail), 대장(10번)을 깨면 월드 클리어. 공격력은 시작 때 값으로 고정.
 */
export interface Run {
  world: number;
  stage: number;
  battle: Battle;
  cleared: number[];
  /** 다음 스테이지 시작까지 남은 시간 (0이면 전투 중) */
  gap: number;
  done: null | 'fail' | 'worldClear';
  /** 시작 때 상태 (다음 스테이지 전투 만들 때) */
  readonly from: GameState;
}

export function canStartRun(s: GameState, world: number): boolean {
  return worldUnlocked(s, world);
}

export function startRun(s: GameState, world: number): Run {
  const stage = (world - 1) * BALANCE.stage.perWorld + 1;
  return { world, stage, battle: startBattle(s, stage), cleared: [], gap: 0, done: null, from: s };
}

/** 시간 진행. 이번에 깬 스테이지 번호(없으면 null)와 자동 발사 수 */
export function stepRun(r: Run, dt: number): { shots: number; cleared: number | null } {
  if (r.done) return { shots: 0, cleared: null };
  if (r.gap > 0) {
    r.gap = Math.max(0, r.gap - dt);
    return { shots: 0, cleared: null };
  }
  const shots = stepBattle(r.battle, dt);
  if (r.battle.done === 'lose') {
    r.done = 'fail';
    return { shots, cleared: null };
  }
  if (r.battle.done === 'win') return { shots, cleared: advance(r) };
  return { shots, cleared: null };
}

/** 탭 한 발 (쉬는 시간엔 무시) */
export function tapRun(r: Run): number | null {
  if (r.done || r.gap > 0) return null;
  tapBattle(r.battle);
  return r.battle.done === 'win' ? advance(r) : null;
}

function advance(r: Run): number {
  const won = r.stage;
  r.cleared.push(won);
  if (isBoss(won)) {
    r.done = 'worldClear';
    return won;
  }
  r.stage = won + 1;
  r.battle = startBattle(r.from, r.stage);
  r.gap = RUN_GAP_SEC;
  return won;
}

export interface RunReward {
  state: GameState;
  coins: number;
  firstClears: number[];
  unlockedChars: CharId[];
}

/** 깬 스테이지만큼 보상: 처음 깬 것 = 첫 클리어 보상, 이미 깬 것 = 재도전 보상 (× 코인 훈련, now면 부스트) */
export function finishRun(s: GameState, cleared: readonly number[], now = 0): RunReward {
  let state = s;
  let coins = 0;
  const firstClears: number[] = [];
  const unlockedChars: CharId[] = [];
  for (const st of cleared) {
    const r = clearStage(state, st, now);
    state = r.state;
    coins += r.coins;
    if (r.firstClear) firstClears.push(st);
    if (r.unlockedChar) unlockedChars.push(r.unlockedChar);
  }
  return { state, coins, firstClears, unlockedChars };
}
