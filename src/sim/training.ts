import { BALANCE } from './balance.ts';
import type { GameState } from './state.ts';

/**
 * 훈련 성장 (방치형, 사용자 2026-11-11 · 포키 +1 MMA Fighter 방식).
 * 사격장에서 한 발 쏠 때마다 공격력·초당 발사·코인 훈련치(%)가 조금씩 쌓임 (자동 발사·탭·오프라인 모두).
 * 훈련치는 한도까지만 차오름 (무한히 쌓이면 오래 머물수록 끝없이 세져 뒤 월드 진행이 무너짐 → 시뮬레이터로 확인).
 * - 한 발에 쌓이는 양 = 기본 × (1 + levelStep × 기계 레벨) × 장비 × 멘토
 * - 한도 = (capBase + capStep × 기계 레벨) × 장비 × 멘토 (초당 발사는 spdCap%까지)
 * - 기계: 코인으로 레벨 올림 (종류별 하나): 한도와 쌓이는 속도가 같이 오름. 환생하면 기계·장비·훈련치 처음부터.
 * - 장비: 종류별 단계, 한 번 사면 그 종류 ×1.45 (한도·속도). 뒤 단계는 스테이지 기록으로 열림.
 * - 멘토: 스테이지 기록으로 자동 영입, 모든 훈련 ×1.28 (한도·속도, 환생해도 유지).
 * 효과: 피해 ×(1 + 공격 훈련/100), 초당 발사 ×(1 + 발사 훈련/100), 코인 ×(1 + 코인 훈련/100).
 */

export type TrainKind = 'atk' | 'spd' | 'coin';
export const TRAIN_KINDS: readonly TrainKind[] = ['atk', 'spd', 'coin'];

export interface GearDef { id: string; kind: TrainKind; tier: number; price: number; needStage: number }
export interface MentorDef { id: string; needStage: number }

/** 장비 (종류 × 단계). 순서 = 상점 표시 순서, gear 비트 순서 (바꾸지 말고 뒤에 붙일 것) */
export const GEAR: readonly GearDef[] = [
  { id: 'gloves', kind: 'atk', tier: 1, price: 2_000, needStage: 0 },
  { id: 'goggles', kind: 'spd', tier: 1, price: 3_000, needStage: 0 },
  { id: 'piggy', kind: 'coin', tier: 1, price: 2_500, needStage: 0 },
  { id: 'gloves2', kind: 'atk', tier: 2, price: 400_000, needStage: 5 },
  { id: 'goggles2', kind: 'spd', tier: 2, price: 600_000, needStage: 5 },
  { id: 'piggy2', kind: 'coin', tier: 2, price: 500_000, needStage: 5 },
  { id: 'gloves3', kind: 'atk', tier: 3, price: 5e8, needStage: 10 },
  { id: 'goggles3', kind: 'spd', tier: 3, price: 8e8, needStage: 10 },
  { id: 'piggy3', kind: 'coin', tier: 3, price: 6e8, needStage: 10 },
];

/** 멘토: 이 스테이지를 처음 깨면 영입 */
export const MENTORS: readonly MentorDef[] = [
  { id: 'coach', needStage: 3 },
  { id: 'sniper', needStage: 10 },
  { id: 'captain', needStage: 20 },
  { id: 'legend', needStage: 30 },
];

const T = (): typeof BALANCE.train => BALANCE.train;

export function machineLv(s: GameState, k: TrainKind): number {
  return k === 'atk' ? s.mAtk : k === 'spd' ? s.mSpd : s.mCoin;
}

export function trainValue(s: GameState, k: TrainKind): number {
  return k === 'atk' ? s.trAtk : k === 'spd' ? s.trSpd : s.trCoin;
}

export function hasGear(s: GameState, i: number): boolean {
  return (s.gear & (1 << i)) !== 0;
}

export function gearUnlocked(s: GameState, i: number): boolean {
  const g = GEAR[i];
  return !!g && s.bestStage >= g.needStage;
}

export function mentorCount(bestStage: number): number {
  let n = 0;
  for (const m of MENTORS) if (bestStage >= m.needStage) n++;
  return n;
}

/** 이 종류 장비 배율 (가진 장비마다 ×gearMult) */
export function gearMult(s: GameState, k: TrainKind): number {
  let m = 1;
  GEAR.forEach((g, i) => { if (g.kind === k && hasGear(s, i)) m *= T().gearMult; });
  return m;
}

/** 장비 × 멘토 배율 (한도·속도 공통) */
function boost(s: GameState, k: TrainKind): number {
  return gearMult(s, k) * T().mentorMult ** mentorCount(s.bestStage);
}

/** 한 발에 쌓이는 훈련치 (%) */
export function gainPerShot(s: GameState, k: TrainKind): number {
  return T().gain[k] * (1 + T().levelStep * machineLv(s, k)) * boost(s, k);
}

/** 훈련치 한도 (%) */
export function trainCap(s: GameState, k: TrainKind): number {
  const c = (T().capBase[k] + T().capStep[k] * machineLv(s, k)) * boost(s, k);
  return k === 'spd' ? Math.min(c, T().spdCap) : c;
}

/** 기계 레벨 lv → lv+n 비용 합 */
export function machineCost(k: TrainKind, lv: number, n = 1): number {
  if (n <= 0) return 0;
  const { base, growth } = T().machine[k];
  return (base * growth ** lv * (growth ** n - 1)) / (growth - 1);
}

/** 코인으로 올릴 수 있는 최대 레벨 수와 비용 */
export function machineAffordable(k: TrainKind, lv: number, coins: number): { n: number; cost: number } {
  const { base, growth } = T().machine[k];
  const first = base * growth ** lv;
  if (!Number.isFinite(coins) || coins < first) return { n: 0, cost: 0 };
  let n = Math.floor(Math.log(1 + (coins * (growth - 1)) / first) / Math.log(growth));
  while (n > 0 && !(machineCost(k, lv, n) <= coins)) n--;
  while (machineCost(k, lv, n + 1) <= coins) n++;
  return { n, cost: machineCost(k, lv, n) };
}

/** 이번 회차에 산 기계·장비 값 (경제 검사 '가치'에 들어감) */
export function trainWorth(s: GameState): number {
  let v = 0;
  for (const k of TRAIN_KINDS) v += machineCost(k, 0, machineLv(s, k));
  GEAR.forEach((g, i) => { if (hasGear(s, i)) v += g.price; });
  return v;
}

export function atkTrainMult(s: GameState): number {
  return 1 + s.trAtk / 100;
}

export function spdTrainMult(s: GameState): number {
  return 1 + s.trSpd / 100;
}

export function coinTrainMult(s: GameState): number {
  return 1 + s.trCoin / 100;
}

/** 한도까지 채움 (이미 한도보다 높으면 그대로: 장비를 잃는 일은 없지만 안전하게) */
function fill(s: GameState, k: TrainKind, v: number, shots: number): number {
  const cap = trainCap(s, k);
  return v >= cap ? v : Math.min(cap, v + gainPerShot(s, k) * shots);
}

/** shots발 훈련 (소수 가능: 오프라인·숨김 정산) */
export function train(s: GameState, shots: number): GameState {
  if (!(shots > 0) || !Number.isFinite(shots)) return s;
  return {
    ...s,
    trAtk: fill(s, 'atk', s.trAtk, shots),
    trSpd: fill(s, 'spd', s.trSpd, shots),
    trCoin: fill(s, 'coin', s.trCoin, shots),
  };
}

export function buyMachine(s: GameState, k: TrainKind, n: number): GameState | null {
  if (n <= 0) return null;
  const lv = machineLv(s, k);
  const cost = machineCost(k, lv, n);
  if (!(cost <= s.coins)) return null;
  const next = { ...s, coins: s.coins - cost };
  if (k === 'atk') next.mAtk = lv + n; else if (k === 'spd') next.mSpd = lv + n; else next.mCoin = lv + n;
  return next;
}

export function buyGear(s: GameState, i: number): GameState | null {
  const g = GEAR[i];
  if (!g || hasGear(s, i) || !gearUnlocked(s, i) || !(g.price <= s.coins)) return null;
  return { ...s, coins: s.coins - g.price, gear: s.gear | (1 << i) };
}
