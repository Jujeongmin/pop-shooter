import { normalizeState } from '../sim/normalize.ts';
import { newState, type GameState } from '../sim/state.ts';

/** 기기 사본이 서버보다 이만큼 이상 새것이면 (서버에 못 올린 진행) 사본을 씀 */
export const NEWER_MS = 5000;

export interface ServerLoad {
  save: unknown | null;
  now: number;
}

export interface Chosen {
  state: GameState;
  /** 어디서 왔나: 'guest'면 손님 사본을 이 계정으로 옮긴 것 */
  source: 'server' | 'local' | 'guest' | 'new';
  /** 서버 저장을 실제로 읽었나. false면 서버에 쓰면 안 됨 (읽기 실패한 채 쓰면 서버 저장을 덮어씀) */
  cloudOk: boolean;
}

/**
 * 서버에 연결된 계정의 시작 저장 고르기 (SDK·localStorage 없는 순수 함수).
 * - server = 서버 읽기 결과, null = 읽기 실패(시간 초과·오류) → 기기 사본 또는 새 판, 서버에 쓰지 않음.
 * - 서버 저장 있음: 서버가 원본. 단 기기 사본이 NEWER_MS 넘게 새것이면 사본.
 * - 서버 저장 없음(첫 접속): 계정 사본 → 손님 사본(가져옴) → 새 판.
 */
export function chooseSave(server: ServerLoad | null, local: GameState | null, guest: GameState | null, now: number): Chosen {
  if (!server) return local ? { state: local, source: 'local', cloudOk: false } : { state: newState(now), source: 'new', cloudOk: false };
  if (server.save) {
    const s = normalizeState(server.save, now);
    return local && local.lastSeen > s.lastSeen + NEWER_MS
      ? { state: local, source: 'local', cloudOk: true }
      : { state: s, source: 'server', cloudOk: true };
  }
  if (local) return { state: local, source: 'local', cloudOk: true };
  if (guest) return { state: guest, source: 'guest', cloudOk: true };
  return { state: newState(now), source: 'new', cloudOk: true };
}
