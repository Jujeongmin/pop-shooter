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

/**
 * 이길 수 없게 되면(남은 시간에 쏠 수 있는 피해 < 남은 체력) 시간이 이 배로 빨리 흘러 금방 짐
 * (사용자 2026-11-12: 내가 죽기까지 너무 오래 걸림). 전투 중 공격력이 고정이라 시작부터 알 수 있음. 이기는 판은 그대로.
 */
export const HOPELESS_SPEED = 5;

/** 남은 시간 동안 자동 사격으로는 못 이김 */
export function hopeless(b: Battle): boolean {
  return b.hp > b.dmg * Math.floor(b.shotAcc + b.sps * b.timeLeft + 1e-9);
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
  b.timeLeft -= dt * (hopeless(b) ? HOPELESS_SPEED : 1);
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
