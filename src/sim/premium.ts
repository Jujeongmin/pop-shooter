import type { Premium } from './econ.ts';
import type { CharId } from './state.ts';

/**
 * 프리미엄 규칙 (서버·게임 공용 순수 코드, 계획 3). 서버가 계정 상태 prem으로 가지고, 클라이언트 값은 믿지 않음.
 * - 리워드 광고 3종: 골드 2배 15분(누적 최대 2시간) / 오프라인 보상 2배(서버가 계산한 오프라인 골드만큼 다음 저장에서 더 허용) / 하루 선물(팝젬).
 *   종류별 하루 횟수, 광고 id 하나에 한 번만 (기록은 최근 50개).
 * - VX 상품: 공격력 패스(순서대로만 구매, 단계마다 ×2 → passMult = 산 단계의 최고 배율; 순서가 뒤바뀌어 도착해도 max라 같음), 팝젬 묶음(반복 구매), 유료 캐릭터. 결제 id 하나에 한 번만 (최근 50개).
 * - 팝젬으로 골드 2배 30분, 팝젬으로 환생 조건 건너뛰기(skip 1회, 다음 저장에서 씀).
 */

export type AdKind = 'boost' | 'offline' | 'gift';
export const AD_KINDS: readonly AdKind[] = ['boost', 'offline', 'gift'];
export const AD_LIMIT: Record<AdKind, number> = { boost: 8, offline: 10, gift: 5 };
export const BOOST_AD_MS = 15 * 60_000;
export const BOOST_CAP_MS = 2 * 3_600_000;
export const GIFT_GEMS = 5;
export const GEM_BOOST = { gems: 20, ms: 30 * 60_000 };
const KEEP_IDS = 50;

export type Product = { kind: 'pass'; mult: number } | { kind: 'gems'; gems: number } | { kind: 'char'; char: CharId };

/** VXShop 상품 id → 내용 (대시보드에 같은 id로 등록) */
export const PRODUCTS: Record<string, Product> = {
  pass_x2: { kind: 'pass', mult: 2 },
  pass_x4: { kind: 'pass', mult: 4 },
  pass_x8: { kind: 'pass', mult: 8 },
  pass_x16: { kind: 'pass', mult: 16 },
  pass_x32: { kind: 'pass', mult: 32 },
  pass_x64: { kind: 'pass', mult: 64 },
  gems_s: { kind: 'gems', gems: 100 },
  gems_m: { kind: 'gems', gems: 550 },
  gems_l: { kind: 'gems', gems: 1200 },
  char_shoni: { kind: 'char', char: 'white' },
  char_bam: { kind: 'char', char: 'black' },
};
export const PASS_ORDER = [2, 4, 8, 16, 32, 64] as const;
const PAID: readonly CharId[] = ['white', 'black'];

/** 서버가 가진 프리미엄 전부 (econ Premium + 광고·결제 기록) */
export interface PremState extends Premium {
  extra: number;
  skip: number;
  adIds: string[];
  buys: string[];
  adDay: string;
  adUsed: Record<AdKind, number>;
  /** 출석: 마지막으로 받은 날(UTC 'YYYY-MM-DD'), 다음에 받을 칸 0..6 */
  dailyDay: string;
  dailyIdx: number;
}

/**
 * 출석 보상 (사용자 2026-11-12: 가볍게). 하루 첫 접속에 한 번, 7칸 순환.
 * 하루 빠져도 처음으로 돌아가지 않고 다음 칸부터 (연속 출석 강요 없음). 지급은 서버가 하루 한 번만 (기기 날짜와 무관).
 */
export type DailyReward = { gems: number } | { boostMin: number };
export const DAILY: readonly DailyReward[] = [
  { gems: 10 }, { boostMin: 15 }, { gems: 15 }, { boostMin: 15 }, { gems: 20 }, { gems: 30 }, { gems: 50 },
];

export function dailyReady(p: PremState, now: number): boolean {
  return p.dailyDay !== dayKey(now);
}

/** 출석 받기 (오늘 이미 받았으면 null) */
export function claimDaily(p: PremState, now: number): { prem: PremState; reward: DailyReward; idx: number } | null {
  if (!dailyReady(p, now)) return null;
  const idx = p.dailyIdx % DAILY.length;
  const reward = DAILY[idx]!;
  const next: PremState = { ...p, dailyDay: dayKey(now), dailyIdx: (idx + 1) % DAILY.length };
  if ('gems' in reward) next.gems = p.gems + reward.gems;
  else next.boostUntil = addBoost(p.boostUntil, now, reward.boostMin * 60_000);
  return { prem: next, reward, idx };
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-KEEP_IDS) : []);

/** 저장된 prem(없거나 깨졌으면 기본값)을 안전하게 */
export function readPrem(raw: unknown): PremState {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const used = p.adUsed && typeof p.adUsed === 'object' ? (p.adUsed as Record<string, unknown>) : {};
  return {
    gems: Math.floor(num(p.gems, 0)),
    passMult: (PASS_ORDER as readonly number[]).includes(p.passMult as number) ? (p.passMult as number) : 1,
    boostUntil: num(p.boostUntil, 0),
    paid: strs(p.paid).filter((c): c is CharId => PAID.includes(c as CharId)),
    extra: num(p.extra, 0),
    skip: Math.min(5, Math.floor(num(p.skip, 0))),
    adIds: strs(p.adIds),
    buys: strs(p.buys),
    adDay: typeof p.adDay === 'string' ? p.adDay : '',
    adUsed: { boost: Math.floor(num(used.boost, 0)), offline: Math.floor(num(used.offline, 0)), gift: Math.floor(num(used.gift, 0)) },
    dailyDay: typeof p.dailyDay === 'string' ? p.dailyDay : '',
    dailyIdx: Math.floor(num(p.dailyIdx, 0)) % 7,
  };
}

function addBoost(until: number, now: number, ms: number): number {
  return Math.min(Math.max(now, until) + ms, now + BOOST_CAP_MS);
}

/** 광고 보상. offlineCoins = 서버가 계산한 지금 오프라인 골드 (offline만 씀) */
export function claimAd(p: PremState, kind: AdKind, adId: string, now: number, offlineCoins: number):
  | { ok: true; prem: PremState } | { ok: false; reason: 'dup' | 'limit' | 'nothing' } {
  if (p.adIds.includes(adId)) return { ok: false, reason: 'dup' };
  const day = dayKey(now);
  const used = day === p.adDay ? { ...p.adUsed } : { boost: 0, offline: 0, gift: 0 };
  if (used[kind] >= AD_LIMIT[kind]) return { ok: false, reason: 'limit' };
  if (kind === 'boost' && p.boostUntil >= now + BOOST_CAP_MS) return { ok: false, reason: 'limit' };
  if (kind === 'offline' && !(offlineCoins > 0)) return { ok: false, reason: 'nothing' };
  used[kind] += 1;
  const next: PremState = { ...p, adDay: day, adUsed: used, adIds: [...p.adIds, adId].slice(-KEEP_IDS) };
  if (kind === 'boost') next.boostUntil = addBoost(p.boostUntil, now, BOOST_AD_MS);
  else if (kind === 'gift') next.gems = p.gems + GIFT_GEMS;
  else next.extra = p.extra + offlineCoins;
  return { ok: true, prem: next };
}

/** 팝젬으로 골드 2배 (모자라면 null) */
export function spendGemBoost(p: PremState, now: number): PremState | null {
  if (p.gems < GEM_BOOST.gems || p.boostUntil >= now + BOOST_CAP_MS) return null;
  return { ...p, gems: p.gems - GEM_BOOST.gems, boostUntil: addBoost(p.boostUntil, now, GEM_BOOST.ms) };
}

/** 팝젬으로 환생 건너뛰기 1회 사기 (모자라거나 이미 가지고 있으면 null). 다음 저장의 조건 안 된 환생 한 번에 씀 */
export function buySkipRebirth(p: PremState, gems: number): PremState | null {
  if (!(gems > 0) || p.gems < gems || p.skip > 0) return null;
  return { ...p, gems: p.gems - gems, skip: 1 };
}

/** 결제 지급 (서버 $onItemPurchased). 같은 결제 id는 한 번만 */
export function grantPurchase(p: PremState, productId: string, purchaseId: string, quantity: number): { ok: true; prem: PremState } | { ok: false } {
  const prod = PRODUCTS[productId];
  if (!prod || !purchaseId || p.buys.includes(purchaseId)) return { ok: false };
  const q = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  const next: PremState = { ...p, buys: [...p.buys, purchaseId].slice(-KEEP_IDS) };
  if (prod.kind === 'pass') next.passMult = Math.max(p.passMult, prod.mult);
  else if (prod.kind === 'gems') next.gems = p.gems + prod.gems * q;
  else if (!p.paid.includes(prod.char)) next.paid = [...p.paid, prod.char];
  return { ok: true, prem: next };
}

/** 다음에 살 수 있는 공격력 패스 (순서대로만, 상점은 이것만 구매 버튼, 다 샀으면 null) */
export function nextPassProduct(passMult: number): string | null {
  const m = PASS_ORDER.find((x) => x > passMult);
  return m ? `pass_x${m}` : null;
}
