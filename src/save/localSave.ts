import { normalizeState } from '../sim/normalize.ts';
import type { GameState } from '../sim/state.ts';

const KEY = 'popshooter.save';
const INTERVAL_MS = 30_000;

export function loadSave(now: number): GameState {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* 저장소 막힘 → 새 판 */ }
  return normalizeState(raw, now);
}

export function writeSave(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, lastSeen: Date.now() })); } catch { /* 저장 실패해도 게임 계속 */ }
}

/** 30초마다 + 탭 숨김·페이지 떠날 때 저장 */
export class AutoSaver {
  private timer = 0;
  private readonly get: () => GameState;
  private readonly onHide = (): void => { if (document.visibilityState === 'hidden') this.saveNow(); };
  private readonly onPageHide = (): void => this.saveNow();

  constructor(get: () => GameState) {
    this.get = get;
  }

  start(): void {
    this.timer = window.setInterval(() => this.saveNow(), INTERVAL_MS);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
  }

  saveNow(): void {
    writeSave(this.get());
  }

  dispose(): void {
    window.clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
  }
}
