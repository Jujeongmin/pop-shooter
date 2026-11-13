import { BALANCE } from './balance.ts';

/** 스테이지 번호 = 1..40 정수 (월드 1 = 1~10) */
export function worldOf(s: number): number {
  return Math.floor((s - 1) / BALANCE.stage.perWorld) + 1;
}

export function isBoss(s: number): boolean {
  return s % BALANCE.stage.perWorld === 0;
}

/**
 * 보스 체력 = 1-1 체력에서 스테이지마다 그 월드의 hpGrowth를 곱해 이어 감 (대장만 ×bossMult, 다음 스테이지는 대장 배수 없이 이어짐).
 * 숫자는 시뮬레이터로 맞춤
 */
export function stageHp(s: number): number {
  if (!(s >= 1)) return 0;
  const st = BALANCE.stage;
  const g = st.hpGrowth;
  const w = worldOf(s);
  let hp = st.firstHp;
  // 앞 월드들: 월드 1은 9걸음(1-1 → 1-10), 그 뒤 월드는 10걸음씩
  for (let k = 1; k < w; k++) hp *= (g[k - 1] ?? 1) ** (k === 1 ? st.perWorld - 1 : st.perWorld);
  const inWorld = s - (w - 1) * st.perWorld;
  hp *= (g[w - 1] ?? 1) ** (w === 1 ? inWorld - 1 : inWorld);
  return hp * (isBoss(s) ? st.bossMult : 1) * BALANCE.atkScale;
}

export function stageTime(s: number): number {
  return isBoss(s) ? BALANCE.stage.timeBoss : BALANCE.stage.timeNormal;
}

export function firstClearCoins(s: number): number {
  const st = BALANCE.stage;
  return st.goldBase * st.goldGrowth ** (s - 1) * (isBoss(s) ? st.bossGold : 1);
}

export function replayCoins(s: number): number {
  return firstClearCoins(s) * BALANCE.stage.replayMult;
}

export function stageLabel(s: number): string {
  return `${worldOf(s)}-${((s - 1) % BALANCE.stage.perWorld) + 1}`;
}
