import { BALANCE, STAGE_COUNT } from './balance.ts';
import { CHAR_IDS, newState, type CharId, type GameState } from './state.ts';
import { spdMaxLevel } from './stats.ts';

const PASS_MULTS = [1, 2, 4, 8, 16, 32, 64];

function num(v: unknown, fallback: number, max = Number.MAX_VALUE): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : fallback;
}

function int(v: unknown, fallback: number, max: number): number {
  return Math.floor(num(v, fallback, max));
}

/** 저장값(JSON 문자열 또는 객체)을 안전한 GameState로. 고칠 수 없으면 새 판 */
export function normalizeState(raw: unknown, now: number): GameState {
  let o: unknown = raw;
  if (typeof o === 'string') {
    try { o = JSON.parse(o); } catch { return newState(now); }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return newState(now);
  const r = o as Record<string, unknown>;
  const base = newState(now);
  const chars = new Set<CharId>(['blue']);
  if (Array.isArray(r.chars)) for (const c of r.chars) if (CHAR_IDS.includes(c as CharId)) chars.add(c as CharId);
  const charList = CHAR_IDS.filter((c) => chars.has(c));
  const char = charList.includes(r.char as CharId) ? (r.char as CharId) : 'blue';
  const bestStage = int(r.bestStage, 0, STAGE_COUNT);
  return {
    v: 1,
    coins: num(r.coins, 0),
    gems: int(r.gems, 0, Number.MAX_SAFE_INTEGER),
    atkLv: int(r.atkLv, 0, 1e6),
    spdLv: int(r.spdLv, 0, spdMaxLevel()),
    gun: int(r.gun, 0, BALANCE.gun.count - 1),
    bestStage,
    runBest: Math.min(int(r.runBest, 0, STAGE_COUNT), bestStage),
    rebirths: int(r.rebirths, 0, 1e9),
    tokens: int(r.tokens, 0, 1e12),
    passMult: PASS_MULTS.includes(r.passMult as number) ? (r.passMult as number) : 1,
    boostUntil: num(r.boostUntil, 0),
    lastSeen: num(r.lastSeen, base.lastSeen),
    char,
    chars: charList,
    tutorial: int(r.tutorial, 0, 99),
  };
}
