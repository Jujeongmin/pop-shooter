import type { Premium } from './econ.ts';
import type { CharId } from './state.ts';

/**
 * 프리미엄 규칙 (서버·게임 공용 순수 코드, 계획 3). 서버가 계정 상태 prem으로 가지고, 클라이언트 값은 믿지 않음.
 * - 리워드 광고 2종: 골드 2배 15분(누적 최대 2시간) / 오프라인 보상 2배(서버가 계산한 오프라인 골드만큼 다음 저장에서 더 허용).
 *   종류별 하루 횟수, 광고 id 하나에 한 번만 (기록은 최근 50개). 무과금 팝젬은 거의 없음 (사용자 2026-11-12: 광고 팝젬 선물 없앰).
 * - VX 상품은 팝젬 묶음만 (반복 구매, 할인 없이 1 VX = 1 팝젬). 결제 id 하나에 한 번만 (최근 50개).
 * - 팝젬으로: 공격력 패스(순서대로만, 단계마다 ×2 → passMult), 유료 캐릭터, 골드 2배 30분, 환생 조건 건너뛰기(skip 1회, 다음 저장에서 씀).
 */

export type AdKind = 'boost' | 'offline';
export const AD_KINDS: readonly AdKind[] = ['boost', 'offline'];
export const AD_LIMIT: Record<AdKind, number> = { boost: 8, offline: 10 };
export const BOOST_AD_MS = 15 * 60_000;
export const BOOST_CAP_MS = 2 * 3_600_000;
export const GEM_BOOST = { gems: 20, ms: 30 * 60_000 };
const KEEP_IDS = 50;

/** VXShop 상품 id → 팝젬 수 (대시보드에 같은 id로 등록, 가격 VX = 팝젬 수, 묶음 할인 없음) */
export const PRODUCTS: Record<string, { gems: number }> = {
  gems_s: { gems: 100 },
  gems_m: { gems: 500 },
  gems_l: { gems: 1000 },
};
export const PASS_ORDER = [2, 4, 8, 16, 32, 64] as const;

/** 팝젬 상점 물건 (서버 gemBuy가 팝젬을 빼고 지급). 패스는 순서대로만 */
export type GemItem = { kind: 'pass'; mult: number; gems: number } | { kind: 'char'; char: CharId; gems: number };
export const GEM_ITEMS: Record<string, GemItem> = {
  pass_x2: { kind: 'pass', mult: 2, gems: 100 },
  pass_x4: { kind: 'pass', mult: 4, gems: 200 },
  pass_x8: { kind: 'pass', mult: 8, gems: 400 },
  pass_x16: { kind: 'pass', mult: 16, gems: 700 },
  pass_x32: { kind: 'pass', mult: 32, gems: 1200 },
  pass_x64: { kind: 'pass', mult: 64, gems: 2000 },
  char_shoni: { kind: 'char', char: 'white', gems: 300 },
  char_bam: { kind: 'char', char: 'black', gems: 500 },
};
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
 * 출석 보상 (사용자 2026-11-12: 가볍게, 무과금 팝젬은 거의 없게 → 골드 2배 위주, 7일째만 팝젬 10). 하루 첫 접속에 한 번, 7칸 순환.
 * 하루 빠져도 처음으로 돌아가지 않고 다음 칸부터 (연속 출석 강요 없음). 지급은 서버가 하루 한 번만 (기기 날짜와 무관).
 */
export type DailyReward = { gems: number } | { boostMin: number };
export const DAILY: readonly DailyReward[] = [
  { boostMin: 15 }, { boostMin: 15 }, { boostMin: 30 }, { boostMin: 30 }, { boostMin: 45 }, { boostMin: 60 }, { gems: 10 },
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
    adUsed: { boost: Math.floor(num(used.boost, 0)), offline: Math.floor(num(used.offline, 0)) },
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
  const used = day === p.adDay ? { ...p.adUsed } : { boost: 0, offline: 0 };
  if (used[kind] >= AD_LIMIT[kind]) return { ok: false, reason: 'limit' };
  if (kind === 'boost' && p.boostUntil >= now + BOOST_CAP_MS) return { ok: false, reason: 'limit' };
  if (kind === 'offline' && !(offlineCoins > 0)) return { ok: false, reason: 'nothing' };
  used[kind] += 1;
  const next: PremState = { ...p, adDay: day, adUsed: used, adIds: [...p.adIds, adId].slice(-KEEP_IDS) };
  if (kind === 'boost') next.boostUntil = addBoost(p.boostUntil, now, BOOST_AD_MS);
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

/** 결제 지급 (서버 $onItemPurchased, 팝젬 묶음만). 같은 결제 id는 한 번만 */
export function grantPurchase(p: PremState, productId: string, purchaseId: string, quantity: number): { ok: true; prem: PremState } | { ok: false } {
  const prod = PRODUCTS[productId];
  if (!prod || !purchaseId || p.buys.includes(purchaseId)) return { ok: false };
  const q = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  return { ok: true, prem: { ...p, gems: p.gems + prod.gems * q, buys: [...p.buys, purchaseId].slice(-KEEP_IDS) } };
}

export type GemBuyFail = 'bad' | 'owned' | 'order' | 'gems';

/** 팝젬으로 사기 (서버 gemBuy). 패스는 바로 다음 단계만, 캐릭터는 안 가진 것만, 팝젬이 모자라면 실패 */
export function buyWithGems(p: PremState, id: string): { ok: true; prem: PremState } | { ok: false; reason: GemBuyFail } {
  const it = Object.prototype.hasOwnProperty.call(GEM_ITEMS, id) ? GEM_ITEMS[id] : undefined;
  if (!it) return { ok: false, reason: 'bad' };
  if (it.kind === 'pass') {
    if (p.passMult >= it.mult) return { ok: false, reason: 'owned' };
    if (nextPassProduct(p.passMult) !== id) return { ok: false, reason: 'order' };
  } else if (p.paid.includes(it.char)) return { ok: false, reason: 'owned' };
  if (p.gems < it.gems) return { ok: false, reason: 'gems' };
  const next: PremState = { ...p, gems: p.gems - it.gems };
  if (it.kind === 'pass') next.passMult = it.mult;
  else next.paid = [...p.paid, it.char];
  return { ok: true, prem: next };
}

/** 다음에 살 수 있는 공격력 패스 (순서대로만, 상점은 이것만 구매 버튼, 다 샀으면 null) */
export function nextPassProduct(passMult: number): string | null {
  const m = PASS_ORDER.find((x) => x > passMult);
  return m ? `pass_x${m}` : null;
}
