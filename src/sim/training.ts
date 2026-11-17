import { BALANCE } from './balance.ts';
import type { GameState } from './state.ts';

/**
 * 훈련 = 주 성장 (사용자 2026-11-11, 포키 +1 MMA Fighter · 로블록스 +1 Speed Keyboard Escape 방식).
 * 훈련장 세 곳: 공격 과녁(공격 점수) / 움직이는 표적(연사 %) / 코인 과녁(골드 보너스 %). 그 자리에서 쏜 발만큼 그 능력치만 오름, 한도 없음.
 * 한 발 양 = 기본 × 훈련장 등급(월드) × 기구 ×machineStep^레벨 × 장비 × 멘토 × 환생 배율.
 * 기구·장비는 골드로 사고 환생해도 유지. 멘토는 스테이지 기록으로 영입(유지).
 * 효과: 피해 ×(1 + 공격 점수), 초당 발사 ×(1 + 연사%/100) (12발까지), 전투 골드 ×(1 + 코인%/100).
 */

export type TrainKind = 'atk' | 'spd' | 'coin';
export const TRAIN_KINDS: readonly TrainKind[] = ['atk', 'spd', 'coin'];

/** 장비: needStage = 이 기록부터 살 수 있음, 값은 단계로 정함 (gearPrice) */
export interface GearDef { id: string; kind: TrainKind; tier: number; needStage: number }
export interface MentorDef { id: string; needStage: number }

/** 장비 (종류 × 단계). 순서 = 상점 표시 순서, gear 비트 순서 (바꾸지 말고 뒤에 붙일 것) */
export const GEAR: readonly GearDef[] = [
  { id: 'gloves', kind: 'atk', tier: 1, needStage: 0 },
  { id: 'goggles', kind: 'spd', tier: 1, needStage: 0 },
  { id: 'piggy', kind: 'coin', tier: 1, needStage: 0 },
  { id: 'gloves2', kind: 'atk', tier: 2, needStage: 5 },
  { id: 'goggles2', kind: 'spd', tier: 2, needStage: 5 },
  { id: 'piggy2', kind: 'coin', tier: 2, needStage: 5 },
  { id: 'gloves3', kind: 'atk', tier: 3, needStage: 10 },
  { id: 'goggles3', kind: 'spd', tier: 3, needStage: 10 },
  { id: 'piggy3', kind: 'coin', tier: 3, needStage: 10 },
  // 4~8단계 (2026-11-13: 장비가 너무 싸고 적음 → 월드마다 한 단계씩, 값은 그 월드 총 값 수준)
  { id: 'gloves4', kind: 'atk', tier: 4, needStage: 20 },
  { id: 'goggles4', kind: 'spd', tier: 4, needStage: 20 },
  { id: 'piggy4', kind: 'coin', tier: 4, needStage: 20 },
  { id: 'gloves5', kind: 'atk', tier: 5, needStage: 30 },
  { id: 'goggles5', kind: 'spd', tier: 5, needStage: 30 },
  { id: 'piggy5', kind: 'coin', tier: 5, needStage: 30 },
  { id: 'gloves6', kind: 'atk', tier: 6, needStage: 40 },
  { id: 'goggles6', kind: 'spd', tier: 6, needStage: 40 },
  { id: 'piggy6', kind: 'coin', tier: 6, needStage: 40 },
  { id: 'gloves7', kind: 'atk', tier: 7, needStage: 50 },
  { id: 'goggles7', kind: 'spd', tier: 7, needStage: 50 },
  { id: 'piggy7', kind: 'coin', tier: 7, needStage: 50 },
  { id: 'gloves8', kind: 'atk', tier: 8, needStage: 60 },
  { id: 'goggles8', kind: 'spd', tier: 8, needStage: 60 },
  { id: 'piggy8', kind: 'coin', tier: 8, needStage: 60 },
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

export function gearPrice(i: number): number {
  const g = GEAR[i];
  return g ? (T().gearPrice[g.tier - 1] ?? Infinity) : Infinity;
}

export function mentorCount(bestStage: number): number {
  let n = 0;
  for (const m of MENTORS) if (bestStage >= m.needStage) n++;
  return n;
}

/** 이 종류에서 가진 가장 높은 장비 단계 (0 = 없음): 캐릭터에 보이는 장비 */
export function topGearTier(s: GameState, k: TrainKind): number {
  let t = 0;
  GEAR.forEach((g, i) => { if (g.kind === k && hasGear(s, i)) t = Math.max(t, g.tier); });
  return t;
}

/** 이 종류 장비 배율 (가진 장비마다 ×gearMult) */
export function gearMult(s: GameState, k: TrainKind): number {
  let m = 1;
  GEAR.forEach((g, i) => { if (g.kind === k && hasGear(s, i)) m *= T().gearMult; });
  return m;
}

/**
 * 환생 배율 (훈련 속도) 표: ×1 → ×1.5 → ×2 → ×3 → ×4 → ×6 → ×8 → ×12 → ×16 … (사용자 2026-11-13: 1.4배씩 곱한 소수점 대신 깔끔한 숫자).
 * 1.5배와 4/3배를 번갈아 곱함 = 평균 약 1.41배 (예전 1.4배와 거의 같은 성장)
 */
export function rebirthMult(tokens: number): number {
  const n = Math.max(0, Math.floor(tokens));
  return (n % 2 === 1 ? 1.5 : 1) * 2 ** Math.floor(n / 2);
}

/**
 * 화면에 보이는 '훈련 속도 배율' = 실제 훈련량에 곱하는 환생 배율 (gainPerShot). 공격력 패스는 공격력에만 곱해서 넣지 않음
 * (2026-11-17: 환생 창·HUD는 패스까지 곱해 ×8, 환생 뒤 가운데 문구는 ×4로 서로 달랐음)
 */
export function trainSpeedMult(s: Pick<GameState, 'tokens'>): number {
  return rebirthMult(s.tokens);
}

/** 훈련장 등급 배율 (월드 w 광장의 훈련장) */
export function stationMult(world: number): number {
  return T().station[Math.max(0, Math.min(T().station.length - 1, world - 1))]!;
}

/** world 훈련장에서 한 발에 오르는 양 */
export function gainPerShot(s: GameState, k: TrainKind, world: number): number {
  return T().gain[k] * stationMult(world) * T().machineStep ** machineLv(s, k) * gearMult(s, k)
    * T().mentorMult ** mentorCount(s.bestStage) * trainSpeedMult(s);
}

/** 기구 레벨 lv → lv+n 골드 합 */
export function machineCost(lv: number, n = 1): number {
  if (n <= 0) return 0;
  const { base, growth } = T().machine;
  return (base * growth ** lv * (growth ** n - 1)) / (growth - 1);
}

/** 골드로 올릴 수 있는 최대 레벨 수와 비용 */
export function machineAffordable(lv: number, coins: number): { n: number; cost: number } {
  const first = machineCost(lv, 1);
  if (!Number.isFinite(coins) || coins < first) return { n: 0, cost: 0 };
  const g = T().machine.growth;
  let n = Math.floor(Math.log(1 + (coins * (g - 1)) / first) / Math.log(g));
  while (n > 0 && !(machineCost(lv, n) <= coins)) n--;
  while (machineCost(lv, n + 1) <= coins) n++;
  return { n, cost: machineCost(lv, n) };
}

/** 산 기구·장비 값 (경제 검사 '가치') */
export function trainWorth(s: GameState): number {
  let v = 0;
  for (const k of TRAIN_KINDS) v += machineCost(0, machineLv(s, k));
  GEAR.forEach((_, i) => { if (hasGear(s, i)) v += gearPrice(i); });
  return v;
}

export function atkTrainMult(s: GameState): number {
  return 1 + s.trAtk;
}

/**
 * 연사 배율 (초당 발사): spdSoft(12)발까지는 훈련한 그대로, 넘으면 훈련치가 e배 될 때마다 +12발만 (로그).
 * 2026-11-13: 상한을 없앤 뒤 연사도 환생·장비·기구 배율을 그대로 받아 초당 12만 발까지 갔고(공격 훈련도 그만큼 빨라져)
 * 월드 3~8이 20분에 끝남 → 넘는 구간은 수십~수백 발에 머물게. 이음매에서 값·기울기 모두 이어짐
 */
export function softSpd(raw: number): number {
  const cap = T().spdSoft;
  return raw <= cap ? raw : cap * (1 + Math.log(raw / cap));
}

export function spdTrainMult(s: GameState): number {
  return softSpd(1 + s.trSpd / 100);
}

export function coinTrainMult(s: GameState): number {
  return 1 + s.trCoin / 100;
}

const FIELD = { atk: 'trAtk', spd: 'trSpd', coin: 'trCoin' } as const;

/** k 훈련장(world)에서 shots발 훈련 (소수 가능: 오프라인·숨김 정산). 상한 없음 */
export function train(s: GameState, k: TrainKind, shots: number, world: number): GameState {
  if (!(shots > 0) || !Number.isFinite(shots)) return s;
  const v = trainValue(s, k) + gainPerShot(s, k, world) * shots;
  return { ...s, [FIELD[k]]: v };
}

export function buyMachine(s: GameState, k: TrainKind, n: number): GameState | null {
  if (n <= 0) return null;
  const lv = machineLv(s, k);
  const cost = machineCost(lv, n);
  if (!(cost <= s.coins)) return null;
  const next = { ...s, coins: s.coins - cost };
  if (k === 'atk') next.mAtk = lv + n; else if (k === 'spd') next.mSpd = lv + n; else next.mCoin = lv + n;
  return next;
}

export function buyGear(s: GameState, i: number): GameState | null {
  const price = gearPrice(i);
  if (hasGear(s, i) || !gearUnlocked(s, i) || !(price <= s.coins)) return null;
  return { ...s, coins: s.coins - price, gear: s.gear | (1 << i) };
}
