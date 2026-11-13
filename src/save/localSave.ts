import type { CloudSave } from '../platform/CloudSave';
import { normalizeState } from '../sim/normalize.ts';
import { newState, type GameState } from '../sim/state.ts';
import { chooseSave } from './chooseSave.ts';

/** 기기 사본: 계정마다 따로 (계정 모를 때 = 손님 키). 원본은 서버 계정 저장 */
const BASE = 'popshooter.save';
const LAST_ACCOUNT = 'popshooter.lastAccount';
const INTERVAL_MS = 30_000;

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

/** 계정 초기화: 이 계정 사본과 손님 사본을 지움 */
export function clearLocalSaves(account: string | null): void {
  try {
    if (account) localStorage.removeItem(keyFor(account));
    localStorage.removeItem(keyFor(null));
  } catch { /* 못 지우면 서버 새 판이 더 새것이라 그쪽을 씀 */ }
}

export function writeSave(s: GameState, account: string | null = null): void {
  try { localStorage.setItem(keyFor(account), JSON.stringify({ ...s, lastSeen: Date.now() })); } catch { /* 저장 실패해도 게임 계속 */ }
}

/**
 * 시작할 때 쓸 저장 고르기.
 * - 서버 연결됨: chooseSave (서버 저장이 원본, 더 새 기기 사본, 첫 접속이면 손님 사본 가져옴). 서버 읽기 실패면 cloudOk = false.
 * - 서버 안 됨: 마지막 계정의 기기 사본 → 손님 사본 → 새 판.
 * now = 오프라인 보상 기준 시각 (서버 연결되면 서버 시각).
 * cloudOk = 서버 저장을 읽었음 → 이때만 서버에 써도 됨.
 */
export async function pickSave(cloud: CloudSave): Promise<{ state: GameState; now: number; account: string | null; cloudOk: boolean }> {
  if (cloud.online && cloud.account) {
    const acc = cloud.account;
    try { localStorage.setItem(LAST_ACCOUNT, acc); } catch { /* 기억 못 해도 됨 */ }
    const r = await cloud.load();
    const now = r?.now ?? Date.now();
    const local = loadLocal(acc, now);
    const c = chooseSave(r, local, r && !r.save && !local ? loadLocal(null, now) : null, now);
    if (c.source === 'guest') {
      // 손님 사본을 이 계정 사본으로 옮기고 손님 키는 지움 (같은 기기의 다른 계정이 또 가져가지 않게).
      // lastSeen은 그대로 둠 (오프라인 보상 기준)
      try {
        localStorage.setItem(keyFor(acc), JSON.stringify(c.state));
        localStorage.removeItem(keyFor(null));
      } catch { /* 못 옮기면 손님 사본을 그대로 둠 */ }
    }
    return { state: c.state, now, account: acc, cloudOk: c.cloudOk };
  }
  const now = Date.now();
  const acc = read(LAST_ACCOUNT);
  return { state: loadLocal(acc, now) ?? loadLocal(null, now) ?? newState(now), now, account: acc, cloudOk: false };
}

/** 30초마다 + 탭 숨김·페이지 떠날 때 저장 (기기 사본 + 서버) */
export class AutoSaver {
  private timer = 0;
  private readonly get: () => GameState;
  private readonly account: string | null;
  private readonly cloud: CloudSave | null;
  /** true면 저장 안 함 (오프라인 보상 창이 떠 있는 동안: lastSeen이 갱신되면 받기 전에 닫을 때 보상이 사라짐) */
  hold = false;
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
    if (this.hold) return;
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
