import type { CloudSave } from '../platform/CloudSave';
import { normalizeState } from '../sim/normalize.ts';
import { newState, type GameState } from '../sim/state.ts';

/** 기기 사본: 계정마다 따로 (계정 모를 때 = 손님 키). 원본은 서버 계정 저장 */
const BASE = 'popshooter.save';
const LAST_ACCOUNT = 'popshooter.lastAccount';
const INTERVAL_MS = 30_000;
/** 기기 사본이 서버보다 이만큼 이상 새것이면 (서버에 못 올린 진행) 사본을 씀 */
const NEWER_MS = 5000;

const keyFor = (account: string | null): string => (account ? `${BASE}.${account}` : BASE);

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** 기기 사본 (없으면 null) */
export function loadLocal(account: string | null, now: number): GameState | null {
  const raw = read(keyFor(account));
  return raw ? normalizeState(raw, now) : null;
}

/** 예전 호환: 손님 사본 또는 새 판 */
export function loadSave(now: number): GameState {
  return loadLocal(null, now) ?? newState(now);
}

export function writeSave(s: GameState, account: string | null = null): void {
  try { localStorage.setItem(keyFor(account), JSON.stringify({ ...s, lastSeen: Date.now() })); } catch { /* 저장 실패해도 게임 계속 */ }
}

/**
 * 시작할 때 쓸 저장 고르기.
 * - 서버 연결됨: 서버 저장이 원본. 단 기기 사본이 더 새것(오프라인 때 한 진행)이면 사본. 서버에 저장이 없는 첫 접속이면 손님 사본을 가져옴.
 * - 서버 안 됨: 마지막 계정의 기기 사본 → 손님 사본 → 새 판.
 * now = 오프라인 보상 기준 시각 (서버 연결되면 서버 시각).
 */
export async function pickSave(cloud: CloudSave): Promise<{ state: GameState; now: number; account: string | null }> {
  if (cloud.online && cloud.account) {
    const acc = cloud.account;
    try { localStorage.setItem(LAST_ACCOUNT, acc); } catch { /* 기억 못 해도 됨 */ }
    const r = await cloud.load();
    const now = r?.now ?? Date.now();
    const local = loadLocal(acc, now);
    if (r?.save) {
      const server = normalizeState(r.save, now);
      return { state: local && local.lastSeen > server.lastSeen + NEWER_MS ? local : server, now, account: acc };
    }
    if (r) return { state: local ?? loadLocal(null, now) ?? newState(now), now, account: acc };
    return { state: local ?? newState(now), now, account: acc };
  }
  const now = Date.now();
  const acc = read(LAST_ACCOUNT);
  return { state: loadLocal(acc, now) ?? loadLocal(null, now) ?? newState(now), now, account: acc };
}

/** 30초마다 + 탭 숨김·페이지 떠날 때 저장 (기기 사본 + 서버) */
export class AutoSaver {
  private timer = 0;
  private readonly get: () => GameState;
  private readonly account: string | null;
  private readonly cloud: CloudSave | null;
  private readonly onHide = (): void => { if (document.visibilityState === 'hidden') this.saveNow(); };
  private readonly onPageHide = (): void => this.saveNow();

  constructor(get: () => GameState, account: string | null = null, cloud: CloudSave | null = null) {
    this.get = get;
    this.account = account;
    this.cloud = cloud;
  }

  start(): void {
    this.timer = window.setInterval(() => this.saveNow(), INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
  }

  saveNow(): void {
    const s = this.get();
    writeSave(s, this.account);
    this.cloud?.write(s as unknown as Record<string, unknown>);
  }

  dispose(): void {
    window.clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
  }
}
