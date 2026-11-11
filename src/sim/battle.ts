import { damagePerShot, shotsPerSec } from './actions.ts';
import { stageHp, stageTime } from './stages.ts';
import type { GameState } from './state.ts';

export interface Battle {
  stage: number;
  hp: number;
  maxHp: number;
  timeLeft: number;
  dmg: number;
  sps: number;
  shotAcc: number;
  done: null | 'win' | 'lose';
}

export function startBattle(s: GameState, stage: number): Battle {
  const hp = stageHp(stage);
  return { stage, hp, maxHp: hp, timeLeft: stageTime(stage), dmg: damagePerShot(s), sps: shotsPerSec(s), shotAcc: 0, done: null };
}

function hit(b: Battle, shots: number): void {
  b.hp = Math.max(0, b.hp - b.dmg * shots);
  if (b.hp <= 0) b.done = 'win';
}

/** 자동 발사 수 반환. 끝난 전투는 아무것도 안 함 */
export function stepBattle(b: Battle, dt: number): number {
  if (b.done) return 0;
  b.shotAcc += b.sps * dt;
  const shots = Math.floor(b.shotAcc + 1e-9);
  b.shotAcc -= shots;
  if (shots > 0) hit(b, shots);
  if (b.done) return shots;
  b.timeLeft -= dt;
  if (b.timeLeft <= 0) {
    b.timeLeft = 0;
    b.done = 'lose';
  }
  return shots;
}

/** 탭 한 발 (탭 제한은 호출하는 쪽 TapLimiter) */
export function tapBattle(b: Battle): void {
  if (b.done) return;
  hit(b, 1);
}
